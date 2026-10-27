# AgencyOS

A working V1 marketing-analysis workspace built around **contribution profit**. Select a client, upload a video, and review creative evidence, market hypotheses, economics, variants and a controlled experiment proposal.

**New to development?** See [the step-by-step Spanish guide](ABRIR_EN_TU_COMPUTADORA.md). With Docker Desktop, `docker compose -f compose.demo.yaml up --build -d` starts a local-only demo with its database, seed and worker automatically.

## Start locally

Prerequisites: **Node 24**, Docker with Compose, FFmpeg/ffprobe and Tesseract. Chromium is needed for browser tests.

```bash
npm run setup
npm run dev
```

In a second terminal:

```bash
npm run worker
```

Open `http://localhost:3000`. Choose **Explore demo workspace**, or create a new agency account. Setup generates a private local demo password in the ignored `.env` file; it never publishes that password. The one-click demo is enabled only when explicitly configured and `APP_URL` is loopback. Do not enable it on a shared/public deployment.

The demo includes three clients, products, economics, competitor fixtures, dated trend fixtures and a generated 15-second video. The worker processes the video with real FFmpeg and OCR. Its creative and market judgments are **simulated and labeled**. No advertising account or payment is required.

## Implemented

- Email/password authentication, revocable hashed sessions, agency memberships, workspace switching, multi-client records and audit events.
- Client onboarding, primary product/offer and complete per-order economics. Missing profiles remain missing.
- Private MP4/MOV/WebM uploads, durable PostgreSQL jobs, bounded retries, leases and idempotent persisted results.
- FFmpeg metadata, audio, scene detection, at most 12 sampled keyframes, Tesseract OCR, optional OpenAI speech transcription and multimodal analysis.
- A 24-dimension explainable scorecard, timeline, creative fingerprint, single-variable variants and original → variant → experiment → result lineage.
- Public-source collection, dated provenance, an optional Brave Search boundary, competitor records, evidence-linked gap hypotheses and a conservative trend radar.
- Deterministic contribution margin, break-even CPA/ROAS, actual performance formulas, downside/base/upside scenarios, capacity limits and six-factor sensitivity analysis.
- Conservative recommendations, sample-size-aware experiment proposals, manual result capture and explicit inconclusive outcomes.
- Functional overview, client, creative, intelligence, profitability, experiment, report, integration and settings screens. JSON report export and print styles.
- A complete labeled dry run, automated tests and CI configuration.

## Evidence modes and honest limits

| Mode | What works | What it does not claim |
| --- | --- | --- |
| Demo client | Full workflow with simulated creative, competitor, trend and financial inputs; real media processing | Real campaign performance, actual competitor metrics or current trend momentum |
| Real client, no AI key | Real metadata, scene sampling, audio, OCR, supplied transcript, client economics, forecasts and conservative recommendations | Unobservable semantic criteria remain unscored; unknown narrative stages and attributes remain unknown |
| Real client, AI connected | Transcript and multimodal creative review with schema validation, temporal evidence and cached results | Creative scores do not guarantee performance; model judgments remain estimates |
| Public research | Public HTTPS sources, collection timestamps, actual excerpts; optional web discovery | Revenue/spend cannot be inferred from public creative; a single source cannot establish velocity or acceleration |

Live AI and search providers require credentials. Their integration boundaries are tested with mocks; credentials were not available for live provider verification. S3-compatible storage is implemented and tested at its SDK boundary; the local private storage workflow is exercised end to end. Meta, TikTok, Google Ads, Shopify, GA4 and CRM expose typed future read interfaces and show **not connected**; V1 neither imports their data nor spends money.

Gap output is a conservative set of hypotheses linked to source excerpts, **not an assertion that the market lacks a capability**. Trend metrics remain unknown for ordinary collected pages until longitudinal observations are available. All numerical demo trend values are simulated.

## Validation

```bash
npm run check                 # TypeScript + unit / financial / media / boundary tests
npm run test:integration      # Requires migrated DB, running web and worker
npm run test:e2e              # Requires seeded DB, running web, worker and Chromium
npm run build                # Production build
```

The default test run deliberately skips the separately invoked real-DB integration suite. See [TASK_LEDGER.md](TASK_LEDGER.md) for actual run outcomes and fixes, and [SETUP.md](SETUP.md) for browser installation and deployment.

Verified: **117 unit/media/provider tests, 19 PostgreSQL/API integration tests and 3 browser workflows passed**. The production build and local production startup passed, desktop/mobile visual QA completed, and the production dependency audit reported zero vulnerabilities. Live credential-dependent services are distinguished from mock-tested boundaries above.

## Project map

```text
src/app/                 Next.js routes, authentication pages and API boundary
src/components/          Responsive dashboard and interactive workflows
src/lib/finance.ts       Pure financial formulas and decision gates
src/lib/video.ts         Untrusted-media processing and temporal sampling
src/lib/intelligence.ts  Scorecard, provider adapter, gaps, trends and synthesis
src/lib/research.ts      Public-source collection, caching and SSRF controls
src/lib/jobs.ts          Durable worker leases, retries and idempotent writes
src/lib/services.ts      Tenant-scoped application services
src/lib/schema.ts        Drizzle query schema
migrations/             Canonical SQL schema and constraints
scripts/                Setup, migration, seeding and worker entrypoints
tests/                  Unit, integration and Playwright tests
```

Read [ARCHITECTURE.md](ARCHITECTURE.md), [FINANCIAL_MODEL.md](FINANCIAL_MODEL.md), [INTEGRATIONS.md](INTEGRATIONS.md) and [SECURITY.md](SECURITY.md) before extending the system. No ad autopilot is implemented.
