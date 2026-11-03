import asyncio
import json
import copy
import logging
import os
import secrets
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from uuid import UUID, uuid4

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import JSONResponse, StreamingResponse

from .assemblyai import AssemblyAIVoiceProvider, KEY_CONFIGURATION_ERROR, is_placeholder_key
from .models import AuthView, CapabilitiesView, ChoiceRequest, SessionView, StartRequest
from .story import DemoStoryProvider, Memory, StoryProvider
from .voice import MockVoiceProvider, VoiceProvider, VoiceUnavailable
from .budget import SynthesisBudget

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
TTL = 3600
MAX_SESSIONS = 500
security = HTTPBearer(auto_error=False)
logger = logging.getLogger("hauntcast")


@dataclass
class StoredSession:
    id: UUID
    owner: str
    memory: Memory
    created: float
    start_request: UUID
    audio_stop: threading.Event = field(default_factory=threading.Event)
    audio_active: bool = False
    audio_requests: set = field(default_factory=set)
    revision: int = 0
    receipts: dict = field(default_factory=dict)


def create_app() -> FastAPI:
    app = FastAPI(title="HauntCast AI", docs_url=None, redoc_url=None, openapi_url=None)
    configured_secret = os.getenv("JWT_SECRET", "")
    deployment_mode = os.getenv("DEPLOYMENT_MODE", "local")
    if deployment_mode not in {"local", "public", "restricted"}:
        raise RuntimeError("Unknown DEPLOYMENT_MODE")
    if deployment_mode != "local" and (len(configured_secret) < 48 or len(set(configured_secret)) < 16
                                       or is_placeholder_key(configured_secret)):
        raise RuntimeError("Production JWT_SECRET must be randomly generated with at least 48 characters.")
    if configured_secret and len(configured_secret) < 32:
        raise RuntimeError("JWT_SECRET must contain at least 32 characters.")
    secret = configured_secret or secrets.token_urlsafe(48)
    story: StoryProvider = DemoStoryProvider()
    if os.getenv("STORY_PROVIDER", "demo") != "demo":
        raise RuntimeError("Only the deterministic demo story provider is implemented.")
    provider_name = os.getenv("VOICE_PROVIDER", "mock")
    if deployment_mode == "public" and provider_name != "mock":
        raise RuntimeError("Public deployment requires VOICE_PROVIDER=mock.")
    live_access = os.getenv("TTS_LIVE_ACCESS_TOKEN", "")
    if provider_name not in {"mock", "assemblyai"}:
        raise RuntimeError("Unknown VOICE_PROVIDER")
    voice: VoiceProvider = MockVoiceProvider() if provider_name == "mock" else AssemblyAIVoiceProvider()
    sessions: dict[UUID, StoredSession] = {}
    limits: dict[str, deque] = {}
    lock = threading.RLock()
    app.state.sessions = sessions
    app.state.limits = limits

    def rate_limit(key: str, maximum: int):
        now = time.monotonic()
        with lock:
            for old in list(limits):
                if not limits[old] or limits[old][-1] <= now - 60:
                    del limits[old]
            if key not in limits and len(limits) >= 4000:
                raise HTTPException(503, "Server is busy. Please retry later.")
            bucket = limits.setdefault(key, deque())
            while bucket and bucket[0] <= now - 60:
                bucket.popleft()
            if len(bucket) >= maximum:
                raise HTTPException(429, "Too many requests. Please wait before retrying.", headers={"Retry-After": "60"})
            bucket.append(now)

    def owner(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
        if not credentials or credentials.scheme.lower() != "bearer":
            raise HTTPException(401, "Start a new experience to authenticate.")
        try:
            payload = jwt.decode(credentials.credentials, secret, algorithms=["HS256"],
                                 audience="hauntcast", issuer="hauntcast-demo",
                                 options={"require": ["sub", "exp", "iat", "aud", "iss"]})
            subject = str(UUID(payload["sub"]))
        except (jwt.PyJWTError, ValueError, KeyError, TypeError):
            raise HTTPException(401, "Your demo session expired. Start a new experience.") from None
        rate_limit("user:" + subject, 90)
        return subject

    def prune():
        for key in list(sessions):
            if sessions[key].created + TTL <= time.time():
                del sessions[key]

    def owned(session_id: UUID, user: str) -> StoredSession:
        prune()
        session = sessions.get(session_id)
        if session is None or session.owner != user:
            raise HTTPException(404, "This story has expired or is unavailable. Start a new experience.")
        return session

    def view(s: StoredSession) -> SessionView:
        return SessionView(id=s.id, persona=s.memory.persona, revision=s.revision,
                           scene=story.render(s.memory), inventory=list(s.memory.inventory),
                           journal=list(s.memory.journal), voice_mode=voice.mode)

    @app.middleware("http")
    async def headers(request: Request, call_next):
        request_id = str(uuid4())  # Never trust a supplied request ID or log request bodies.
        try:
            response = await call_next(request)
        except Exception:
            response = JSONResponse(status_code=500, content={"detail": "The house lost its place. Please retry or start a new experience."})
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Request-ID"] = request_id
        if response.status_code >= 400:
            route = request.scope.get("route")
            route_name = getattr(route, "name", "unmatched")
            logger.warning("request_failed id=%s route=%s status=%s", request_id, route_name, response.status_code)
        return response

    @app.post("/api/auth", response_model=AuthView)
    def authenticate(request: Request):
        # Public authentication bootstrap grants only an anonymous demo identity.
        rate_limit("ip:" + (request.client.host if request.client else "unknown"), 20)
        now = int(time.time())
        token = jwt.encode({"sub": str(uuid4()), "iat": now, "exp": now + TTL,
                            "aud": "hauntcast", "iss": "hauntcast-demo"}, secret, algorithm="HS256")
        return {"access_token": token, "token_type": "bearer", "expires_in": TTL}

    @app.get("/healthz")
    def health():
        # Liveness only. No provider, budget details, credentials or session data.
        return {"status": "ok"}

    @app.get("/api/capabilities", response_model=CapabilitiesView)
    def capabilities(user: str = Depends(owner)):
        if voice.mode == "unavailable":
            raise HTTPException(503, KEY_CONFIGURATION_ERROR)
        return {"story": "deterministic-demo", "voice": voice.mode, "assemblyai_available": voice.mode == "live",
                "live_ttfa_ms": None, "reason": "Live requests use AssemblyAI-TTS-1; credentials are not tested until playback." if voice.mode == "live" else "Local mock audio; no AssemblyAI requests."}

    @app.post("/api/sessions", response_model=SessionView)
    def start(body: StartRequest, user: str = Depends(owner)):
        with lock:
            prune()
            for s in sessions.values():
                if s.owner == user and s.start_request == body.request_id:
                    if s.memory.persona != body.persona:
                        raise HTTPException(409, "This request identifier was already used with another persona.")
                    return view(s)
            if len(sessions) >= MAX_SESSIONS:
                raise HTTPException(503, "The house is full. Please return later.")
            s = StoredSession(uuid4(), user, Memory(body.persona), time.time(), body.request_id)
            sessions[s.id] = s
            return view(s)

    @app.get("/api/sessions/{session_id}", response_model=SessionView)
    def get_session(session_id: UUID, user: str = Depends(owner)):
        with lock:
            return view(owned(session_id, user))

    @app.post("/api/sessions/{session_id}/choices", response_model=SessionView)
    def choose(session_id: UUID, body: ChoiceRequest, user: str = Depends(owner)):
        with lock:
            s = owned(session_id, user)
            fingerprint = (body.choice_id, body.revision)
            if body.request_id in s.receipts:
                previous, result = s.receipts[body.request_id]
                if previous != fingerprint:
                    raise HTTPException(409, "This request identifier was already used for a different decision.")
                return result
            if body.revision != s.revision:
                raise HTTPException(409, "The story has moved on. Refresh the current scene.")
            candidate = copy.deepcopy(s.memory)
            try:
                story.choose(candidate, body.choice_id)
                story.render(candidate)
            except ValueError as error:
                raise HTTPException(422, str(error)) from None
            s.audio_stop.set()
            s.memory = candidate
            s.revision += 1
            result = view(s)
            s.receipts[body.request_id] = (fingerprint, result)
            return result

    @app.get("/api/sessions/{session_id}/audio")
    def audio(session_id: UUID, revision: int, user: str = Depends(owner)):
        with lock:
            s = owned(session_id, user)
            if revision != s.revision:
                raise HTTPException(409, "Audio belongs to an older scene.")
            text, persona = story.render(s.memory).text, s.memory.persona
        if provider_name != "mock":
            if voice.mode == "unavailable":
                raise HTTPException(503, KEY_CONFIGURATION_ERROR)
            raise HTTPException(503, "Use the live streaming audio route.")
        try:
            content = voice.synthesize(text, persona)
        except VoiceUnavailable as error:
            raise HTTPException(503, str(error)) from None
        return Response(content=content, media_type="audio/wav", headers={"X-Voice-Mode": "mock"})

    @app.post("/api/sessions/{session_id}/audio/stream")
    async def stream_audio(session_id: UUID, revision: int, request_id: UUID, request: Request, user: str = Depends(owner)):
        if voice.mode == "unavailable":
            raise HTTPException(503, KEY_CONFIGURATION_ERROR)
        if not isinstance(voice, AssemblyAIVoiceProvider) or voice.mode != "live":
            raise HTTPException(503, "Live voice is not configured.")
        supplied_access = request.headers.get("X-HauntCast-Live-Access", "")
        if len(live_access) < 48 or not secrets.compare_digest(supplied_access.encode(), live_access.encode()):
            raise HTTPException(403, "Live narration is restricted. Use the public mock demo.")
        with lock:
            s = owned(session_id, user)
            if revision != s.revision:
                raise HTTPException(409, "Audio belongs to an older scene.")
            if s.audio_active or request_id in s.audio_requests:
                raise HTTPException(409, "This audio request is active or already attempted. Retry explicitly.")
            if len(s.audio_requests) >= 20:
                raise HTTPException(429, "Story audio attempt budget exhausted.")
            rate_limit("tts:account", 4)  # Conservative: free accounts allow 5 new WS sessions/minute.
            rate_limit("tts:" + user, 4)
            text, persona = story.render(s.memory).text, s.memory.persona
            try:
                voice.validate(text)
                SynthesisBudget.configured().check()
            except VoiceUnavailable as error:
                raise HTTPException(503, str(error)) from None
            s.audio_requests.add(request_id)
            s.audio_active = True
            stopped = threading.Event()
            s.audio_stop = stopped

        async def chunks():
            upstream = voice.stream(text, persona, stopped)
            try:
                async for event in upstream:
                    if stopped.is_set():
                        yield json.dumps({"type": "error", "detail": "Scene changed; audio canceled."}) + "\n"
                        return
                    yield json.dumps(event) + "\n"
            except asyncio.CancelledError:
                stopped.set()
                raise
            except VoiceUnavailable as error:
                yield json.dumps({"type": "error", "detail": str(error), "retryable": error.retryable,
                                  "retry_after_seconds": error.retry_after_seconds}) + "\n"
            finally:
                stopped.set()
                await upstream.aclose()
                with lock:
                    s.audio_active = False

        return StreamingResponse(chunks(), media_type="application/x-ndjson",
                                 headers={"X-Voice-Mode": "live", "X-Accel-Buffering": "no"})

    return app


app = create_app()
