# Agent notes — JS-Group Driver Mobile (Expo)

## Expo SDK

Expo **HAS CHANGED**. Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This app targets **Expo SDK 57** / React Native compatible with that SDK. Prefer `npx expo install <pkg>` so native module versions stay aligned.

## Project purpose

Driver-facing mobile client for JS-Group logistics. It consumes the Laravel Sanctum API at `/api/v1` (transport trips, checklist, stops, POD, proofs, DO/RRI PDF). Accounts are admin-provisioned — **no self-registration**.

## Source of truth for API ↔ mobile alignment

When changing API expectations or preparing a handoff for the **website / Laravel** repo, update and send:

**[`MOBILE_APP_HANDOFF.md`](MOBILE_APP_HANDOFF.md)**

That document includes:

- What mobile has already implemented (phase 1)
- Nested job / `line_items` / PDF contract
- **Production deploy gap:** `GET …/source-document.pdf` missing on codespace host (linked DO ≠ missing route)
- Product rule: stop complete ≠ DO delivered / RRI completed
- Datetime/timezone wall-clock display (`Asia/Kuala_Lumpur`)
- Backend follow-ups (deploy PDF route, job meta fields, today’s completed trips, ISO offsets, push)

## Local config

- `EXPO_PUBLIC_API_URL` — see `.env.example` (default `http://localhost:8000/api/v1`)
- Android emulator → `http://10.0.2.2:8000/api/v1`
- Physical device → `http://<LAN-IP>:8000/api/v1`

## Conventions for agents in this repo

- Prefer matching existing UI patterns (dark sparse driver UI, shared `JobDetailSections` / `JobLineItems`).
- Do not invent API endpoints not listed in `MOBILE_APP_HANDOFF.md`.
- Do not add “View on website” / portal session flows for drivers.
- i18n: update `en.json`, `zh.json`, and `ms.json` together.
- PDF: Bearer download to cache then WebView (`src/lib/source-document.ts`); never load authenticated PDF URLs directly in WebView.
- Dates/times: use `src/lib/format.ts` (wall-clock digits — do not reintroduce `Date` TZ shifts that turn 09:00 into 17:00).
