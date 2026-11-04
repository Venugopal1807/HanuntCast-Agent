# Safe deployment plan

## Fastest free path (recommended for the hackathon): one mock-only container

Added 2026-11-04. The repository now builds a single container (`Dockerfile`) in which FastAPI serves the built frontend and the API from **one HTTPS origin**. You don't need nginx or a server you manage. The container is **public, mock-only** by construction: `DEPLOYMENT_MODE=public` and `VOICE_PROVIDER=mock` are baked in, startup refuses AssemblyAI in public mode, and no provider key, proxy token or ledger belongs in it. Real AssemblyAI speech reaches visitors only as **pre-generated, labeled static files** in `frontend/public/narration/`.

What the container guarantees (verified locally in production mode, see VALIDATION.md):

- CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (microphone off) and HSTS on **every** response, including `/healthz`.
- `/healthz` → `{"status":"ok"}`, no-store, no provider call. `/docs`, `/redoc`, `/openapi.json`, `/.env` and unknown `/api/*` → 404.
- The live stream route answers 503 ("Live voice is not configured"); `/api/*` still requires JWTs.
- `.dockerignore` keeps `.env`, ledgers, `release-private/`, recordings, test artifacts and `SESSION_REPORT.md` out of the build context.
- One worker. Stories are in memory, so run exactly **one instance**.

### Option A: Render (free web service, Docker)

The repository is public and `main` contains the release, so Render can build it directly:

