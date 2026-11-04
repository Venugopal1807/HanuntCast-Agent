# Public, mock-only BLACKTHORN HOUSE: one container serves the built frontend and the API
# from the same HTTPS origin (platform-terminated TLS). No provider key belongs in this image.
FROM node:24-slim AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DEPLOYMENT_MODE=public VOICE_PROVIDER=mock STORY_PROVIDER=demo \
    FRONTEND_DIST=/app/frontend/dist PORT=8000 \
    HAUNTCAST_LIVE_SMOKE=0 HAUNTCAST_LIVE_STREAM_SMOKE=0
WORKDIR /app
COPY backend/requirements.lock.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.lock.txt
COPY backend/app backend/app
COPY --from=web /app/frontend/dist frontend/dist
RUN useradd --create-home --uid 10001 hauntcast
USER hauntcast
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/healthz', timeout=4)"
# One worker: stories are process-local. JWT_SECRET (>=48 random chars) must come from the platform's secret settings.
CMD ["sh", "-c", "exec uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port \"$PORT\" --workers 1 --proxy-headers --forwarded-allow-ips '*' --no-access-log"]
