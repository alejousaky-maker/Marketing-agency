# Setup, operation and deployment

## Local requirements

For a beginner-friendly local demo, Docker Desktop alone is sufficient. Follow [ABRIR_EN_TU_COMPUTADORA.md](ABRIR_EN_TU_COMPUTADORA.md), or run `docker compose -f compose.demo.yaml up --build -d`. That separate Compose file builds the app, migrates/seeds its own database and starts web/worker automatically. It binds only to loopback and enables the labeled demo. The prerequisites below apply to running directly on the host without this container bundle.

- Node.js **24.x** and npm (lockfile is committed).
- Docker Engine and Docker Compose v2 for PostgreSQL 17.
- `ffmpeg`, `ffprobe` and `tesseract` on PATH. Debian/Ubuntu packages: `ffmpeg tesseract-ocr`.
- Chromium for visual and end-to-end tests. `npx playwright install --with-deps chromium` installs Playwright's browser when a system Chromium is unavailable.
- A few GB of disk for dependencies, private media and PostgreSQL. The worker processes one upload at a time; 2 GB of worker memory is a reasonable starting limit.

Use the existing repository checkout. Cloud tasks already have isolated workspaces; do not create a Git worktree unless explicitly requested.

## Reproducible local setup

From the repository root:

```bash
bash scripts/setup.sh
```

The script creates `.env` only if absent, generates a local demo password, sets file mode 0600, installs the lockfile, starts PostgreSQL, waits for readiness, applies migrations and seeds the demo. It preserves existing `.env` values and does not reset the database. Running it again is supported. A changed database password is not applied to an already initialized PostgreSQL volume automatically.

The Compose database listens only on loopback port **54329**. The built-in local database password is exclusively a development default. Use a separate strong credential for deployment.

If dependencies are already installed and an external PostgreSQL instance is configured:

```bash
npm run db:migrate
npm run db:seed    # optional; requires DEMO_PASSWORD >= 10 characters
```

Start two persistent processes:

```bash
# Terminal 1, repository root
npm run dev
# Terminal 2, repository root
npm run worker
```

Open `http://localhost:3000` and choose **Explore demo workspace**. The generated 15-second video should transition from queued/processing to complete. Alternatively, register an account, create a client, configure its economics and upload a video. New clients are real/client-provided by default; only explicit seeded demo clients use simulated semantic output.

`APP_URL` must exactly match the browser's scheme, host and port for write requests. If using another hostname, set it in `.env` and restart the web process. `localhost` and `127.0.0.1` are different origins.

## Readiness and useful checks

