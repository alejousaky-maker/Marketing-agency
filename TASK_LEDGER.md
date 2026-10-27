# AgencyOS V1 implementation ledger

Scope: a working, tenant-isolated marketing analysis application. No paid-ad execution. Financial results are deterministic; observed, estimated and simulated inputs remain distinguishable.

## Work packages

- [done] Foundation: Next.js / TypeScript, PostgreSQL, schema, sessions, workspaces, authorization, audit events.
- [done] Client onboarding, products, offers and financial inputs with explicit missing values.
- [done] Private video upload, durable jobs, FFmpeg metadata/audio/scene sampling, OCR and optional AI provider.
- [done] Evidence-based creative scorecard, fingerprint, research, gaps, trends and recommendations; live semantic providers remain credential-dependent.
- [done] Financial model, scenarios, sensitivity, conservative decision rules and experiment lineage.
- [done] Polished dashboard and functional client, creative, intelligence, profitability, experiment, report and settings pages.
- [done] Explicit demo fixtures and end-to-end dry run.
- [done] Unit, financial, integration, API, upload, video, tenant-isolation and browser tests; visual QA.
- [done] Deployment, security, integration and model documentation; reusable environment configuration saved as a draft.

## Validation log

- Repository inspected: empty, unborn `work` branch, no existing source or instructions.
- Available: Node 24, npm 11, Docker, FFmpeg/ffprobe, Tesseract and Chromium.
- Architecture choice: modular monolith, Drizzle/PostgreSQL; PostgreSQL-backed durable jobs avoid an additional Redis service for V1. Private filesystem storage for local dry runs, S3-compatible adapter for deployment.
- Installed locked dependencies; PostgreSQL 17 started; migration and idempotent demo seed executed.
- FFmpeg/Tesseract processed the demo video, sampled keyframes, extracted audio and persisted a complete simulated analysis.
- Type checking passed. Initial unit suite: 106 passed; integration suite: 19 passed against real PostgreSQL and HTTP, including tenant isolation, durable processing and idempotent reruns.
- Browser workflow passed for demo review, all major screens, experiment creation, scenario save and report export. New-workspace onboarding and a real upload also passed with honest local-provider limitations.
- Desktop overview, analysis and mobile overview screenshots inspected. Mobile navigation test exposed a decorative plus sign in the accessible link name; corrected with aria-hidden.
- Direct DNS is unavailable in this managed environment. Implemented an explicit exact-host allowlist mode for its trusted egress proxy; direct mode retains DNS pinning and public-address validation. Source access must also satisfy the environment network policy.

## Completion policy

Record commands and actual outcomes below. Credential-dependent integrations must be explicit and tested with mocks; no fabricated competitor metrics or claims of live integration verification.

## Final verification

- Re-ran `bash scripts/setup.sh` after the environment resumed: existing configuration/data preserved, PostgreSQL restarted, migrations and seed completed without duplicate demo clients.
- `npm run check`: TypeScript passed; **117 tests passed** across financial formulas, decisions, untrusted uploads, real FFmpeg/OCR processing, authentication, SSRF controls, and mocked AI/search/S3 boundaries. The separately invoked 19 integration tests are intentionally skipped in this command.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: optimized production build passed with no build warnings. Runtime media paths are explicitly excluded from deployment tracing; no `.env` or `.data` files occur in server trace manifests.
- Started the production web process with `npm start` and the background process with `npm run worker`; `/api/health` confirmed PostgreSQL connectivity.
- Against the production server, `npm run test:integration`: **19 passed**. This includes real video processing, cross-tenant isolation, protected derived media, byte ranges, experiment lineage, conservative results, audited exports and idempotent retries.
- Against the production server, `npm run test:e2e`: **3 passed**. Complete simulated review across all primary pages; fresh account/client/economics/upload/processing/decision workflow; mobile navigation and no horizontal overflow.
- **139 automated tests passed in total.** Desktop overview, analysis and mobile screenshots were inspected; final production screenshots are in ignored `.data/qa-*.png`.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities** reported.
- Final review corrected MER to require separately supplied total business revenue, bounded implausibly tiny monetary inputs, preserved analysis currency/economics snapshots, added provider-proxy support, and hid decorative navigation text from accessible labels.
- Verified a real public page fetch through the approved proxy (`nodejs.org/en/about`). Arbitrary competitor domains still require administrator-approved research and network allowlists.
- Confirmed `.env`, `.data`, dependencies, build artifacts and test artifacts are ignored. No actual secrets were added to source.
- Saved complete `install_script` and `start_skill` fields through the cloud configuration tool. Persistence was confirmed. The user must review/save the environment settings and publish; publication and fresh-task restoration have **not** been claimed or performed.

## Remaining external configuration and deliberate V1 boundaries

- Live OpenAI and Brave Search require credentials and permitted network destinations; their integration boundaries were tested with mocks. The credential-free demo and real local-media processing workflow are verified.
- S3-compatible storage is implemented and SDK-boundary tested; live S3 verification requires a private bucket and credentials. Current media storage is private local filesystem storage.
- Real trend momentum requires longitudinal evidence. One collected page produces a candidate with unknown momentum, not invented numbers. Demo momentum values remain explicitly simulated.
- Gap output is evidence-linked, low-confidence test hypotheses, not confirmed competitor deficiencies. Ad/commerce/analytics/CRM imports and paid-ad execution remain intentionally outside V1.
- Production Compose/TLS deployment in an external infrastructure was not executed. The optimized Next.js build and production process startup were verified locally; deployment, security, backup and integration requirements are documented.

## Beginner-friendly local handoff

- Added `compose.demo.yaml`: a loopback-only Docker Desktop workflow that automatically creates its isolated PostgreSQL database, runs migrations and idempotent demo seeding, and starts web/worker. The demo account's password is generated in memory and never printed; the explicitly enabled local demo login is used instead.
- Added a complete Spanish walkthrough in `ABRIR_EN_TU_COMPUTADORA.md` and a portable source ZIP excluding private settings, media, database state, dependencies and build outputs.
- Validated Compose configuration and built the actual Docker image. The managed environment's TLS inspection initially blocked npm; an optional BuildKit CA secret restored proper certificate verification without disabling TLS or embedding the CA in the image.
- Started the new demo stack against a fresh, separate database and private media volume. Migration and seed exited successfully; PostgreSQL and the production web process became healthy; the background worker processed the seeded video.
- Verified browser demo login, all three seeded clients, completed creative analysis, sampled keyframes, the decision screen and actual video playback, with no browser errors.
