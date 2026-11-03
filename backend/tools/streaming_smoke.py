"""Isolated browser-smoke backend. Default rehearsal never opens a provider socket."""
import argparse
import asyncio
import base64
import hashlib
import json
import logging
import math
import os
from pathlib import Path
import struct
import sys
import time
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
TEXT = "Welcome to Blackthorn House."
PROVIDER_ID = "10885144-0d4b-4928-9eff-ef292a352937"


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("rehearsal", "live"), default="rehearsal")
    parser.add_argument("--port", type=int, default=18010)
    args = parser.parse_args()
    live = args.mode == "live"
    if live and os.getenv("HAUNTCAST_LIVE_STREAM_SMOKE") != "1":
        raise SystemExit("Live streaming requires explicit authorization and HAUNTCAST_LIVE_STREAM_SMOKE=1.")

    # No transport/debug logs, exception objects, request bodies or credentials in artifacts.
    logging.disable(logging.CRITICAL)
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    if os.getenv("STORY_PROVIDER", "demo") != "demo":
        raise SystemExit("STORY_PROVIDER must remain demo.")
    if live and os.getenv("VOICE_PROVIDER") != "assemblyai":
        raise SystemExit("VOICE_PROVIDER must be assemblyai for live validation.")
    if not live:
        os.environ["ASSEMBLYAI_API_KEY"] = "stream-smoke-fixture-credential"
    os.environ["VOICE_PROVIDER"] = "assemblyai"
    os.environ["STORY_PROVIDER"] = "demo"
    from app import assemblyai
    from app.voice import VoiceUnavailable

    provider = assemblyai.AssemblyAIVoiceProvider()
    provider.validate(TEXT)
    if provider.voices["medium"] != "aai-audrey":
        raise SystemExit("Expected the verified medium voice aai-audrey.")
    directory = ROOT / "test-results" / "assemblyai-stream-smoke" / args.mode
    directory.mkdir(parents=True, exist_ok=True)
    # This isolated loopback rehearsal uses a fresh simulated ledger, never a live budget.
    import secrets
    import tempfile
    from app.budget import initialize
    if not live:
        os.environ["DEPLOYMENT_MODE"] = "local"
        simulated_budget = tempfile.TemporaryDirectory(prefix="rehearsal-budget-", dir=directory)
        budget_path = str(Path(simulated_budget.name) / "budget.sqlite3")
        initialize(budget_path, 1, 1500)
        os.environ["TTS_BUDGET_PATH"] = budget_path
        os.environ["TTS_LIVE_ACCESS_TOKEN"] = secrets.token_urlsafe(48)
    if live and (directory / "attempt.json").exists():
        raise SystemExit("Blocked rerun of a paid attempt; new authorization is required.")
    report = {"mode": args.mode, "live": live, "input_characters": len(TEXT), "voice": "aai-audrey",
              "stream_attempts": 0, "connection_attempts": 0, "generate_frames": 0, "flush_frames": 0,
              "audio_chunks": 0, "pcm_bytes": 0, "provider_error_code": None,
              "termination_received": False, "physical_speaker_audibility_verified": False}
    digest = hashlib.sha256()
    started = None
    real_connect = assemblyai.connect
    real_stream = assemblyai.AssemblyAIVoiceProvider.stream

    def save():
        report["pcm_sha256"] = digest.hexdigest()
        target = directory / "backend.json"
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        temporary.replace(target)

    class NoRedirectConnect(real_connect):
        def process_redirect(self, exc):
            return exc  # Never follow redirects or iterate connect() for retries.

    class RehearsalSocket:
        def __init__(self):
            self.index = -1

        async def recv(self):
            self.index += 1
            if self.index == 0:
                return json.dumps({"type": "Begin", "id": PROVIDER_ID, "configuration": {
                    "voice_id": "aai-audrey", "sample_rate": 24000,
                    "encoding": "pcm_s16le", "model": "assemblyai-tts-1"}})
            if self.index <= 12:
                await asyncio.sleep(0.12)
                samples = (int(2000 * math.sin(2 * math.pi * 220 * n / 24000)) for n in range(2400))
                pcm = b"".join(struct.pack("<h", sample) for sample in samples)
                return json.dumps({"type": "Audio", "flush_id": 0, "audio": base64.b64encode(pcm).decode()})
            if self.index == 13:
                return json.dumps({"type": "FlushDone", "flush_id": 0, "audio_duration_ms": 1200})
            return json.dumps({"type": "Termination", "total_input_char_length": len(TEXT),
                               "audio_duration_seconds": 1.2, "session_duration_seconds": 2})

        async def send(self, raw):
            pass

    class ObservedSocket:
        def __init__(self, socket):
            self.socket = socket

        async def send(self, raw):
            message = json.loads(raw)
            kind = message.get("type")
            if kind == "Generate":
                if report["generate_frames"] or message.get("text") != TEXT:
                    raise VoiceUnavailable("Blocked additional or unexpected synthesis.")
                report["generate_frames"] += 1
            elif kind == "Flush":
                if report["flush_frames"]:
                    raise VoiceUnavailable("Blocked additional flush.")
                report["flush_frames"] += 1
            elif kind not in {"Terminate", "Cancel"}:
                raise VoiceUnavailable("Blocked unexpected control frame.")
            save()
            await self.socket.send(raw)

        async def recv(self):
            raw = await self.socket.recv()
            message = json.loads(raw)
            kind = message.get("type")
            if kind == "Begin":
                config = message["configuration"]
                voice = config.get("voice_id")
                if voice != "aai-audrey":
                    # Some API versions canonicalize the documented Audrey UUID.
                    if voice != "49c443a4-8a1d-5f7e-b70b-98bdbd9823c3":
                        raise VoiceUnavailable("Unexpected effective voice.")
                report.update(begin_received=True, provider_id=str(UUID(message["id"])),
                              sample_rate=config["sample_rate"], encoding_valid=config["encoding"] == "pcm_s16le",
                              model_valid=config["model"] == "assemblyai-tts-1", returned_voice=voice)
            elif kind == "Audio":
                pcm = base64.b64decode(message["audio"], validate=True)
                digest.update(pcm)
                report["audio_chunks"] += 1
                report["pcm_bytes"] += len(pcm)
                if report["audio_chunks"] == 1:
                    report["observed_first_frame_ms"] = (time.perf_counter() - started) * 1000
            elif kind == "FlushDone":
                report["flush_done_received"] = True
            elif kind == "Termination":
                report["termination_received"] = True
                for field in ("total_input_char_length", "audio_duration_seconds", "session_duration_seconds"):
                    value = message.get(field)
                    if type(value) in (int, float) and math.isfinite(value) and value >= 0:
                        report[field] = value
            elif kind == "Error":
                code = message.get("error_code")
                report["provider_error_code"] = code if type(code) is int else None
            save()
            return raw

    class Connection:
        async def __aenter__(self):
            self.connection = None
            if live:
                self.connection = NoRedirectConnect(self.url, **self.kwargs)
                try:
                    socket = await self.connection.__aenter__()
                except Exception as error:
                    status = getattr(getattr(error, "response", None), "status_code", None)
                    report["websocket_http_error_status"] = status if type(status) is int else None
                    report["websocket_connected"] = False
                    save()
                    raise
                report["websocket_connected"] = True
            else:
                socket = RehearsalSocket()
                report["websocket_connected"] = False
            save()
            return ObservedSocket(socket)

        async def __aexit__(self, *error):
            if self.connection:
                return await self.connection.__aexit__(*error)

    def connect(url, **kwargs):
        nonlocal started
        if report["connection_attempts"]:
            raise VoiceUnavailable("Blocked additional connection.")
        parsed = urlsplit(url)
        query = parse_qs(parsed.query)
        if (f"{parsed.scheme}://{parsed.netloc}{parsed.path}" != assemblyai.WS_ENDPOINT
                or query.get("voice_id") != ["aai-audrey"] or "token" in query):
            raise VoiceUnavailable("Blocked unexpected WebSocket destination.")
        if live:
            # Never remove automatically, even if a request fails or a process restarts.
            with (directory / "attempt.json").open("x", encoding="utf-8") as marker:
                json.dump({"input_characters": len(TEXT), "voice": "aai-audrey"}, marker)
        report["connection_attempts"] += 1
        started = time.perf_counter()
        save()
        connection = Connection()
        connection.url, connection.kwargs = url, kwargs
        return connection

    async def stream(self, original_text, persona, stopped):
        if report["stream_attempts"] or persona != "medium":
            raise VoiceUnavailable("This smoke permits one medium-voice attempt only.")
        report["stream_attempts"] += 1
        save()
        # Only this isolated validation process substitutes the short narration.
        # The deterministic story engine and normal app configuration are untouched.
        upstream = real_stream(self, TEXT, persona, stopped)
        try:
            async for event in upstream:
                if event["type"] == "done":
                    report["server_first_audio_ms"] = event["server_first_audio_ms"]
                    report["completed"] = True
                    save()
                yield event
        finally:
            await upstream.aclose()
            save()

    assemblyai.connect = connect
    assemblyai.AssemblyAIVoiceProvider.stream = stream
    from app.main import create_app
    import uvicorn
    save()
    app = create_app()

    @app.middleware("http")
    async def loopback_validation_access(request, call_next):
        # Validation server binds only loopback; emulate the restricted reverse proxy.
        request.scope["headers"] = [(k, v) for k, v in request.scope["headers"]
                                    if k.lower() != b"x-hauntcast-live-access"]
        request.scope["headers"].append((b"x-hauntcast-live-access",
                                        os.environ.get("TTS_LIVE_ACCESS_TOKEN", "").encode()))
        return await call_next(request)

    uvicorn.run(app, host="127.0.0.1", port=args.port, access_log=False, log_config=None)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        # Do not format arbitrary exceptions; they may hold handshake headers.
        raise SystemExit("Streaming smoke backend failed; inspect its validated report.") from None
