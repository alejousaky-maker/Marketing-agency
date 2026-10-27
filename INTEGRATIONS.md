# Integrations and evidence

## Local, credential-free workflow

FFmpeg, ffprobe and Tesseract run locally. Private filesystem storage is the default. Client-entered financial inputs drive deterministic forecasts. A user can supply a transcript at upload; its source is retained as user-provided, not independently verified. A real creative without a semantic provider receives a limited technical review and a conservative recommendation.

The demo workflow deliberately uses simulated creative judgments, competitor summaries and trends. It does not silently call live services or pretend that simulated observations were scraped from real brands. Demo URLs use reserved example domains and are labeled simulated.

## OpenAI

Set `OPENAI_API_KEY` securely in the server/worker environment. The web process exposes only configuration presence, never the value. The worker uses:

For managed cloud secret stores that reserve `OPENAI_*`, use `AGENCYOS_AI_KEY` instead. It takes precedence over `OPENAI_API_KEY`. Fixed-provider requests honor the injected HTTPS proxy with normal TLS verification; allow `api.openai.com` in the environment egress policy.

- `POST https://api.openai.com/v1/audio/transcriptions`, model `TRANSCRIPTION_MODEL` (default `whisper-1`). Audio is mono 16 kHz WAV, bounded by the three-minute video limit.
- `POST https://api.openai.com/v1/chat/completions`, model `OPENAI_MODEL` (default `gpt-4.1-mini`). At most 12 sampled images at low image detail, metadata, OCR, transcript and client context are sent.

The request explicitly treats uploaded content and client text as untrusted data. The response must satisfy the Zod schema, contain each scorecard key exactly once and keep timeline segments within the video. Missing or invalid responses fall back to limited local evidence with a warning. Landing-page congruence is unknown without landing-page evidence. Expensive successful responses are cached per tenant/content/context/model for seven days.

These API boundaries are verified with mock success, cached, invalid and rate-limited responses. No live OpenAI key was available during implementation. Real-provider quality, latency and account quotas need validation with your credentials. Obtain the client's authorization before sending their media to a third party.

## Brave Search

Set `BRAVE_SEARCH_API_KEY` to enable discovery at `https://api.search.brave.com/res/v1/web/search`. V1 requests up to five results within a recent monthly window and stores the returned URLs, titles, snippets and collection timestamps. Snippets are source observations, not verified facts. Follow-up public-page collection can enrich a snippet. No search result is treated as an advertisement performance metric.

`AGENCYOS_SEARCH_KEY` is the equivalent cloud-binding alias and takes precedence. Permit `api.search.brave.com` in the egress policy. Both aliases belong in server/worker secrets, never frontend environment variables.

Without this key, add public URLs manually in Market Intelligence. Never substitute fabricated search results for a missing key.

## Public URL collection and proxies

Direct mode permits HTTPS on port 443 only, without URL credentials. It resolves all DNS answers, rejects nonpublic ranges, pins the chosen address for the request, disables redirect following and caps response size/time. Provide the final URL when a site redirects. No login, private browsing session, CAPTCHA bypass or authenticated scraping is supported. Respect each site's terms and collection authorization.

Managed environments may require an outbound proxy and deny direct DNS. For those environments:

```dotenv
RESEARCH_USE_ENV_PROXY=true
RESEARCH_ALLOWED_HOSTS=nodejs.org,approved-client-domain.example
```

This uses the injected `HTTPS_PROXY`/`https_proxy`, requires an administrator-controlled exact-host list and forbids user-supplied proxy selection. The trusted proxy **must block private/reserved destinations and DNS rebinding at its egress**. Allow the same exact hosts in the environment network policy. Source URL input cannot expand either allowlist. Keep direct mode on ordinary deployments unless a suitable trusted proxy is configured.

The local setup approves `nodejs.org` solely for a real connectivity smoke test; it is not marketing evidence. Other websites are not silently enabled. The current environment denied `example.com` with HTTP 403 and allowed `nodejs.org/en/about` through its proxy. Adding competitor or trend sites requires appropriate administrative egress access.

Potential sources include authorized public TikTok Creative Center/Top Ads pages, Google Trends, YouTube, industry publications and client-owned analytics exports. V1 does not implement undocumented private APIs for these sources. A dated page can establish a candidate trend; it cannot establish velocity, acceleration, saturation, overlap or remaining lifespan on its own. Those fields remain unknown outside labeled demo fixtures.

## S3-compatible private storage

Set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION` and, for a non-AWS endpoint, `S3_ENDPOINT`. Supply `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` securely or use the AWS SDK's workload role chain. Buckets must be private; public ACLs and public-read policies are not required or created.

The adapter supports PutObject, GetObject and DeleteObject. Keys are generated beneath workspace/client/creative identifiers; user filenames never become storage paths. The application authorizes the tenant before retrieving video, audio or keyframes. Configure CORS only if you later implement direct uploads. Live S3 credentials were unavailable; the current instance uses private local files.

## Future read-only providers

`src/lib/providers.ts` defines context, provenance, sample sizes, attribution windows and read capabilities for Meta Ads, TikTok Ads, Google Ads, Shopify, GA4 and CRM. Unconnected adapters explicitly throw on reads. No OAuth flow, real provider import, campaign creation, budget change, publishing or paid-ad autopilot is implemented in V1.

Future records must include source scope, time window, currency, refund reconciliation and sample size. Never attach data to a workspace solely because a caller supplied an external client identifier. All connection-to-client mappings require tenant-scoped authorization.
