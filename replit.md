# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## TikTok Telegram Bot — Image Lookup

- The Telegram bot in `artifacts/api-server/src/lib/bot.ts` accepts photos and extracts a TikTok identifier.
- Image OCR uses **OCR.space API** (https://ocr.space/ocrapi) — free tier 25,000 requests/month, no server-side CPU/RAM cost. Designed for free hosting tiers (Render Free, Railway, etc.).
- Requires `OCR_SPACE_API_KEY` env var (free key from https://ocr.space/ocrapi/freekey).
- See `src/lib/vision.ts`. Calls Arabic OCR engine first; falls back to English if no identifier is parsed.
- `parseTikTokIdentifier(text)` extracts: a TikTok URL, a long numeric ID, or a `@username` (Arabic letters supported, including diacritics). Tolerates OCR misreading "@" as "©".

## Telegram Bot — Polling vs Webhook

The bot supports two modes (selected automatically):

1. **Webhook mode** (recommended for Render Free, Heroku-style hibernating hosts): set both `WEBHOOK_URL` (e.g. `https://my-bot.onrender.com`) and `WEBHOOK_SECRET` (random string) env vars. The bot auto-registers the webhook on startup. Endpoint: `POST {WEBHOOK_URL}/api/telegram/webhook`. No 409 Conflict possible; service wakes on each Telegram update.
2. **Polling mode** (fallback): if either var is missing, the bot uses long polling. Suffers `ETELEGRAM 409 Conflict` if more than one instance polls the same token simultaneously (e.g. during Render Free hibernate→wake transitions).

For a banned/Arabic-handle TikTok account, share the profile URL — the bot extracts the `secUid` (`MS4wLjABAAAA...`) from the URL and bypasses the public API restriction by HTML-scraping that endpoint directly.