```bash
curl --fail http://localhost:3000/api/health
npm run check
npm run test:integration
npm run test:e2e
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Health checks PostgreSQL connectivity; it does not prove the worker is alive. For functional readiness, log in and confirm a queued video reaches complete with sampled keyframes and a saved decision. The integration suite performs this workflow, plus cross-tenant reads/writes, private media authorization, range requests, financial calculations, experiment lineage and retry idempotence.

The default test suite includes real FFmpeg/Tesseract processing, and mocks only external provider boundaries. Integration tests are gated by `RUN_INTEGRATION=1`; `npm run test:integration` sets it. Run integration and browser tests only against a dedicated development/test database. Tests create temporary workspaces; the integration suite removes its own records. Browser tests create a test account and exercise demo experiment creation. They do not contact advertising platforms.

The Playwright configuration uses `CHROMIUM_PATH` if supplied, `/usr/bin/chromium` if present, otherwise the installed Playwright browser. Set `CI=true` only in an isolated CI container if Chromium requires `--no-sandbox`. Traces/screenshots from failures are in ignored `test-results/`; the HTML report is in `playwright-report/`. Visual QA screenshots are in ignored `.data/`.

## Production process deployment

1. Provision PostgreSQL 17, a private media volume shared by web/worker or a private S3 bucket, and Node 24 hosts with FFmpeg/Tesseract.
2. Set environment values through a secret manager. Use an HTTPS `APP_URL`, a production `DATABASE_URL`, `DEMO_MODE=false`, and storage settings. `.env` is optional when variables are injected.
3. Run `npm ci`, `npm run db:migrate`, `npm run build`.
4. Start `npm start` and `npm run worker` under a supervisor with restart policies. Put an HTTPS reverse proxy in front of port 3000, cap upload requests at 101 MB and set appropriate request timeouts. Keep the worker off the public network.
5. Register the initial agency owner through the application. Do not seed a public deployment unless you intentionally want a separate simulated workspace.
6. Back up PostgreSQL and object storage, test restoration, and monitor queue depth, stale leases, repeated failures, disk use and provider costs.

## Container deployment

The supplied Dockerfile runs as the non-root `node` user and includes FFmpeg/Tesseract. `compose.production.yaml` runs web, worker and PostgreSQL with private volumes and bounded worker resources.

For a managed network with a private TLS inspection CA, the Dockerfile supports an optional build-only secret named `npm_ca`. Supply your administrator-provided CA via `docker build --secret id=npm_ca,src=/path/to/trusted-ca.pem .`. This retains certificate verification and does not copy the CA into the image. Ordinary Docker Desktop installations do not need this option.

Create an untracked `.env.production` with at least:

```dotenv
POSTGRES_PASSWORD=<a-new-strong-password>
DATABASE_URL=postgresql://agencyos:<url-encoded-password>@postgres:5432/agencyos
APP_URL=https://your-agency-host.example
DEMO_MODE=false
STORAGE_DRIVER=local
STORAGE_PATH=/app/.data/storage
```

These are placeholders, not usable credentials. For S3, replace the storage settings and provide secure role credentials or secret variables. Then:

```bash
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml up -d postgres
docker compose --env-file .env.production -f compose.production.yaml run --rm web npm run db:migrate
docker compose --env-file .env.production -f compose.production.yaml up -d web worker
```

Terminate TLS in your reverse proxy and use the exact public HTTPS URL in `APP_URL`. The web service binds to host loopback. Container startup does not apply migrations automatically. For hardened deployments, isolate media processing further with a dedicated restricted worker network, runtime sandbox and explicit storage/provider egress.

The local production Next.js build and startup are exercised during implementation. The production Compose definition is supplied for deployment; do not treat a local build as proof that your cloud network, TLS, backups or external credentials are configured.

## Restoring a cloud snapshot

Installed dependencies, ignored local media and configuration may be retained in the snapshot. Live processes are not. From the repository root, start PostgreSQL with `docker compose up -d postgres`, verify readiness, and start web and worker. Use `npm ci` and migrations when manifests/schema change. Do not assume Docker volumes are retained by every platform; the demo seed regenerates the fixture if starting with a new database. An environment snapshot is not a database backup.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Login cannot reach the database | `docker compose ps`, `DATABASE_URL`, port 54329 and migration status |
| Write returns 403 | Browser Origin must match `APP_URL`; source requests also need allowed research and network hosts |
| Creative stays queued | Start `npm run worker`; inspect its sanitized logs and the jobs table |
| Processing fails | Validate media size/duration/format, ensure FFmpeg and Tesseract are installed, then use Retry analysis |
| Missing semantic scores | Configure OpenAI or provide human evidence; local OCR cannot judge authenticity or claims reliably |
| Research fails DNS or CONNECT | Use the managed proxy mode and exact-host allowlist described in INTEGRATIONS.md; retain TLS verification |
| Trend momentum is unknown | Collect longitudinal data; one dated page does not justify growth claims |
| Build on a resource-constrained host | Stop the dev process first; the worker can be supervised separately; preserve enough memory for Next.js compilation |
| Native media tools absent in a deployment | Use the supplied runtime image or install the documented OS packages |

Never disable TLS, signature or checksum verification to work around setup problems.