**One-click:** [Deploy to Render](https://render.com/deploy?repo=https://github.com/Venugopal1807/HanuntCast-Agent) (sign in or create a free account, and keep the **Free** instance type; if Render asks for a payment method or any paid option, stop: that is outside the approved scope).

1. The link opens a Blueprint for `render.yaml`: one free Docker web service, one instance, `/healthz` check, public mock settings, auto-deploy from `main`. Alternatively: Dashboard → New → Blueprint → public repository URL.
3. When prompted for `JWT_SECRET`, paste a value generated **on your machine**. Don't use Render's "generate" option: its 44-character value fails the app's 48-character production minimum.
   `python -c "import secrets; print(secrets.token_urlsafe(48))"`
4. Leave `ASSEMBLYAI_API_KEY`, `TTS_LIVE_ACCESS_TOKEN` and `TTS_BUDGET_PATH` **unset**.
5. After the deploy: open `https://<service>.onrender.com`, check `/healthz`, play the narrator sample, finish one route, and repeat on a phone.

Render's free tier sleeps after about 15 idle minutes, and the first request then takes roughly a minute while the instance starts. The frontend's 15-second request deadline will report a slow first response; **Retry** works once the instance is awake. Before judging, open the site yourself to wake it, or point a free uptime monitor at `/healthz` every 10 minutes (one free service fits within Render's monthly free hours).

The repository includes `.github/workflows/keep-awake.yml`, which pings `/healthz` every 10 minutes (at minutes 07, 17 … 57 UTC) through 15 Nov 2026 India time, then disables itself. The last ping runs at 23:57 IST on 15 Nov. To turn it on, set the repository variable `RENDER_URL` to the service URL under Settings → Secrets and variables → Actions → Variables. Until that variable is set, every run exits without doing anything. GitHub can start scheduled runs late, so a rare cold start is still possible.

### Option B: Hugging Face Spaces (free Docker Space)

Create a Docker Space, set the Space secret `JWT_SECRET` (same generator) and the variable `PORT=7860`, and push this repository (the Space's README needs `sdk: docker` and `app_port: 7860` front matter). Spaces sleep after about 48 hours without traffic. The app sends `frame-ancestors 'none'`, so share the direct `https://<space>.hf.space` URL rather than the embedded huggingface.co page.

### Why not Vercel/Netlify static or serverless

The Vercel CLI is installed on the development machine but logged out. Serverless functions don't keep a process alive between requests, while this backend keeps anonymous stories in process memory. Requests landing on different instances would report "story expired". Making stories stateless (for example, signed story tokens) is possible but too large a change before the deadline.

### Known public-demo limits

- Rate limits and the session cap are per process. One owner keeps at most 5 stories (the oldest are evicted); the house holds 500 at most.
- Behind a platform proxy, uvicorn trusts `X-Forwarded-For` (`--forwarded-allow-ips '*'`, because only the platform's proxy can reach the container). A client can spoof that header to dodge the per-IP limit on anonymous sign-ins. In mock-only mode the impact is limited to availability, never cost.

## Self-hosted plan (nginx + systemd)

## Recommended topology and readiness boundary

Publish a **mock-only** site. Record or demonstrate live voice on a separate operator-restricted instance. No host has been selected or deployed in this task. The provided plan targets one Linux host with nginx, systemd and durable local disk; it needs no hosted database or paid infrastructure service beyond any existing host. Hosting charges are not assumed to be free. A static-only host cannot run this backend; Vite dev/preview proxy settings do not configure a production API.

Use a public static build and one public mock API worker under the same HTTPS origin. A second, restricted API binds a different loopback port. Keep the live site behind a VPN/IP allowlist or an equivalent authenticated private gateway. Never expose Uvicorn directly. The default restricted nginx sample uses a reserved documentation IP and therefore admits no actual visitors until an operator deliberately changes it. Do not use nginx Basic Auth over the API's Authorization header: it conflicts with the application's Bearer JWT.

If the chosen platform has ephemeral disks, multiple independent replicas or no reliable persistent mount, deploy **public mock mode only** there. Use a private local recording instance for live narration. Do not represent a process-local counter, autoscaling container filesystem or per-minute limiter as a durable spending cap.

## Paid-TTS controls

`DEPLOYMENT_MODE=public` rejects any voice provider other than mock. The public instance should have no provider key and no live proxy token. The public proxy strips any visitor-supplied `X-HauntCast-Live-Access` header.

All live streaming requests require an owned JWT session plus a separate `TTS_LIVE_ACCESS_TOKEN` of at least 48 characters. That token is injected by the restricted reverse proxy from a private file. It must never be sent by frontend source, stored in a VITE variable, returned in API responses, placed in a URL, or included in video captures. Network restrictions protect the private site, and the backend token prevents a header-spoofing bypass. Do not expose ports 8000/8001 through the firewall. Forwarded headers are accepted only from loopback; nginx replaces the client-supplied forwarding chain with `$remote_addr`.

Before opening either real HTTP or WebSocket transport, the provider reserves one attempt and the full input character count in `TTS_BUDGET_PATH`. SQLite BEGIN IMMEDIATE and FULL synchronous writes make the cumulative reservation atomic. The ledger contains the limits and totals, not an environment-reset counter. Failures/cancellation retain their reservation; there are no refunds or automatic resets. Missing, corrupt, locked, read-only or exhausted storage denies synthesis. Even direct local HTTP smoke synthesis uses this ledger. Route preflight denies unavailable budgets before opening a stream; the transport reservation is authoritative under concurrency. No budget-management or reset endpoint exists.

The limits bound this application's attempt/input volume, not an exact dollar amount or all usage of the provider account. Provider billing units/prices and other API-key users are outside the ledger. Use a dedicated key where possible and choose an allowance you approve. Deliberately deleting, replacing, restoring an older ledger or using a different file can defeat cumulative accounting; restrict host access. Do not run independent live replicas or separate live installations with separate ledgers against the same allowance. Rate limits remain abuse controls, not the synthesis budget.

## Environment

| Variable | Production requirement |
| --- | --- |
| `DEPLOYMENT_MODE` | `public` or `restricted`; `local` is only for development |
| `VOICE_PROVIDER` | Public: `mock`; restricted: `assemblyai` only when intentionally authorized |
| `STORY_PROVIDER` | `demo` |
| `JWT_SECRET` | Independent random secret, at least 48 characters; use the generator below. Missing, repeated-character and recognized placeholder secrets fail production startup |
| `ASSEMBLYAI_API_KEY` | Restricted server only; blank on public instance |
| `TTS_LIVE_ACCESS_TOKEN` | Independent private proxy secret, minimum 48 characters; blank on public instance |
| `TTS_BUDGET_PATH` | Existing ledger on durable local disk; never within the build/static root |
| `APP_PORT` | 8000 public / 8001 restricted in the templates |
| `ASSEMBLYAI_VOICE_*` | Archivist `aai-george`, Skeptic `aai-jane`, Medium `aai-audrey`; existing allowlist retained |
| `HAUNTCAST_LIVE_SMOKE`, `HAUNTCAST_LIVE_STREAM_SMOKE` | Keep `0` for release testing. Changing them does not grant paid-test authorization |

Use `/etc/hauntcast/public.env` and `/etc/hauntcast/restricted.env` outside the checkout; permissions 0600. `.env` is local development only and must not be shipped. Process environment takes precedence over dotenv. Public and restricted instances need different JWT secrets. A restart loses anonymous stories; a JWT is not an authenticated paid-user entitlement. Only the independent proxy/network control allows live use.

## Reproducible build and start

Prerequisites: Python 3.14 and Node 24 matching the validated environment, npm, nginx and systemd. The exact installed Python dependency snapshot is `backend/requirements.lock.txt`; frontend uses package-lock.json. Dependency installation on Linux and nginx/systemd configuration have **not** been executed in this Windows workspace. Run target-host installation and validation before release; do not substitute a claim of target-platform verification. No online vulnerability audit ran under the no-external-call constraint.

After reviewing and manually publishing a release commit, create a fresh versioned checkout on the target, for example `/srv/hauntcast/releases/RELEASE_ID`. Pin its Git revision and install there:

```bash
python3.14 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock.txt
.venv/bin/python -m pip check
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
cd ..
VOICE_PROVIDER=mock DEPLOYMENT_MODE=local HAUNTCAST_LIVE_SMOKE=0 HAUNTCAST_LIVE_STREAM_SMOKE=0 .venv/bin/python -m pytest backend/tests -q
.venv/bin/python tools/release_audit.py
```

Install browser dependencies and run Playwright on the target if supported; the repository defaults to installed Microsoft Edge. `HAUNTCAST_BROWSER_CHANNEL` can select another installed compatible channel for both Playwright and the rehearsal. The rehearsal selects the virtualenv Python path by platform. Only Windows execution was verified here; the Linux path and installed browser still need target-host validation. It must remain simulated; do not use `--live` as part of deployment.

An operator must create a dedicated unprivileged `hauntcast` user/group and the directories `/etc/hauntcast` and `/var/lib/hauntcast` before installing the service. Keep code read-only to the runtime user; only its state directory needs write access. Point `/srv/hauntcast/current` at the selected versioned release, retaining the previous target for rollback.

Create the public environment without printing or overwriting secrets:

```bash
sudo .venv/bin/python tools/create_release_env.py --mode public --output /etc/hauntcast/public.env
```

Install `deploy/hauntcast@.service` as `/etc/systemd/system/hauntcast@.service`, configure the public nginx template with your hostname and existing TLS certificate paths, and manually approve activation:

```bash
sudo systemctl daemon-reload
sudo nginx -t
sudo systemctl enable --now hauntcast@public
sudo systemctl reload nginx
curl --fail https://YOUR_PUBLIC_HOST/healthz
```

One worker per instance, no autoscaling: sessions, UUID receipts and active-stream state are process-local. The public service's mock audio is independent of the optional live service. No administrative route is installed. `/healthz` is intentionally unauthenticated, returns only `{"status":"ok"}`, and never initializes a provider connection or reports budget/secret details. It is a liveness check, not a provider readiness measurement. Validate story start/choices/mock WAV over HTTPS separately; health success alone is insufficient.

## Restricted live demonstration: explicit operator gate

These commands prepare configuration only. They authorize no synthesis; do not press live Play until a separate paid narration allowance has been approved.

```bash
sudo .venv/bin/python tools/create_release_env.py --mode restricted --output /etc/hauntcast/restricted.env --proxy-output /etc/hauntcast/live-proxy-secret.conf
# Edit only the private restricted.env to supply the provider key.
# Example allowance for operator review: 8 attempts / 12000 input characters TOTAL, not per day.
cd backend
sudo ../.venv/bin/python -m app.budget --path /var/lib/hauntcast/live-budget.sqlite3 --attempts 8 --characters 12000
cd ..
sudo chown -R hauntcast:hauntcast /var/lib/hauntcast
sudo chmod 700 /var/lib/hauntcast
```

Initialize only once, after confirming the absolute target path and durable storage. The CLI refuses to overwrite any existing file. No tool in this task initialized a real live allowance. Configure the restricted nginx host's trusted IP/VPN, certificate paths and private token include, run `nginx -t`, then start `hauntcast@restricted`. Do not add an anonymous route to the same upstream. A simpler alternative is a private local reverse proxy reached through an SSH tunnel/VPN, preserving the same token and budget requirements.

Keep DB, SQLite sidecars and directory writable only by the runtime user. Keep backups for audit but **never roll cumulative accounting backward**. A missing ledger is an incident and a denial, not permission to create a fresh allowance. Stop the restricted service before maintenance/backups. Disabling live service or switching its provider to mock and restarting is the immediate cost kill switch. No frontend control can reset the budget. If a live request fails, do not automatically retry: its reservation remains spent and synthesis may have been billed.

## HTTPS and streaming

Serve `frontend/dist`, never the repository root. SPA routes use nginx try_files; `/api/` preserves its path when proxied. The proxy disables response buffering, caching and gzip on streaming API traffic, keeps HTTP/1.1 and a 190-second read timeout. Backend streams use NDJSON, `X-Voice-Mode: live`, `X-Accel-Buffering: no` and no-store responses. Provider connect/frame/total waits remain 5/20/120 seconds; browser network deadline remains 180 seconds; intentionally paused playback has its own deadline. Keep any hosting/CDN/load-balancer limit at least as permissive or bypass it for streaming. Do not put a buffering CDN in front of private narration without testing.

The templates supply same-origin routing, TLS, frame protection, no-referrer and a CSP that allows only local scripts/connections and required inline styling/blob media. Enable HSTS only after validating your HTTPS domains and certificate renewal. Keep proxy/application access logs disabled for this demo and never log Authorization, private proxy headers, env files, narration or raw upstream exceptions. Web assets contain no secret env variables. Native device speech stays optional and local.

## Rollback

1. Stop `hauntcast@restricted` first. Keep the public mock service available where possible.
2. Record the existing `current` symlink target and the active revision. Choose a previously validated release that includes these paid-access/budget guards; do not roll back a live instance to the earlier unguarded baseline.
3. Point `current` at that known release; restart the public service and reload validated nginx configuration. Existing anonymous stories are lost; users must restart.
4. Recheck HTTPS health and the free mock story path. Keep restricted live disabled until its guard compatibility is confirmed.
5. Preserve private env files and the **same cumulative ledger and its current totals**. Never restore the ledger from an older code-release snapshot or reset paid-attempt markers.

If no guarded prior release exists, rollback means public mock-only operation, not enabling an old live build. No deployment/rollback command was executed here.
