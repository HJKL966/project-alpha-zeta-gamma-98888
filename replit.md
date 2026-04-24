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
- Image OCR uses **tesseract.js** (Arabic + English) — no API keys required, runs fully local. See `src/lib/vision.ts`.
- Tesseract is externalized in `build.mjs` (it loads WASM and worker scripts dynamically).
- `parseTikTokIdentifier(text)` extracts: a TikTok URL, a long numeric ID, or a `@username` (Arabic letters supported, including diacritics). It also tolerates the OCR misreading "@" as "©".
- Worker is lazy-initialized once and reused for all requests.
