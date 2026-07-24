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

---

## Mobile implementation status (as of handoff)

Phase-1 driver UX is shipped in the Expo app. Gaps are only under **Blocked** / **Known client workarounds** / **Nice-to-have backend follow-ups**.

| Area | Mobile status | Notes |
|---|---|---|
| Login / logout / me | Done | SecureStore token; no register UI |
| Today’s trip inbox + Home | Done | Labels: Next job / **Current trip** / Today’s trip |
| Trip detail + Start / End | Done | Checklist gate; end when all stops terminal |
| Pre-trip checklist (15 items) + photos | Done | Read-only after trip start |
| Stop arrive / complete + POD | Done | ≥1 photo; optional signature; geo; `client_uuid` |
| Cargo `line_items` (DO + RRI) | Done | DO packaging/condition; RRI good/repair/damage/scrap always shown (read-only) |
| Document badge + PDF View/Download | Done | Route `jobs/[jobId]/document`; only if `has_source_document_pdf` |
| Proof gallery | Done | List / upload / delete |
| i18n | Done | en / zh / ms |
| Push / assignment ack | Stub only | **No API yet** |
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

1. **Completed trips missing from inbox** — `GET /transport/trips` omits `completed`. Mobile merges a **local same-day cache** after clock-out so Home/Jobs can still show Completed. Prefer API to include **today’s completed** trips for the assigned driver when convenient.
2. **PDF auth** — WebView cannot send Bearer headers. Mobile downloads `GET …/jobs/{id}/source-document.pdf` with Sanctum into cache, then opens locally (+ share sheet for Download).
3. **Expo Go Android** — push via `expo-notifications` is avoided on Expo Go Android; use a custom/dev client for real push later.
4. **Standalone / no source** — `line_items: []`, `has_source_document_pdf: false`; UI falls back to `items_description`.

---

## Backend alignment checklist (for website changes)

When changing transport APIs, keep mobile working:

- [ ] Nested `job` still includes: `document_no`, `document_status`, `source_type`, `source_id`, `has_source_document_pdf`, `delivery_order_nos`, `line_items` (DO + RRI shapes), `latitude` / `longitude`
- [ ] PDF route remains Bearer-auth binary PDF on **transport job id** (`job.id`), not `source_id`
- [ ] Stop complete still does **not** auto-close DO/RRI
- [ ] Checklist still exactly 15 keys; `can_clock_in` only when planned + all passed
- [ ] Prefer datetime serialization that matches Malaysia wall clock (see timezone section)
- [ ] Optional: return today’s `completed` trips in inbox so mobile can drop local cache

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
7. **Arrive at stop** — `POST …/stops/{tripStop}/clock-in`.
8. **Stop detail / cargo** — `job.line_items` + `document_no`; read-only qty.
9. **View DO/RRI PDF** — when `has_source_document_pdf === true`.
10. **Complete stop / POD** — ≥1 photo multipart; optional signature, received-by, notes, geo, `client_uuid`.
11. **End trip** — dialog → `POST …/clock-out` when all stops terminal.
12. **Proof gallery** — list / upload / delete completion-proof photos.

### Blocked / incomplete without new backend work

| Driver need | Status |
|---|---|
| Push / assignment requests / dynamic insert acknowledge | **Missing API** |
| Helper pairing, vehicle picker | **Not on mobile API** |
| Edit DO/RRI line qty from the app | **Out of scope** (ERP only) |
| Offline queue / sync protocol | **Partial**: `client_uuid` idempotency on photo upload only |

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
| `GET` | `/api/v1/transport/trips` | Today’s inbox for the linked driver |
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
| `POST` | `/api/v1/transport/stops/{tripStop}/clock-in` | Arrive at stop |
| `POST` | `/api/v1/transport/stops/{tripStop}/complete` | Complete stop with proof |

Authorization: assigned linked driver of the trip (`driver_app.access` + matching `driver_id`) may act. Trip show/clock-in/clock-out use `DriverTripPolicy`. Failed/cancelled jobs deny proof manage.

#### Trip inbox — `GET .../trips`

Returns `{ "data": [ trip payloads ] }` for the authenticated driver’s own trips where:

- `planned_date` is today and status is `planned` or `in_progress`, **or**
- status is `in_progress` (covers overnight trips still open)

**Mobile note:** completed trips are omitted. The app keeps a same-day local cache after clock-out. Prefer returning today’s `completed` trips for the assigned driver when the API is next updated.

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
| `line_items` | From source DO/RRI (`sku` from `product.sku_code`); `[]` for standalone. **DO:** `{ sku?, name, qty, uom?, packaging?, condition?, description? }`. **RRI:** `{ sku?, name, qty, uom?, description?, quantity_expected, quantity_good, quantity_repair, quantity_damage, quantity_scrap }` (`qty` = expected) |
| `latitude`, `longitude` | Site pin from stop-scoped `CustomerAddress`; `null` when missing |

