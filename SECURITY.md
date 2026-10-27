# Security model

## Authentication and workspace boundaries

- Passwords use Node's scrypt with independent random 16-byte salts and 64-byte derived keys. Passwords are 10–128 characters. Comparisons use constant-time buffers.
- Sessions are random 256-bit opaque tokens. Only SHA-256 token hashes are stored, with seven-day expiry. Cookies are HttpOnly, SameSite=Lax, path-scoped and Secure for an HTTPS `APP_URL`.
- Every authenticated request rechecks workspace membership. Workspace switching requires membership; owner-only settings and member addition check the role server-side.
- Every write requires the configured application Origin. Mutations do not use GET, except report downloads append an audit event. CORS is not broadly enabled.
- PostgreSQL rate limits protect account authentication, registration, tenant writes, uploads and research. They survive web restarts; production should additionally use trusted edge limits against distributed abuse.
- No passwords, session tokens or API keys are returned in bootstrap data or saved analysis payloads. Logs avoid raw provider errors, request bodies and environment values.

There is no email verification, self-service recovery, SSO or MFA in V1. Deploy registration behind organizational access controls if those are required. Do not use the loopback-only one-click demo in a public/shared environment. Tenant members can create and analyze client data; owners can additionally administer the workspace.

## Tenant isolation

Authorization is enforced in application services and HTTP handlers with the session's workspace ID. All user-controlled record IDs are validated UUIDs. Parameterized queries and composite foreign keys protect references. `getClient`, `getCreative`, assets, reports, variants, forecasts and experiments scope access by tenant; cross-tenant requests return not found.

Database row-level security is not enabled in V1. The database credential is a trusted application credential, not a per-user credential. A new unscoped query would be a security defect; retain the service boundary and add tenant-isolation tests for every new endpoint. For organizations requiring database-enforced RLS, add transaction-scoped tenant context and RLS policies before deployment, including a deliberate worker role design.

## Uploaded media

- Maximum body: 100 MB media plus bounded multipart overhead. Accepted extensions/signatures: MP4, MOV and WebM. An extension or MIME alone is not trusted.
- ffprobe verifies a video stream, duration up to 180 seconds, dimensions up to 4096 per side, supported container and frame rate up to 120 fps.
- Files live outside `public/`, use generated keys and private filesystem permissions (directories 0700, files 0600), and can only be read through authenticated tenant-scoped routes.
- Child processes use argument arrays, not a shell. FFmpeg protocols are restricted to local file/pipe inputs, threads are bounded, subprocess timeouts and output buffers are capped, and temporary working directories are removed in `finally`.
- At most 12 sampled frames reach the multimodal provider. Audio and keyframes remain private objects.
- Video delivery supports authenticated byte ranges. `nosniff`, frame denial, object denial and a restrictive referrer policy are configured.

These controls do not eliminate native decoder vulnerabilities. Keep FFmpeg/Tesseract and OS images patched, run as a non-root user, restrict worker resources and network access, and use an additional media sandbox for hostile internet-scale uploads. The supplied production worker drops Linux capabilities, limits process count/CPU/memory and sets no-new-privileges. It is not a dedicated malware scanner.

## Public-source collection and SSRF

Direct collection allows HTTPS without credentials on port 443 only. It checks all DNS results against public-unicast ranges using `ipaddr.js`, pins the selected IP to prevent rebinding between validation and connection, does not follow redirects, does not attach application cookies, and caps content to 1 MB and network timeouts. HTML is converted to text; scripts are never executed. React escapes stored source content and no raw HTML rendering is used.

Proxy mode is opt-in via `RESEARCH_USE_ENV_PROXY=true`. The administrator must supply exact `RESEARCH_ALLOWED_HOSTS`; user input cannot change the list or choose a proxy. The proxy must itself resolve DNS safely and block all private/reserved targets. This is an explicit trust boundary, not a replacement for proxy-side SSRF protection. Keep this mode disabled for arbitrary proxies. Enforce the same destination policy at the infrastructure egress layer. Source redirects remain disabled in both modes.

Fetched content, transcripts, OCR and model output are untrusted data. The model receives explicit instructions not to follow content instructions; structured output is validated before persistence. This reduces but does not eliminate prompt-injection risk. Model text can never invoke tools, alter economics, access other tenants or publish campaigns.

## Secrets and deployment

Keep secrets in your runtime secret manager or ignored environment files with restricted permissions. `.gitignore` and `.dockerignore` exclude `.env*`, except the placeholder `.env.example`. Never copy `.env` into an image or client-side `NEXT_PUBLIC_*` variables.

Use TLS and an exact HTTPS `APP_URL` in production, a strong database password, restricted database access and private storage policies. `compose.yaml` is for local development only; its loopback database password is deliberately not a production secret. The deployment example requires a separately supplied password.

The security headers include frame-ancestors/object-src/base-uri restrictions. A full nonce-based script CSP, SSO/MFA, security event alerting and automated retention/deletion policies are not implemented. Configure them to match your organization's production requirements rather than assuming they exist.

## Data handling and retention

V1 retains uploads, audio, frames, transcripts, client economics, analyses, audit events and expired cache rows until an administrator removes them. It does not silently delete client assets. Define contractual retention, encryption, regional storage and backup policies before using sensitive client media. Cache expiry limits reuse, not physical retention. Add scheduled removal of expired sessions/rate limits/cache records at the deployment layer.

Report JSON includes sensitive business information, so downloads require tenant authentication and are audited. Exports have no public share token. Audit events are application records, not cryptographically immutable logs.

Provider connections send media/context only when configured. Confirm legal authority and client consent. Future third-party integrations must preserve tenant mappings and provenance. There is no paid-ad execution or automatic spending path in this codebase.
