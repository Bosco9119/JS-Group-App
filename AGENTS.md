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
- Backend follow-ups (deploy PDF route, job meta fields, ISO offsets, push)
- **Phase 2 — Trip & job history — DONE (2026-08-05), matches the original spec.** Inbox includes today's `completed`; `GET …/trips/history` requires `from` (Y-m-d), accepts optional `to` (defaults to `from`) and `status`, caps the range at 31 inclusive days (`422` beyond that), and echoes the resolved `from`/`to` in `meta`. Schedule screen (`src/app/(app)/schedule.tsx`, drawer label **Trip History**) is a day-list preset picker (Today / Yesterday / Last 7 days / Last 31 days — no native date-picker dependency was added) wired against the live endpoint.
- **Driver profile photo & license info — DONE (2026-08-06).** `driver` payload (login/me/photo endpoints) now includes `license_number`/`license_expiry`. New `POST`/`DELETE /api/v1/profile/photo` (multipart upload, max 5MB) let a driver set/replace/remove their own photo — `uploadDriverPhoto()` / `removeDriverPhoto()` in `src/lib/driver-api.ts`, picker via `pickProfilePhoto()` in `src/lib/media.ts`. Shared `DriverAvatar` component (`src/components/driver-avatar.tsx`) renders the photo via `expo-image` and falls back to the original initials-circle design when `photo_url` is `null` — used on the Profile screen (tap avatar → change/remove) and the drawer header. Profile screen also shows IC number, phone, license number, and license expiry (flags expired in red).

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
- Trip/job history: implemented — see the Phase 2 status note above. `fetchTripHistory()` in `src/lib/driver-api.ts`; do not reintroduce `completed-trips-cache.ts` (deleted, no longer needed now the inbox returns today's completed trips directly).
- Driver photo: always render avatars via the shared `DriverAvatar` component (not a hand-rolled initials `View`) so the photo-vs-fallback logic stays in one place; `license_number`/`license_expiry` are admin-managed/read-only on mobile.