Built by `FormatsDriverTripPayload` (`app/Http/Controllers/Api/V1/Concerns/FormatsDriverTripPayload.php`). No portal URLs.

### Jobs, DO/RRI, and PDF (read this before building stop UI)

**What to show on stop / job detail**

1. Address, contact, special instructions (always).
2. Document badge when linked: `document_no` + `job_type_label` (e.g. Delivery / Rental return). Prefer `document_no` over digging into `delivery_order_nos` for the primary label; keep `delivery_order_nos` as secondary (RRI may list a linked DO number).
3. **Cargo table** from `line_items` (empty for standalone jobs — fall back to `items_description` text).
4. **View document** button only when `has_source_document_pdf === true`.

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
      "sku": "MF-5G7-25",
      "name": "Main Frame 5'7\" 2.5mm",
      "qty": 10,
      "uom": "pcs",
      "packaging": "Bundle",
      "condition": "new",
      "description": "Site A frame"
    }
  ],
  "latitude": 3.139,
  "longitude": 101.6869
}
```

**Example — Rental Return job line item**

```json
{
  "sku": "MF-5G7-25",
  "name": "Main Frame 5'7\" 2.5mm",
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

| Concern | Detail |
|---|---|
| Auth | Same Bearer token as other APIs |
| When to call | Only if `has_source_document_pdf === true`; use nested `job.id` as `{transportJob}` |
| Success | `200` body = raw PDF bytes; `Content-Type: application/pdf` |
| Inline viewer | Default (no query) → `Content-Disposition: inline` — open in WebView / system PDF viewer |
| Download | `?download=1` → `Content-Disposition: attachment; filename="..."` |
| Errors | `403` not your job; `404` no DO/RRI linked (or job missing) |
| Freshness | Always regenerated from current ERP data — no stale cached file |

Suggested UX: primary **View document**; secondary **Download**. Show a loading state (Chromium can take a few seconds). On weak networks, prefer fetch-on-tap rather than preloading every stop’s PDF.

**Mobile client behaviour (implemented):** download with Bearer into app cache, open in WebView, Download via system share sheet. Do not rely on WebView loading the remote URL with cookies.

**Reminder:** Completing the stop updates **transport** only. Office marks DO delivered / finishes RRI after qty checks.

### Common confusions (quick answers)

| Question | Answer |
|---|---|
| Does stop complete = DO delivered? | **No.** Transport job/stop complete only. |
| Can the driver change line qty in the app? | **No.** Show cargo; office edits DO/RRI in ERP if needed. |
| Which id for the PDF URL? | Nested `job.id` (transport job), **not** `source_id` (DO/RRI id). |
| JSON vs PDF response? | All APIs return JSON except `source-document.pdf` → binary PDF. |
| Why are RRI good/repair/damage/scrap often 0? | Warehouse fills those in ERP; driver uses **expected** qty for the run. |
| When is there no PDF button? | `has_source_document_pdf === false` (standalone / no linked DO or RRI). |

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
   - **View document** → in-app PDF when `has_source_document_pdf`
   - Arrive / Complete (trip must be `in_progress`); Call / SMS / Navigate when actionable
6. **Document PDF** — Bearer download to cache → WebView; Download via system share sheet.
7. **Job proofs** — gallery list/add/delete.

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
- [x] Enriched job `line_items` + source document meta
- [x] On-demand DO/RRI PDF (`GET .../source-document.pdf`)
- [x] Configurable API base documented (`EXPO_PUBLIC_API_URL`)

### Mobile client app — implemented

- [x] Login / logout / me with secure token storage; no registration UI
- [x] Trip inbox + trip detail (+ local completed-trip cache for same-day ended trips)
- [x] Pre-trip checklist screen + Start-trip gate
- [x] Trip clock-in / clock-out
- [x] Stop clock-in + complete with ≥1 photo
- [x] Cargo / line items on stop detail (`job.line_items` + document no.; DO/RRI fields)
- [x] View DO/RRI PDF when `has_source_document_pdf` (Bearer + cache + WebView + Download)
- [x] Proof photo gallery
- [x] Errors: 401 → re-login; 403 → message; 422 → field errors; PDF 404/403 → error UI
- [x] `EXPO_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`; Android emulator `http://10.0.2.2:8000/api/v1`)
- [x] UI copy does **not** treat stop complete as DO delivered / RRI completed
- [x] Datetime display uses Malaysia wall-clock digits (avoids +8h vs website)

### Nice-to-have backend follow-ups

- [ ] Include **today’s completed** trips in `GET /transport/trips` (assigned driver) so mobile can drop local cache
- [ ] Emit ISO datetimes with `+08:00` (or documented true UTC) so clients need not special-case `Z`/`+00:00`
- [ ] Push / assignment acknowledge API (when product needs it)
