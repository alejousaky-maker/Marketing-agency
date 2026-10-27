#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export npm_config_cache="${TMPDIR:-/tmp}/agencyos-npm-cache"
for tool in node npm docker ffmpeg ffprobe tesseract; do command -v "$tool" >/dev/null || { echo "Required tool missing: $tool" >&2; exit 1; }; done
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  node --input-type=module - <<'JS'
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
let content=fs.readFileSync('.env','utf8').replace('DEMO_PASSWORD=','DEMO_PASSWORD='+randomBytes(24).toString('base64url')).replace('DEMO_MODE=false','DEMO_MODE=true');
if(process.env.HTTPS_PROXY||process.env.https_proxy)content=content.replace('RESEARCH_USE_ENV_PROXY=false','RESEARCH_USE_ENV_PROXY=true').replace('RESEARCH_ALLOWED_HOSTS=','RESEARCH_ALLOWED_HOSTS=nodejs.org');
fs.writeFileSync('.env',content,{mode:0o600});
JS
fi
npm ci --no-audit --no-fund
docker compose up -d postgres
for attempt in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U agencyos -d agencyos >/dev/null; then break; fi
  if [ "$attempt" = 30 ]; then echo 'PostgreSQL did not become ready' >&2; exit 1; fi
  sleep 1
done
npm run db:migrate
npm run db:seed
echo 'Setup complete. Start npm run dev and npm run worker in separate terminals.'
