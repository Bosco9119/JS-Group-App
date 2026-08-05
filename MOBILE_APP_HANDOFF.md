# JS-Group Driver Mobile ↔ Laravel API Handoff

> **Audience:** Laravel / website ERP team (and Cursor agents in that repo).  
> Copy this document into the JS-Group website project when aligning or changing `/api/v1` transport endpoints.
>
> **Mobile app repo:** Expo SDK 57 driver client (`JS-Group-App`). Phase-1 day flow is **implemented** against this API.
>
> Scope: keep the **existing** Sanctum driver API stable. Do **not** invent mobile self-registration.
>
> **Pre-trip checklist API is live** — mobile gates Start Trip on `can_clock_in` / checklist all pass.
>
> **DO/RRI on stops is live** — trip/job payloads include line items + source document meta; mobile opens on-demand PDF (Bearer → cache → WebView + share/download). Completing a stop does **not** mark the ERP Delivery Order / Rental Return as delivered/completed (office does that).
>
> **Phase 2 — IMPLEMENTED (2026-08-05):** Trip & job **history** is live end-to-end (Laravel `GET /api/v1/transport/trips/history` + mobile Schedule screen, now labelled **Trip History**), matching the original 2026-07-28 ask: required `from`, optional `to` (defaults to `from`), optional `status`, 31-inclusive-day cap (`422` beyond that), `meta.from`/`meta.to` echoed back. One deliberate addition beyond the original spec: the `status` filter also accepts `cancelled` (the original enum only listed `completed`/`planned`/`in_progress`, which would have made cancelled trips unreachable via that filter). Mobile's Schedule screen uses day-list preset chips (Today / Yesterday / Last 7 days / Last 31 days) rather than a native date picker — no new native dependency was added. See [Phase 2 — Trip & job history](#phase-2--trip--job-history-backend-ask) for the full contract.
>
> **Action required on production (2026-07-24):** `GET /api/v1/transport/jobs/{id}/source-document.pdf` is implemented in the Laravel repo but **not deployed** on `onex.com.my`. Drivers see linked DO numbers (e.g. TJ-2026070003 → DO26-07JSH004) but PDF open fails with Laravel “route could not be found”. **Deploy the route + controller before mobile PDF will work against that host.** See [Production deploy gap — source document PDF](#production-deploy-gap--source-document-pdf).

---

## Production deploy gap — source document PDF

Verified against live API (`EXPO_PUBLIC_API_URL=https://onex.com.my/api/v1`) with `driver1@jsgroup.com`:

| Check | Result |
|---|---|
| Trip job `TJ-2026070003` (`job.id` = **52**) | Present; `job_type` = `rental_return` |
| `delivery_order_nos` | `["DO26-07JSH004"]` — **document is linked** |
| Nested meta: `document_no`, `document_status`, `source_type`, `source_id`, `has_source_document_pdf` | **Missing** from live trip payload (local Laravel `FormatsDriverTripPayload` may also still omit these — add them) |
| `GET /api/v1/transport/jobs/52/source-document.pdf` | **404** — `"The route api/v1/transport/jobs/52/source-document.pdf could not be found."` |

This is **not** “job has no DO/RRI”. The morph/link exists (cargo + `delivery_order_nos`). Production simply does not register the PDF route yet.

### What to deploy on the website / Laravel server

1. **Route** (already in local `routes/api.php` under Sanctum `driver-app`):

```php
Route::get('transport/jobs/{transportJob}/source-document.pdf', [TransportJobSourceDocumentController::class, 'show'])
    ->name('api.v1.transport.jobs.source-document');
```

2. **Controller** — `App\Http\Controllers\Api\V1\TransportJobSourceDocumentController`  
   - Authorize assigned driver via `TransportJobPolicy::view`  
   - Resolve `$transportJob->sourceable`  
   - If `DeliveryOrder` or `RentalReturnIn` → Chromium PDF (same print views as ERP)  
   - Else → **404** with message like “This job has no linked delivery order or rental return document.”  
   - Optional `?download=1` → `Content-Disposition: attachment`

3. **After deploy, confirm:**

```http
GET /api/v1/transport/jobs/52/source-document.pdf
Authorization: Bearer {driver-app token}
Accept: application/pdf
```

Expect `200` + `Content-Type: application/pdf` (not a JSON “route could not be found”).

4. **Also ship nested job meta** in `FormatsDriverTripPayload::jobPayload` (mobile + handoff already expect these):

| Field | Rule |
|---|---|
| `source_type` | `delivery_order` \| `rental_return_in` \| `null` |
| `source_id` | morph id or `null` |
| `document_no` | DO `delivery_no` or RRI `return_no` |
| `document_status` | source status or `null` |
| `has_source_document_pdf` | `true` when source is DO or RRI |

Until (4) is live, mobile still shows **View document** when `delivery_order_nos` is non-empty or job type is delivery / rental return (fallback). Prefer the explicit flag once deployed.

### Error semantics mobile already handles

| HTTP / body | Driver-facing meaning |
|---|---|
| `404` + message contains `route … could not be found` | PDF **API not deployed** (ops/deploy issue) |
| `404` + “no linked delivery order or rental return” | Job truly has no printable source |
| `403` | Not this driver’s job |
| `200` + PDF bytes | Open in WebView + share/Download |

---

## Mobile implementation status (as of handoff)

Phase-1 driver UX is shipped in the Expo app. Gaps are only under **Blocked** / **Known client workarounds** / **Nice-to-have backend follow-ups**.

| Area | Mobile status | Notes |
|---|---|---|
| Login / logout / me | Done | SecureStore token; no register UI |
| Today’s trip inbox + Home | Done | Labels: Next job / **Current trip** / Today’s trip |
| Trip detail + Start / End | Done | Checklist gate; end when all stops terminal |
| Pre-trip checklist (15 items) + photos | Done | Read-only after trip start |
| Stop arrive / complete + POD | Done | ≥1 photo; optional signature; geo; `client_uuid`. UI: **Start job** / **Complete job** |
| Cargo `line_items` (DO + RRI) | Done | DO packaging/condition; RRI good/repair/damage/scrap always shown (read-only) |
| Document badge + PDF View/Download | Done (client) | **Blocked on production** until PDF route is deployed (see deploy gap). UI: View when flag / linked DO nos / DO·RRI job type; else “No document PDF available” |
| Stop **Start job** / Complete | Done | UI label **Start job** = stop clock-in (commission start). **Complete job** = POD clock-out. Next job does not auto-start; prompt or trip **Start next job** |
| Proof gallery | Done | List / upload / delete |
| i18n | Done | en / zh / ms |
| Push / assignment ack | Stub only | **No API yet** |
| Trip / job history | **Done** | `GET /transport/trips/history` (`from`/`to`/`status`/pagination, 31-day cap) + Schedule screen (relabelled **Trip History**, day-list presets, taps into existing trip detail) — see [Phase 2](#phase-2--trip--job-history-backend-ask) |
| Documents drawer | Stub | PDF opens **from job/stop**, not drawer |

### Critical product rule (do not get this wrong)

| Layer | What mobile POD changes | What mobile does **not** change |
|---|---|---|
| **Transport** | Stop → `completed`, job → `completed`, trip can clock out | — |
| **ERP document (DO / RRI)** | — | Status stays as office left it. **No** auto DO `delivered`, **no** auto RRI `completed` |

Drivers deliver/return against the document shown on the job. If actual qty differs, **office edits the DO/RRI in the ERP** — the app does not edit document quantities. Mobile copy states this explicitly after stop complete.

---

## Datetime / timezone alignment (important)

Laravel `APP_TIMEZONE` = **`Asia/Kuala_Lumpur`**.

Mobile displays API date/times as **wall-clock digits** from the string (same spirit as ERP date helpers), **without** converting `Z` / `+00:00` through the phone’s local zone. That avoids the common bug: website shows **09:00**, phone showed **17:00** (+8h).

| Field style | Example | Mobile behaviour |
|---|---|---|
| Time-only | `09:00` / `09:00:00` | Show `09:00` as-is |
| Date-only | `2026-07-24` | Show calendar date from digits |
| ISO datetime | `2026-07-24T09:00:00.000000Z` or `…+00:00` / `…+08:00` | Show **09:00** (digits before offset), not device-shifted |

**Backend ask (preferred long-term):** serialize datetimes with an offset that matches business time (e.g. `+08:00` for MYT wall clock), or document clearly whether values are true UTC instants. Until then, mobile will keep wall-clock display so ERP and app stay visually aligned.

---

## Known client workarounds (website should know)

1. ~~**Completed trips missing from inbox**~~ — **Resolved 2026-08-05.** `GET /transport/trips` now includes today's `completed` trips directly; the local same-day cache workaround (`src/lib/completed-trips-cache.ts`) has been removed from mobile. Past days are available via `GET /transport/trips/history`.
2. **PDF auth** — WebView cannot send Bearer headers. Mobile downloads `GET …/jobs/{id}/source-document.pdf` with Sanctum into cache, then opens locally (+ share sheet for Download).
3. **PDF route missing on some hosts** — if Laravel returns “route could not be found”, mobile shows a deploy-oriented error (not “no DO linked”). See [Production deploy gap](#production-deploy-gap--source-document-pdf).
4. **Expo Go Android** — push via `expo-notifications` is avoided on Expo Go Android; use a custom/dev client for real push later.
5. **Standalone / no source** — `line_items: []`, `has_source_document_pdf: false`; UI falls back to `items_description` and shows “No document PDF available”.
6. **Missing `has_source_document_pdf` on older payloads** — mobile treats non-empty `delivery_order_nos` or delivery / rental_return job type as PDF-capable until the flag is always present.

---

## Backend alignment checklist (for website changes)

When changing transport APIs, keep mobile working:

- [ ] Nested `job` still includes: `document_no`, `document_status`, `source_type`, `source_id`, `has_source_document_pdf`, `delivery_order_nos`, `line_items` (DO + RRI shapes), `latitude` / `longitude`
- [ ] **PDF route is registered and deployed:** `GET /api/v1/transport/jobs/{transportJob}/source-document.pdf` (Bearer → binary PDF). Confirm with a real linked job (e.g. RRI with `delivery_order_nos`) — must not return “route could not be found”
- [ ] PDF uses nested **transport `job.id`**, not `source_id`
- [ ] Stop complete still does **not** auto-close DO/RRI
- [ ] Checklist still exactly 15 keys; `can_clock_in` only when planned + all passed
- [ ] Prefer datetime serialization that matches Malaysia wall clock (see timezone section)
- [x] Return today’s `completed` trips in inbox so mobile can drop local cache — done 2026-08-05
- [x] Ship trip history endpoint — done 2026-08-05 as `GET /transport/trips/history` (`from`/`to`/`status`/pagination, 31-day cap — see [Phase 2 — Trip & job history](#phase-2--trip--job-history-backend-ask) for the full contract)

---

You are maintaining the **Laravel `/api/v1` driver API** consumed by the Expo driver app. The sections below remain the contract.

## Non-negotiables

- **Login only.** There is **no register**, no public signup, no self-service password reset on the mobile API.
- Accounts are **provisioned by admin** in the ERP (Driver create/edit → enable app access: email + password). The user must have:
  - An active `users` record
  - Linked `drivers.user_id`
  - Permission `driver_app.access` (role **Driver**)
- Auth uses **Laravel Sanctum** personal access tokens named `driver-app`.
- Send `Authorization: Bearer {token}` on all authenticated requests.
- `Accept: application/json` — API always returns JSON for `api/*` (except the PDF endpoint, which returns `application/pdf`).
- Do **not** assume endpoints that are not listed below exist. Many transport features exist only in the **admin ERP** (web/Inertia), not on the mobile API.

## Demo credentials (seeded environments)

- `driver1@jsgroup.com` / `password`
- `driver2@jsgroup.com` / `password`
(Requires logistics + transport seeders that link drivers to those users.)

---

## Product flows (implemented on mobile)

### Day flow against current API

1. **Login** — email + password only. Token in SecureStore. No “Create account”.
2. **Session** — `GET /auth/me` on launch if token exists; logout clears token + `POST /auth/logout`.
3. **Today’s trip inbox** — `GET /transport/trips` (+ local completed-trip merge).
4. **Trip detail** — `GET /transport/trips/{driverTrip}` (stops + job + nested `checklist`).
5. **Pre-trip checklist** — all items must pass before Start Trip (`can_clock_in`).
6. **Start trip** — `POST …/clock-in` (`planned` → `in_progress`); `422` if checklist incomplete.
7. **Start job (stop clock-in)** — `POST …/stops/{tripStop}/clock-in` (commission start). UI: **Start job**.
8. **Stop detail / cargo** — `job.line_items` + document / linked DO nos; read-only qty.
9. **View DO/RRI PDF** — when linked (`has_source_document_pdf` / `delivery_order_nos` / DO·RRI type). Requires deployed `source-document.pdf` route.
10. **Complete stop / POD** — ≥1 photo multipart; optional signature, received-by, notes, geo, `client_uuid`. Next job does not auto-start.
11. **End trip** — dialog → `POST …/clock-out` when all stops terminal.
12. **Proof gallery** — list / upload / delete completion-proof photos.

### Blocked / incomplete without new backend work

| Driver need | Status |
|---|---|
| ~~**Trip / job history** (yesterday+, Schedule)~~ | **Done 2026-08-05** — see [Phase 2](#phase-2--trip--job-history-backend-ask) |
| Push / assignment requests / dynamic insert acknowledge | **Missing API** |
| Helper pairing, vehicle picker | **Not on mobile API** |
| Edit DO/RRI line qty from the app | **Out of scope** (ERP only) |
| Offline queue / sync protocol | **Partial**: `client_uuid` idempotency on photo upload only |
| DO/RRI PDF on production host | **Deploy gap** — route not registered on codespace host (see § Production deploy gap) |

**Day flow:** checklist → start trip → stops (cargo + optional PDF) → end trip. Stop clock-in/complete require trip `in_progress`. Clock-out requires all stops `completed` / `skipped` / `failed`.

---

## Domain model (mobile-relevant)


```
User 1──1 Driver (drivers.user_id)
Driver 1──* DriverTrip (assigned driver_id)
DriverTrip 1──1 VehicleChecklist (pre-trip)
DriverTrip 1──* TripStop (ordered)
TripStop *──1 TransportJob
TransportJob 0..1── morph sourceable ── DeliveryOrder | RentalReturnIn | (none)
TransportJob 1──* TripPhoto (completion_proof)
```

Statuses (simplified):

- **Trip:** `planned` → (checklist all pass) → `in_progress` (mobile trip clock-in) → `completed` (mobile trip clock-out)
- **Stop:** `pending` → `arrived` (clock-in) → `completed` (complete + photos)
- **Job:** … → `assigned` → `in_progress` (on stop clock-in) → `completed` (on stop complete)
- **Checklist:** items `{ key, label, passed, notes }`; overall `passed` only when every item `passed === true`
- **DO / RRI document status:** independent of job/stop; office changes it in ERP

Job types (ERP): `delivery`, `rental_return`, `warehouse_transfer`, `standalone`.

| `job_type` | Typical source | PDF? |
|---|---|---|
| `delivery` | Delivery Order | Yes when linked |
| `rental_return` | Rental Return In | Yes when linked |
| `warehouse_transfer` / `standalone` | Often none | No (`has_source_document_pdf: false`) |

---

## API base

- Prefix: `/api/v1`
- Base URL: whatever host this Laravel app is served on (local: http://localhost:8000 with `php artisan serve`, or your Apache vhost).
- Mobile client: `EXPO_PUBLIC_API_URL` (see mobile app `.env.example`). Defaults to `http://localhost:8000/api/v1`.
  - Android emulator: `http://10.0.2.2:8000/api/v1` (or `http://10.0.2.2/api/v1` if Apache on host :80)
  - Physical device: `http://<LAN-IP>:8000/api/v1` (or host vhost)

### Auth (public + authenticated)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public, throttle `6,1` | Issue Bearer token |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke **current** token |
| `GET` | `/api/v1/auth/me` | Bearer | Current user + driver profile |

#### `POST /api/v1/auth/login`

Request JSON:

```json
{ "email": "driver1@jsgroup.com", "password": "password" }
```

Success `200`:

```json
{
  "token": "<plainTextToken>",
  "token_type": "Bearer",
  "user": { "id": 1, "name": "...", "email": "..." },
  "driver": {
    "id": 1,
    "name": "...",
    "ic_number": "...",
    "phone": "...",
    "status": "active",
    "status_label": "Active",
    "photo_url": null
  }
}
```

Failures (validation-style on `email`): wrong credentials; inactive user; no linked driver; missing `driver_app.access`.

On success the server **deletes prior tokens** named `driver-app` then creates a new one (single active mobile session per user).

#### `GET /api/v1/auth/me`

Same `user` + `driver` shape. `403` if no linked driver. `401` if no/invalid token.

#### `POST /api/v1/auth/logout`

```json
{ "message": "Logged out." }
```

---

### Transport actions (authenticated)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/transport/trips` | Today’s inbox for the linked driver (now also includes today’s `completed`) |
| `GET` | `/api/v1/transport/trips/history` | **Live.** Paginated, most-recent-first, requires `from` (`to`/`status` optional, 31-day cap) — see history section |
| `GET` | `/api/v1/transport/trips/{driverTrip}` | Trip detail with ordered stops + job summary + checklist |
| `POST` | `/api/v1/transport/trips/{driverTrip}/clock-in` | Start trip (`planned` → `in_progress`) when checklist passed |
| `POST` | `/api/v1/transport/trips/{driverTrip}/clock-out` | End trip (`in_progress` → `completed`) when all stops done |
| `GET` | `/api/v1/transport/trips/{driverTrip}/checklist` | Load (or auto-create) pre-trip checklist |
| `PUT` | `/api/v1/transport/trips/{driverTrip}/checklist` | Submit all checklist items |
| `POST` | `/api/v1/transport/trips/{driverTrip}/checklist/photos` | Upload optional checklist photos (multipart) |
| `GET` | `/api/v1/transport/jobs/{transportJob}/proof-photos` | List completion-proof photos |
| `POST` | `/api/v1/transport/jobs/{transportJob}/proof-photos` | Upload 1–10 images (multipart) |
| `DELETE` | `/api/v1/transport/jobs/{transportJob}/proof-photos/{tripPhoto}` | Delete one proof photo |
| `GET` | `/api/v1/transport/jobs/{transportJob}/source-document.pdf` | On-demand DO/RRI PDF (`?download=1` for attachment) |
| `POST` | `/api/v1/transport/stops/{tripStop}/clock-in` | Start job at stop (status → arrived; job → in_progress) |
| `POST` | `/api/v1/transport/stops/{tripStop}/complete` | Complete stop with proof |

> **Route order:** register `trips/history` **before** `trips/{driverTrip}` so `history` is not captured as an id.

Authorization: assigned linked driver of the trip (`driver_app.access` + matching `driver_id`) may act. Trip show/clock-in/clock-out use `DriverTripPolicy`. Failed/cancelled jobs deny proof manage.

#### Trip inbox — `GET .../trips`

Returns `{ "data": [ trip payloads ] }` for the authenticated driver’s own trips where:

- `planned_date` is today and status is `planned`, `in_progress`, or `completed`, **or**
- status is `in_progress` (covers overnight trips still open)

**Current behaviour (since 2026-08-05):** today's `completed` trips are included directly. Mobile no longer keeps a local cache after clock-out — `src/lib/completed-trips-cache.ts` was removed. Past days are not in this list; use `GET …/trips/history` instead.

Each trip payload includes: `id`, `trip_no`, `status`, `status_label`, `planned_date`, `planned_start`, `planned_end`, `actual_start`, `actual_end`, `vehicle`, stop counts, nested `checklist` (`passed`, `checked_at`, `checked_by_driver_id`, `items[]`, `photo_urls[]`), `can_clock_in` (true only when planned **and** checklist `passed`), `all_stops_done`, `can_clock_out`, and `stops[]` with nested `job`:

| Nested `job` field | Notes |
|---|---|
| `id`, `job_no`, `job_type`, `job_type_label`, `status`, `status_label` | Always present |
| `customer_name`, `address_text`, `contact_person`, `contact_no` | Stop-scoped (pickup vs delivery); delivery blanks fall back to pickup |
| `items_description`, `special_instructions` | Job snapshot text |
| `started_at`, `completed_at` | ISO8601 or null |
| `source_type` | `delivery_order` \| `rental_return_in` \| `null` |
| `source_id` | Source document id, or `null` |
| `document_no` | DO `delivery_no` or RRI `return_no`, or `null` |
| `document_status` | Source document status value, or `null` |
| `has_source_document_pdf` | `true` when source is DO or RRI (use PDF endpoint below) |
| `delivery_order_nos` | `string[]` — DO `delivery_no` when morph source is a Delivery Order; linked DO no. when source is RRI with `delivery_order_id`; else `[]` |
| `line_items` | From source DO/RRI (`sku` from `product.sku_code`, `name` from `product.name` with fallback to DO/RRI item code); `[]` for standalone. **DO:** `{ sku?, name, qty, uom?, packaging?, condition?, description? }`. **RRI:** `{ sku?, name, qty, uom?, description?, quantity_expected, quantity_good, quantity_repair, quantity_damage, quantity_scrap }` (`qty` = expected) |
| `latitude`, `longitude` | Site pin from stop-scoped `CustomerAddress`; `null` when missing |

Built by `FormatsDriverTripPayload` (`app/Http/Controllers/Api/V1/Concerns/FormatsDriverTripPayload.php`). No portal URLs.

---

## Phase 2 — Trip & job history (backend ask)

> **Status (2026-08-05): IMPLEMENTED — matches the spec below**, with one deliberate addition. Everything under this heading is the **original 2026-07-28 spec** and it reflects what actually shipped:
>
> - `GET /api/v1/transport/trips/history` — `from` required (`Y-m-d`), `to` optional (defaults to `from`), `page` (default 1), `per_page` (default 20, max 50), `status` optional. Range capped at 31 inclusive days — `422` on `to` when exceeded. Sorted `planned_date` desc, `planned_start` desc, `id` desc (tie-break).
> - **Addition beyond the original spec:** the `status` filter accepts all four `TripStatus` values including `cancelled` — the original enum below (`completed`/`planned`/`in_progress`) would have left cancelled trips unreachable via this filter even though they're clearly historical.
> - Response `meta` is `{ from, to, current_page, last_page, per_page, total }` — `from`/`to` echo the resolved (validated) range back to the caller, exactly as specced.
> - Mobile Schedule screen (relabelled **Trip History**) uses day-list preset chips (Today / Yesterday / Last 7 days / Last 31 days) computing `from`/`to` client-side, then paginates within that range via infinite scroll. This satisfies the spec's "date picker **or** day list" — no native date-picker dependency was added.
> - Trip show (`GET /transport/trips/{id}`) already worked for past/completed trips with no changes needed — confirmed by `DriverTripPolicy::view()` having no status gate, only ownership.
> - Inbox today's-`completed` change (section A below) shipped exactly as asked.
>
> **Product goal:** Drivers can review **past trips and their jobs** (e.g. yesterday), not only today’s inbox. Native-only — no “View on website”.

### Why a new endpoint (not only inbox)

| Surface | Purpose | Date scope |
|---|---|---|
| `GET /transport/trips` (inbox) | Active day: planned / in progress / **today’s completed** | Today (+ overnight `in_progress`) |
| `GET /transport/trips/history` | Browse past work | Explicit `from` / `to` (or single day) |

Do not load weeks of history into the inbox. Keep Home/Jobs fast.

### Job history vs trip history

Domain is **trip → ordered stops → job**. Mobile job history is the jobs nested under past trips (`stops[].job`).

- **Primary:** trip history list + existing `GET /transport/trips/{id}` for detail (stops, cargo, document meta, proofs still via proof endpoints / PDF).
- **Optional later:** flat `GET /transport/jobs/history` only if product needs a Jobs-tab list without grouping by trip. **Not required for v1 of history** if trip show already returns nested jobs.

### A) Inbox — include today’s completed

Change `GET /api/v1/transport/trips` so the driver’s list also includes:

- `planned_date` = **today** (`APP_TIMEZONE` = `Asia/Kuala_Lumpur`) **and** `status` = `completed`

Keep existing rules for `planned` / `in_progress` / overnight. Same trip payload shape. No pagination required for inbox (still one day).

### B) History — `GET /api/v1/transport/trips/history`

| Concern | Detail |
|---|---|
| Auth | Bearer Sanctum `driver-app`; same as other transport routes |
| Scope | **Only** trips where `driver_id` = linked driver. Never other drivers’ trips |
| Method / path | `GET /api/v1/transport/trips/history` |
| Route name (suggested) | `api.v1.transport.trips.history` |
| Register before | `trips/{driverTrip}` so `history` is not treated as an id |

#### Query parameters

| Param | Required | Rules |
|---|---|---|
| `from` | **Yes** | Date `Y-m-d` (Malaysia calendar day). Filter on trip `planned_date` |
| `to` | No | Date `Y-m-d`, default = `from`. Must be ≥ `from` |
| `page` | No | Integer ≥ 1 (default 1) |
| `per_page` | No | Integer 1–50 (default **20**) |
| `status` | No | Optional filter: `completed`, `planned`, `in_progress`, or omit for all in range |

**Range cap:** reject with `422` if (`to` − `from`) > **31** days (inclusive span). Message e.g. “Date range may not exceed 31 days.”

**Empty result:** `200` with `data: []` (not 404).

#### Success response

Same **trip list payload** as inbox (`FormatsDriverTripPayload`), paginated:

```json
{
  "data": [ /* trip payloads: id, trip_no, status, planned_date, vehicle, stops[]+job, checklist, … */ ],
  "meta": {
    "from": "2026-07-27",
    "to": "2026-07-27",
    "current_page": 1,
    "per_page": 20,
    "total": 3,
    "last_page": 1
  }
}
```

**Sort:** `planned_date` DESC, then `planned_start` DESC (or `trip_no` DESC as tie-break).

**Payload depth:** Prefer the **same nested `stops[].job`** (including `line_items`, document meta) as trip show/inbox so mobile can reuse cards. If that is too heavy for long ranges, a slimmer list row is acceptable **only if** `GET /transport/trips/{id}` still returns the full shape for drill-in — document which fields are omitted in the list.

#### Errors

| HTTP | When |
|---|---|
| `401` | Missing/invalid token |
| `403` | No linked driver / no `driver_app.access` |
| `422` | Invalid `from`/`to`, `to` < `from`, range > 31 days, bad `status` / pagination |

### C) Trip show for past trips

Existing `GET /api/v1/transport/trips/{driverTrip}` must keep working for **completed** (and other) trips assigned to this driver — including days before today — so history can open detail.

| Action on a past / completed trip | Expected |
|---|---|
| `GET` trip show | `200` if assigned |
| Clock-in / clock-out / checklist PUT / stop clock-in / stop complete | Still `422` (or current lock rules) — history is **read-only** for finished work |
| Proof list / PDF view | Allowed if assigned (read); upload/delete only if product already allows on that job status |

### D) Mobile plan (after API is live)

| Screen | Behaviour |
|---|---|
| Schedule / History (replace Coming soon) | Day-list preset chips (Today / Yesterday / Last 7 days / Last 31 days) → `GET …/trips/history?from=&to=&page=&per_page=`, infinite scroll within the selected range |
| Trip detail (from history) | Same screen; hide Start/End/checklist edit when not actionable |
| Jobs tab / history | Derive jobs from trip `stops[]`; optional flat jobs API later |
| Home / Jobs inbox | Use API today’s `completed`; remove `completed-trips-cache` workaround |

### Website DoD (history)

- [x] Inbox includes today’s `completed` for assigned driver — done 2026-08-05
- [x] `GET /api/v1/transport/trips/history` with `from` / `to` / pagination / 31-day cap — done 2026-08-05, matches the spec exactly (plus `cancelled` added to the `status` filter enum, see status note above)
- [x] Route registered **before** `{driverTrip}`; feature tests cover assigned-only scoping + date-range filtering + ordering + `status` filter + empty-range 200 + required-`from` 422 + range-cap 422 + 31-day-boundary 200 + `per_page` pagination + unauthenticated/no-driver 401/403 (`tests/Feature/DriverMobileTripInboxTest.php` in the Laravel repo)
- [x] Trip show still returns full payload for past completed trips — confirmed, no change was needed
- [x] No portal URLs; no other drivers’ data — confirmed (`where('driver_id', ...)` scoping, same pattern as inbox)

---

### Jobs, DO/RRI, and PDF (read this before building stop UI)

**What to show on stop / job detail**

1. Address, contact, special instructions (always).
2. Document badge when linked: `document_no` + `job_type_label` (e.g. Delivery / Rental return). Prefer `document_no` over digging into `delivery_order_nos` for the primary label; keep `delivery_order_nos` as secondary (RRI may list a linked DO number).
3. **Cargo table** from `line_items` (empty for standalone jobs — fall back to `items_description` text).
4. **View document** button when `has_source_document_pdf === true`, or (fallback) non-empty `delivery_order_nos` / delivery·rental_return job type. Requires deployed PDF route on the API host.

**Example — Delivery Order job (abbreviated `stops[].job`)**

```json
{
  "id": 42,
  "job_no": "TJ-2026070001",
  "job_type": "delivery",
  "job_type_label": "Delivery",
  "status": "assigned",
  "customer_name": "ACME SDN BHD",
  "address_text": "12 Jalan Demo, KL",
  "contact_person": "Receiver",
  "contact_no": "0123456789",
  "source_type": "delivery_order",
  "source_id": 15,
  "document_no": "DO26-07JSH001",
  "document_status": "confirmed",
  "has_source_document_pdf": true,
  "delivery_order_nos": ["DO26-07JSH001"],
  "line_items": [
    {
      "sku": "MF-5G10-25",
      "name": "5'10\" Main Frame 2.5mm thk",
      "qty": 10,
      "uom": "pcs",
      "packaging": "Bundle",
      "condition": "new",
      "description": "Taller main frame for scaffolding system, 2.5mm thickness"
    }
  ],
  "latitude": 3.139,
  "longitude": 101.6869
}
```

**Example — Rental Return job line item**

```json
{
  "sku": "MF-5G10-25",
  "name": "5'10\" Main Frame 2.5mm thk",
  "qty": 10,
  "uom": "pcs",
  "description": null,
  "quantity_expected": 10,
  "quantity_good": 0,
  "quantity_repair": 0,
  "quantity_damage": 0,
  "quantity_scrap": 0
}
```

For RRI, show **expected** as the driver’s pick-up qty (`qty` / `quantity_expected`). Condition columns (good/repair/damage/scrap) may be zero until warehouse fills them in ERP — still display them if useful; do not require the driver to edit them.

**Standalone / no source**

```json
{
  "source_type": null,
  "source_id": null,
  "document_no": null,
  "document_status": null,
  "has_source_document_pdf": false,
  "delivery_order_nos": [],
  "line_items": []
}
```

Use `items_description` / `special_instructions` only.

#### Source document PDF — `GET .../jobs/{transportJob}/source-document.pdf`

On-demand Chromium PDF of the linked DO or RRI (same layout as ERP print). **Never** the empty handwriting RRI template. Draft DOs may show a DRAFT watermark (same as ERP).

> **Deploy gate:** This route must exist on the host the mobile app points at (`EXPO_PUBLIC_API_URL`). If missing, Laravel returns JSON `404` “route … could not be found” even when `delivery_order_nos` is populated. See [Production deploy gap](#production-deploy-gap--source-document-pdf).

| Concern | Detail |
|---|---|
| Auth | Same Bearer token as other APIs (`ability:driver-app`) |
| Route (exact) | `GET /api/v1/transport/jobs/{transportJob}/source-document.pdf` |
| Controller | `TransportJobSourceDocumentController@show` |
| When to call | Prefer `has_source_document_pdf === true`; use nested `job.id` as `{transportJob}`. Mobile also opens when `delivery_order_nos` is non-empty (fallback for older payloads) |
| Success | `200` body = raw PDF bytes; `Content-Type: application/pdf` |
| Inline viewer | Default (no query) → `Content-Disposition: inline` |
| Download | `?download=1` → `Content-Disposition: attachment; filename="..."` |
| Errors | `403` not your job; `404` no DO/RRI morph linked; **route missing** → JSON “route could not be found” (deploy issue) |
| Freshness | Always regenerated from current ERP data — no stale cached file |

Suggested UX: primary **View document**; secondary **Download**. Show a loading state (Chromium can take a few seconds). On weak networks, prefer fetch-on-tap rather than preloading every stop’s PDF.

**Mobile client behaviour (implemented):** download with Bearer into app cache (`src/lib/source-document.ts`), open in WebView, Download via system share sheet. Do not rely on WebView loading the remote URL with cookies. Distinguish deploy 404 vs “no linked document” 404 in UI copy.

**Reminder:** Completing the stop updates **transport** only. Office marks DO delivered / finishes RRI after qty checks.

### Common confusions (quick answers)

| Question | Answer |
|---|---|
| Does stop complete = DO delivered? | **No.** Transport job/stop complete only. |
| Can the driver change line qty in the app? | **No.** Show cargo; office edits DO/RRI in ERP if needed. |
| Which id for the PDF URL? | Nested `job.id` (transport job), **not** `source_id` (DO/RRI id). |
| JSON vs PDF response? | All APIs return JSON except `source-document.pdf` → binary PDF. |
| Why are RRI good/repair/damage/scrap often 0? | Warehouse fills those in ERP; driver uses **expected** qty for the run. |
| When is there no PDF button? | No linked source: empty `delivery_order_nos`, no `document_no`, `has_source_document_pdf === false`, not DO/RRI type. |
| Linked DO but PDF 404 “route could not be found”? | **Deploy** `source-document.pdf` on that host — the DO link is fine; the route is missing. |
| Linked DO but PDF 404 “no linked … document”? | Morph `sourceable` missing/wrong on that transport job — fix data or seeder, not mobile. |

#### Trip show — `GET .../trips/{driverTrip}`

Same trip payload shape for one trip. `403` if not the assigned driver (and not ERP editor).
#### Pre-trip checklist — `GET .../trips/{driverTrip}/checklist`

Returns `{ "data": checklist payload }`. Creates a fresh unchecked checklist from the 15 default items if none exists yet.

```json
{
  "data": {
    "passed": false,
    "checked_at": null,
    "checked_by_driver_id": null,
    "items": [
      { "key": "tyre", "label": "Tyres", "passed": null, "notes": null }
    ],
    "photo_urls": []
  }
}
```

Fresh items use `passed: null` (unchecked). After PUT, each item `passed` is `true` or `false`. Overall `passed` is `true` only when **every** item has `passed === true`.

#### Pre-trip checklist update — `PUT .../trips/{driverTrip}/checklist`

JSON body must include **all 15** default keys exactly once (no missing, no extras, no duplicates):

```json
{
  "items": [
    { "key": "tyre", "label": "Tyres", "passed": true, "notes": null },
    { "key": "brake", "label": "Brakes", "passed": true, "notes": null }
  ]
}
```

| Field | Rules |
|---|---|
| `items` | required array, **size must be 15** |
| `items.*.key` | required; must be one of the 15 keys below |
| `items.*.label` | required string (use the labels from GET / defaults) |
| `items.*.passed` | required **boolean** (`true` or `false` — not null on submit) |
| `items.*.notes` | optional string, max 1000 |

- Sets `checked_at`, `checked_by_driver_id` (linked driver), and overall `passed`
- Only while trip is `planned` (no `actual_start`); otherwise `422` on `checklist` (“locked after trip start”)
- Response `{ "data": checklist payload }`

#### Checklist photos — `POST .../trips/{driverTrip}/checklist/photos` (`multipart/form-data`)

- Field name: `photos[]` (array), required for this call, 1–10 images, each max **10240** KB
- Photos are **optional for the day flow** — trip can clock-in without any photos
- Only while trip is `planned`; otherwise `422`
- Response `201`: `{ "data": checklist payload }` with updated `photo_urls`

#### Trip clock-in — `POST .../trips/{driverTrip}/clock-in`

No body required. Trip must be `planned` with no `actual_start`, and **checklist must be passed** or `422`:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "checklist": [
      "Complete and pass the pre-trip vehicle checklist before starting this trip."
    ]
  }
}
```

Response on success `{ "data": trip payload }` with `status: in_progress`, `can_clock_in: false`.

#### Trip clock-out — `POST .../trips/{driverTrip}/clock-out`

No body required. Trip must be `in_progress`, and **every stop must be terminal** (`completed` / `skipped` / `failed`) or `422`. Reuses `DriverTripService::clockOut` (sets trip `completed`, `actual_end`, driver available). Response `{ "data": trip payload }` with `status: completed`.

#### Proof photo list — `GET .../proof-photos`

```json
{ "data": [ /* TripPhoto.toProofPayload() */ ] }
```

Proof payload fields:
`id`, `transport_job_id`, `driver_trip_id`, `trip_stop_id`, `photo_type`, `photo_type_label`, `photo_path`, `photo_url`, `caption`, `sort_order`, `taken_at` (ISO8601), `source` (`admin`|`mobile`), `client_uuid`, `latitude`, `longitude`.

#### Proof photo upload — `POST .../proof-photos` (`multipart/form-data`)

- `photos[]` — required, 1–10 images, each max **10240** KB
- `caption` — optional string max 500
- `taken_at` — optional date
- `client_uuid` — optional UUID (**idempotent**: re-upload same uuid returns existing)
- `latitude` / `longitude` — optional
- `source` — optional `admin`|`mobile` (default treat as `mobile`)
- `driver_trip_id` / `trip_stop_id` — optional ints

Response `201`: `{ "data": [ proof payloads ] }`

#### Proof photo delete — `DELETE .../proof-photos/{tripPhoto}`

```json
{ "message": "Proof photo deleted." }
```

Only `completion_proof` photos belonging to that job.

#### Stop clock-in — `POST .../stops/{tripStop}/clock-in`

No body required. Trip must be `in_progress`. Response:

```json
{
  "data": {
    "stop": {
      "id": 1,
      "status": "arrived",
      "status_label": "...",
      "actual_arrival": "<ISO8601>"
    },
    "job": {
      "id": 1,
      "job_no": "TJ-...",
      "status": "in_progress",
      "status_label": "...",
      "started_at": "<ISO8601>"
    }
  }
}
```

#### Stop complete — `POST .../stops/{tripStop}/complete` (`multipart/form-data`)

- `photos[]` — **required**, min 1, max 10, image max 10240 KB each
- `signature` — optional image max **5120** KB
- `proof_received_by` — optional string
- `notes` — optional string
- `taken_at`, `client_uuid`, `latitude`, `longitude`, `source` — same idea as proof upload

If stop not yet arrived, backend **auto clock-in** then completes. Response includes updated stop, job, and `proof_photos` array.

---

## Screen map (implemented on mobile)

1. **Login** — email/password; map validation errors from `email` field.
2. **Home / trips inbox** — `GET /transport/trips`; pull-to-refresh; Current trip / Next job / Today’s trip headings; stop list with status chips.
3. **Trip detail** — checklist status; **Start trip** only when `can_clock_in`; tighter stop cards + cargo preview; Navigate hidden when stop finished.
4. **Pre-trip checklist** — 15 items; optional photos; read-only after start.
5. **Stop detail** —
   - Document badge (`document_no` + job type); secondary linked DO nos when useful
   - Cargo from `job.line_items` (or `items_description`); read-only qty hint
   - **View document** → in-app PDF when linked (flag / DO nos / DO·RRI type); else muted “No document PDF available”
   - **Start job** / **Complete job** (trip must be `in_progress`); Call / SMS / Navigate when actionable
6. **Document PDF** — Bearer download to cache → WebView; Download via share sheet; deploy-missing vs no-doc errors.
7. **Job proofs** — gallery list/add/delete.
8. **Schedule / History** — **Done 2026-08-05.** Day-list preset chips call `GET …/trips/history?from=&to=` (infinite scroll within the selected range); taps into the existing trip detail screen read-only (clock-in/out buttons naturally don't render since `can_clock_in`/`can_clock_out` are false on finished trips).

Do not build on mobile: registration, forgot-password, ERP dispatcher, editing DO/RRI quantities.

---

## Pre-trip checklist — contract (mobile already follows)

**Backend is ready.** Mobile inserts checklist **before** Start Trip and gates clock-in on `can_clock_in` / `checklist.passed`.

### Required UX flow


```
Trip detail (status: planned)
        │
        ▼
Pre-trip checklist screen
  • Load GET …/checklist (or use nested trip.checklist)
  • Driver marks each of 15 items Pass / Fail (+ optional notes)
  • Save → PUT …/checklist
  • Optional: POST …/checklist/photos
        │
        ▼
Enable “Start trip” only when checklist.passed === true
  (or when trip.can_clock_in === true after refresh)
        │
        ▼
POST …/clock-in
```

Hard rules:

1. **Do not allow Start Trip** while `can_clock_in` is `false` (even if the local UI shows all toggled — trust the API after save + trip refresh).
2. **Every item must pass** (`passed: true`). One fail / unchecked after save → overall `passed: false` → clock-in `422`.
3. Photos are optional; do not block Start on missing photos.
4. After the trip is `in_progress`, checklist is **read-only** (PUT/photos return `422`). Hide edit controls; show completed summary only.
5. Non-assigned driver: `403` on checklist / trip actions.

### Nested trip fields (inbox + show)

Every trip payload already includes:

```ts
checklist: {
  passed: boolean | null;
  checked_at: string | null;          // ISO8601
  checked_by_driver_id: number | null;
  items: Array<{
    key: string;
    label: string;
    passed: boolean | null;           // null = not checked yet (fresh)
    notes: string | null;
  }>;
  photo_urls: string[];
} | null;

can_clock_in: boolean; // true only when planned AND checklist.passed === true
```

If `checklist` is `null` on trip show/inbox (trip created before checklist exist), call `GET …/trips/{id}/checklist` once — the API **auto-creates** the 15 unchecked items.

### Exact 15 items (keys + labels)

Use these labels in UI; do not invent keys.

| # | `key` | `label` |
|---|---|---|
| 1 | `tyre` | Tyres |
| 2 | `brake` | Brakes |
| 3 | `lights` | Front Lights |
| 4 | `reverse_light` | Reverse Light |
| 5 | `horn` | Horn |
| 6 | `mirror` | Mirrors |
| 7 | `engine_oil` | Engine Oil |
| 8 | `coolant` | Coolant / Water |
| 9 | `fire_extinguisher` | Fire Extinguisher |
| 10 | `first_aid` | First Aid Kit |
| 11 | `cleanliness` | Vehicle Cleanliness |
| 12 | `fuel_level` | Fuel Level |
| 13 | `mileage` | Mileage Recorded |
| 14 | `cargo_secured` | Cargo Area Secured |
| 15 | `documents` | Vehicle Documents |

### Suggested client behaviour

| Screen / action | Implement |
|---|---|
| Trip detail (planned) | Banner or row: “Vehicle checklist required” if `!can_clock_in`. Primary CTA: **Open checklist**. Disable **Start trip** until `can_clock_in`. |
| Checklist screen | List 15 switches/Pass-Fail; optional notes per row. Prefill from GET. Primary **Save checklist** → `PUT`. Secondary **Add photos** (optional). After successful PUT with `passed: true`, enable Start (or navigate back and refresh trip). |
| Save (PUT) | Always send **all 15** items with `passed: true\|false` (never omit an item; never send `null` for `passed` on PUT). |
| Photos | `FormData` with `photos[]` file parts. Show thumbs from `photo_urls` (may be relative to `APP_URL` / storage). |
| Start trip | `POST …/clock-in` only if `can_clock_in`. On `422.errors.checklist`, open checklist again with the message. |
| After start | Trip detail shows checklist as completed/read-only; stop list becomes actionable. |

### Local UI state tip

While editing, you can track “all local toggles true”, but **do not** treat that as authority to clock-in. Always:

1. `PUT` checklist  
2. Prefer refresh `GET` trip (or use PUT response `data.passed`)  
3. Clock-in only when `passed === true` / `can_clock_in === true`

### Error mapping (checklist)

| HTTP | Meaning | App action |
|---|---|---|
| `401` | Bad/missing token | Re-login |
| `403` | Not assigned driver | Show “Not your trip” |
| `422` `items` | Missing/duplicate keys or bad shape | Fix payload (must be exactly 15 unique keys) |
| `422` `checklist` | Locked after start, or clock-in without pass | Show message; block edit / open checklist |
| `422` `photos` / `photos.*` | Invalid files | Show validation |

### App team — checklist DoD

- [x] Checklist screen reachable from planned trip detail
- [x] Renders all 15 items from API (key/label); Pass/Fail + optional notes
- [x] `PUT` sends full 15-item array; shows overall passed/failed from response
- [x] Optional photo upload via `photos[]`; gallery from `photo_urls`
- [x] **Start trip** disabled until `can_clock_in === true`
- [x] Clock-in handles `422` on `checklist` gracefully
- [x] Checklist edit hidden/locked when trip is `in_progress` / `completed`
- [x] Works with `EXPO_PUBLIC_API_URL` against this Laravel host

---

## Backend reference (JS-Group repo — do not reimplement)


- Routes: `routes/api.php`
- Controllers: `app/Http/Controllers/Api/V1/Auth/DriverAuthController.php`, `DriverTripController.php`, `VehicleChecklistController.php`, `TransportJobProofPhotoController.php`, `TransportJobSourceDocumentController.php`, `TripStopClockInController.php`, `TripStopCompleteController.php`
- Services: `DriverUserAccountService`, `VehicleChecklistService`, `TransportJobProofService`, `DriverTripService`, `ChromiumPdfRenderer`, `DeliveryOrderPrintData`, `RentalReturnInPrintData`
- Policies: `DriverTripPolicy`, `TransportJobPolicy`
- Tests: `tests/Feature/DriverMobileAuthTest.php`, `DriverMobileTripInboxTest.php`, `DriverMobileChecklistTest.php`, `TransportJobProofPhotoTest.php`, `TransportJobSourceDocumentPdfTest.php`
- Docs: `docs/ARCHITECTURE.md` §5.17

## Explicit out of scope for the mobile client repo

- Admin ERP CRUD, dispatcher board, commission
- Creating drivers/users (admin only)
- Calling web/Inertia admin routes with session cookies

## Definition of done (phase 1)

### Backend API (Laravel) — ready

- [x] Login / logout / me with Sanctum `driver-app` token
- [x] Trip inbox + show with nested `checklist` + `can_clock_in`
- [x] Pre-trip checklist GET/PUT + optional photos; clock-in gated on all items passed
- [x] Trip clock-out when all stops done
- [x] Stop clock-in + complete with ≥1 photo
- [x] Proof photo list/upload/delete
- [x] Enriched job `line_items` + source document meta (**ensure production payload includes meta fields**)
- [x] On-demand DO/RRI PDF controller + route in repo (`GET .../source-document.pdf`)
- [ ] **Production/staging host has PDF route deployed** (verified 2026-07-24: codespace host still missing — see deploy gap)

### Mobile client app — implemented

- [x] Login / logout / me with secure token storage; no registration UI
- [x] Trip inbox + trip detail (+ local completed-trip cache for same-day ended trips)
- [x] Pre-trip checklist screen + Start-trip gate
- [x] Trip clock-in / clock-out
- [x] Stop clock-in (**Start job**) + complete (**Complete job**) with ≥1 photo; optional start-next prompt
- [x] Cargo / line items on stop detail (`job.line_items` + document no.; DO/RRI fields)
- [x] View DO/RRI PDF UI (Bearer + cache + WebView + Download); shows deploy vs no-doc errors
- [x] Proof photo gallery
- [x] Errors: 401 → re-login; 403 → message; 422 → field errors; PDF 404/403 → error UI
- [x] `EXPO_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`; Android emulator `http://10.0.2.2:8000/api/v1`)
- [x] UI copy does **not** treat stop complete as DO delivered / RRI completed
- [x] Datetime display uses Malaysia wall-clock digits (avoids +8h vs website)

### Phase 2 — Trip & job history (backend then mobile) — DONE 2026-08-05

See full contract: [Phase 2 — Trip & job history](#phase-2--trip--job-history-backend-ask).

#### Backend (Laravel) — done

- [x] Inbox `GET /transport/trips` includes **today’s `completed`** for assigned driver
- [x] `GET /api/v1/transport/trips/history?from=&to=&status=&page=&per_page=` (required `from`, 31-day cap, assigned-only) — matches the spec, plus `cancelled` added to the `status` enum (see status note in the Phase 2 section)
- [x] Trip show works for past completed trips (read-only actions stay locked) — confirmed, no change needed
- [x] Feature tests (`tests/Feature/DriverMobileTripInboxTest.php`) — deploy to staging/production still pending on the team's normal release process

#### Mobile (Expo) — done

- [x] Schedule / History screen (replaced Coming soon) — `src/app/(app)/schedule.tsx`, relabelled **Trip History** in the drawer
- [x] Call history endpoint; open trip/stop detail read-only when not actionable — reuses existing `/(app)/trips/[id]` screen unmodified
- [x] Drop local `completed-trips-cache` once inbox returns today’s completed — `src/lib/completed-trips-cache.ts` deleted, `driver-api.ts` simplified

### Nice-to-have backend follow-ups

- [ ] **Deploy** `GET …/source-document.pdf` to production/staging (blocking for driver PDF)
- [ ] Ensure trip `job` payload always includes `document_no`, `source_type`, `source_id`, `has_source_document_pdf`
- [ ] Emit ISO datetimes with `+08:00` (or documented true UTC) so clients need not special-case `Z`/`+00:00`
- [ ] Push / assignment acknowledge API (when product needs it)
- [ ] Optional flat `GET /transport/jobs/history` if Jobs tab needs ungrouped past jobs
