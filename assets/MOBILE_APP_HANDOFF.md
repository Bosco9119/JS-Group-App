# JS-Group Driver Mobile App — Client Spec Against Existing Laravel API

> Copy this entire document into another Cursor project as the agent prompt when building the driver mobile client.
>
> Scope: **mobile client only** against **this** JS-Group Laravel backend (`/api/v1`). Do **not** invent self-registration.
>
> **Pre-trip checklist API is live** — see **“Pre-trip checklist”** below for screens, payloads, and Start Trip gates.
>
> **DO/RRI + PDF are live in this Laravel repo** — nested job includes `document_no` / `has_source_document_pdf` / rich `line_items`; open PDF via `GET …/source-document.pdf`. Completing a stop does **not** mark ERP DO/RRI delivered/completed. See **“Jobs, DO/RRI, and PDF”**.
>
> **Production host gap:** if `jsgroup.codespaceaitechnology.com` still returns “route could not be found” for the PDF URL, deploy this branch (controller + route already in repo).

## Source document PDF (backend — this Laravel repo)

Mobile **View Document** calls:

```http
GET /api/v1/transport/jobs/{transportJob}/source-document.pdf
Authorization: Bearer {token}
Accept: application/pdf
```

**Implemented here:**

| Piece | Location |
|---|---|
| Controller | `App\Http\Controllers\Api\V1\TransportJobSourceDocumentController` |
| Route | `api.v1.transport.jobs.source-document` → `GET …/source-document.pdf` |
| Nested job meta | `document_no`, `document_status`, `source_type`, `source_id`, `has_source_document_pdf` via `FormatsDriverTripPayload` |

Use nested transport **`job.id`** (not DO/RRI `source_id`). Optional `?download=1` for attachment. Show **View document** only when `has_source_document_pdf === true`.

You are building a **driver-facing mobile client** that consumes the **existing** JS-Group Laravel backend API at `/api/v1`.

## Non-negotiables

- **Login only.** There is **no register**, no public signup, no self-service password reset on the mobile API.
- Accounts are **provisioned by admin** in the ERP (Driver create/edit → enable app access: email + password). The user must have:
  - An active `users` record
  - Linked `drivers.user_id`
  - Permission `driver_app.access` (role **Driver**)
- Auth uses **Laravel Sanctum** personal access tokens named `driver-app`.
- Send `Authorization: Bearer {token}` on all authenticated requests.
- `Accept: application/json` — API always returns JSON for `api/*`.
- Do **not** assume endpoints that are not listed below exist. Many transport features exist only in the **admin ERP** (web/Inertia), not on the mobile API.

## Demo credentials (seeded environments)

- `driver1@jsgroup.com` / `password`
- `driver2@jsgroup.com` / `password`
(Requires logistics + transport seeders that link drivers to those users.)

---

## Product flows the app should support (target UX)

### Ready to implement against current API

1. **Login screen** — email + password only. Store token securely. No “Create account”.
2. **Session** — call `GET /auth/me` on launch if token exists; logout clears local token + `POST /auth/logout`.
3. **Today’s trip inbox** — `GET /transport/trips` (own trips: today’s planned/in_progress + any open in_progress overnight).
4. **Trip detail** — `GET /transport/trips/{driverTrip}` (ordered stops + job summary + nested `checklist`).
5. **Pre-trip checklist** — show/update items + optional photos; **all items must pass** before Start Trip (`can_clock_in` is false until then).
6. **Start trip** — `POST /transport/trips/{driverTrip}/clock-in` only after checklist passed (`422` otherwise).
7. **Arrive at stop** — `POST /transport/stops/{tripStop}/clock-in` (marks stop arrived; job → `in_progress`).
8. **Complete stop / POD** — `POST /transport/stops/{tripStop}/complete` with **at least 1 photo** (multipart). Optional signature image, received-by name, notes, geo, `client_uuid`.
9. **End trip** — when all stops are done, show dialog → `POST /transport/trips/{driverTrip}/clock-out` (`in_progress` → `completed`).
10. **Proof gallery for a job** — list / upload / delete completion-proof photos on a transport job.

### Blocked / incomplete without new backend work (document as gaps; stub UI only if needed)

| Driver need | Status |
|---|---|
| Push / assignment requests / dynamic insert acknowledge | **Missing API** |
| Helper pairing, vehicle picker | **Not on mobile API** |
| Offline queue / sync protocol | **Partial**: `client_uuid` idempotency on photo upload only — no full offline trip sync API |
| DO/RRI PDF on older production hosts | **Deploy this repo** if PDF route 404s — code is already in Laravel |

**Day flow:** Drivers list today’s trips, complete the pre-trip checklist (all items pass), start the trip, complete stops, then end the trip (clock-out) once all stops are done.

---

## Domain model (mobile-relevant)

```
User 1──1 Driver (drivers.user_id)
Driver 1──* DriverTrip (assigned driver_id)
DriverTrip 1──1 VehicleChecklist (pre-trip)
DriverTrip 1──* TripStop (ordered)
TripStop *──1 TransportJob
TransportJob 1──* TripPhoto (completion_proof)
```

Statuses (simplified):

- **Trip:** `planned` → (checklist all pass) → `in_progress` (mobile trip clock-in) → `completed` (mobile trip clock-out)
- **Stop:** `pending` → `arrived` (clock-in) → `completed` (complete + photos)
- **Job:** … → `assigned` → `in_progress` (on stop clock-in) → `completed` (on stop complete)
- **Checklist:** items `{ key, label, passed, notes }`; overall `passed` only when every item `passed === true`

Job types (ERP): `delivery`, `rental_return`, `warehouse_transfer`, `standalone`.

---

## API base

- Prefix: `/api/v1`
- Base URL: whatever host this Laravel app is served on (e.g. local `php artisan serve` / XAMPP vhost).
- Mobile client: `EXPO_PUBLIC_API_URL` (see `.env.example`). Defaults to `http://localhost:8000/api/v1`.
  - Android emulator: `http://10.0.2.2:8000/api/v1`
  - Physical device: `http://<LAN-IP>:8000/api/v1`

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
| `GET` | `/api/v1/transport/trips/{driverTrip}` | Trip detail with stops + nested checklist |
| `POST` | `/api/v1/transport/trips/{driverTrip}/clock-in` | Start trip when checklist passed |
| `POST` | `/api/v1/transport/trips/{driverTrip}/clock-out` | End trip when all stops done |
| `GET` | `/api/v1/transport/trips/{driverTrip}/checklist` | Load/create pre-trip checklist |
| `PUT` | `/api/v1/transport/trips/{driverTrip}/checklist` | Submit all 15 checklist items |
| `POST` | `/api/v1/transport/trips/{driverTrip}/checklist/photos` | Optional checklist photos |
| `GET` | `/api/v1/transport/jobs/{transportJob}/proof-photos` | List completion-proof photos |
| `POST` | `/api/v1/transport/jobs/{transportJob}/proof-photos` | Upload 1–10 images (multipart) |
| `DELETE` | `/api/v1/transport/jobs/{transportJob}/proof-photos/{tripPhoto}` | Delete one proof photo |
| `GET` | `/api/v1/transport/jobs/{transportJob}/source-document.pdf` | On-demand DO/RRI PDF (`?download=1` for attachment) |
| `POST` | `/api/v1/transport/stops/{tripStop}/clock-in` | Start job at stop |
| `POST` | `/api/v1/transport/stops/{tripStop}/complete` | Complete stop with proof |

Authorization: assigned linked driver of the trip (`driver_app.access` + matching `driver_id`) may act. Trip show/clock-in/clock-out use `DriverTripPolicy`. Failed/cancelled jobs deny proof manage.

#### Trip inbox — `GET .../trips`

Returns `{ "data": [ trip payloads ] }` for the authenticated driver’s own trips where:

- `planned_date` is today and status is `planned` or `in_progress`, **or**
- status is `in_progress` (covers overnight trips still open)

**Mobile note / backend ask:** completed trips for *today* currently disappear from this inbox. The app keeps a local cache after clock-out so Jobs can show **Completed**. Prefer the API also returning today’s `completed` trips (same assigned-driver scope) so the client cache is unnecessary.

Each trip payload includes: `id`, `trip_no`, `status`, `status_label`, `planned_date`, `planned_start`, `planned_end`, `actual_start`, `actual_end`, `vehicle`, stop counts, nested `checklist`, `can_clock_in`, `all_stops_done`, `can_clock_out`, and `stops[]` with nested `job` (see **Jobs, DO/RRI, and PDF**).

#### Trip show — `GET .../trips/{driverTrip}`

Same trip payload shape for one trip. `403` if not the assigned driver (and not ERP editor).

### Jobs, DO/RRI, and PDF (read this before building stop UI)

**What to show on stop / job detail**

1. Address, contact, special instructions (always).
2. Document badge when linked: `document_no` + `job_type_label`. Prefer `document_no` over digging into `delivery_order_nos` for the primary label.
3. **Cargo table** from `line_items` (empty for standalone — fall back to `items_description`).
4. **View document** only when `has_source_document_pdf === true`.

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

**Standalone / no source:** `has_source_document_pdf: false`, empty `line_items` / `delivery_order_nos`, null document meta — use `items_description` only.

| `job_type` | Typical source | PDF? |
|---|---|---|
| `delivery` | Delivery Order | Yes when linked |
| `rental_return` | Rental Return In | Yes when linked |
| `warehouse_transfer` / `standalone` | Often none | No (`has_source_document_pdf: false`) |

#### Trip clock-in — `POST .../trips/{driverTrip}/clock-in`

No body required. Trip must be `planned` with no `actual_start`. Reuses `DriverTripService::clockIn`. Response `{ "data": trip payload }` with `status: in_progress`.

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

#### Source document PDF — `GET .../jobs/{transportJob}/source-document.pdf`

On-demand Chromium PDF of the linked Delivery Order or Rental Return (same as ERP print). Never the empty handwriting RRI template. Draft DOs may show a DRAFT watermark.

| Concern | Detail |
|---|---|
| Auth | Same Bearer token as other APIs |
| When to call | Only if `has_source_document_pdf === true`; use nested `job.id` as `{transportJob}` |
| Success | `200` body = raw PDF bytes; `Content-Type: application/pdf` |
| Inline | Default → `Content-Disposition: inline` |
| Download | `?download=1` → `Content-Disposition: attachment` |
| Errors | `403` not your job; `404` no DO/RRI linked |
| Freshness | Always regenerated from current ERP data |

Suggested UX: primary **View document**; secondary **Download**. Show a loading state (Chromium can take a few seconds).

**Reminder:** Completing the stop updates **transport** only. Office marks DO delivered / finishes RRI after qty checks.

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

## Suggested screen map (client)

1. **Login** — email/password; map validation errors from `email` field.
2. **Home / trips inbox** — `GET /transport/trips`; pull-to-refresh; empty state when none assigned.
3. **Trip detail** — `GET /transport/trips/{id}`; show checklist status; **Start trip** only when `can_clock_in`.
4. **Pre-trip checklist** — `GET/PUT …/checklist` + optional `POST …/checklist/photos`; all 15 items must Pass.
5. **Stop detail** — Arrive → clock-in; Complete → camera/library + optional signature → multipart complete; if last stop, prompt end-trip dialog. Show **View document** when `has_source_document_pdf`.
6. **Job proofs** — gallery from GET; add/delete photos.
7. **Document PDF** — `GET …/jobs/{job.id}/source-document.pdf` (Bearer); inline viewer or `?download=1`.

### Pre-trip checklist (mobile)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/transport/trips/{driverTrip}/checklist` | Load or auto-create 15 items |
| `PUT` | `/api/v1/transport/trips/{driverTrip}/checklist` | Submit all 15 items (`passed` boolean each) |
| `POST` | `/api/v1/transport/trips/{driverTrip}/checklist/photos` | Optional photos (multipart `photos[]`) |

Hard rules: do not Start Trip while `can_clock_in` is false; PUT only while trip is `planned`; after start checklist is read-only. Keys: `tyre`, `brake`, `lights`, `reverse_light`, `horn`, `mirror`, `engine_oil`, `coolant`, `fire_extinguisher`, `first_aid`, `cleanliness`, `fuel_level`, `mileage`, `cargo_secured`, `documents`.

Do not build: registration, forgot-password (unless admin later adds API), ERP dispatcher.

---

## Backend reference (JS-Group repo — do not reimplement)

- Routes: `routes/api.php`
- Controllers: `DriverAuthController`, `DriverTripController`, `VehicleChecklistController`, `TransportJobProofPhotoController`, `TransportJobSourceDocumentController`, `TripStopClockInController`, `TripStopCompleteController`
- Services: `DriverUserAccountService`, `VehicleChecklistService`, `TransportJobProofService`, `DriverTripService`, `ChromiumPdfRenderer`, `DeliveryOrderPrintData`, `RentalReturnInPrintData`
- Tests: `DriverMobileAuthTest`, `DriverMobileTripInboxTest`, `DriverMobileChecklistTest`, `TransportJobProofPhotoTest`, `TransportJobSourceDocumentPdfTest`

## Explicit out of scope for the mobile client repo

- Admin ERP CRUD, dispatcher board, commission
- Creating drivers/users (admin only)
- Calling web/Inertia admin routes with session cookies

## Definition of done (phase 1 client)

- [x] Login / logout / me with secure token storage
- [x] No registration UI
- [x] Trip inbox + trip clock-in against live API
- [x] **Pre-trip checklist screen + Start-trip gate** (`can_clock_in` / checklist.passed)
- [x] Trip clock-out when all stops done (dialog → API → ERP Completed)
- [x] Clock-in stop + complete stop with ≥1 photo against live API
- [x] Proof photo list/upload/delete against live API
- [x] Errors: 401 → re-login; 403 → show message; 422 → field errors
- [x] Configurable API base via `EXPO_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`; Android emulator `http://10.0.2.2:8000/api/v1`)
- [x] Richer native trip/job detail UI (no portal deep links)
- [x] View Document PDF when `has_source_document_pdf` (inline + download)

---

## Nested job payload (driver mobile) — implemented

Same Sanctum Bearer + assigned-driver scope. Enrichment is on existing trip inbox/show nested `job` — no portal URLs.

| Field | Type | Purpose |
|---|---|---|
| `source_type` | `delivery_order` \| `rental_return_in` \| null | Linked ERP document kind |
| `source_id` | `int\|null` | DO/RRI id (not for PDF URL) |
| `document_no` | `string\|null` | Primary badge (DO no / RRI return no) |
| `document_status` | `string\|null` | ERP status value |
| `has_source_document_pdf` | `bool` | Gate for View Document |
| `delivery_order_nos` | `string[]` | DO nos (RRI may include linked DO) |
| `line_items[]` | array | Cargo; DO adds packaging/condition/description; RRI adds quantity_expected/good/repair/damage/scrap |
| `latitude` / `longitude` | `number\|null` | Site pin |

### Not exposed

- “View on website” links
- Admin/ERP session cookie auth for mobile
- Other drivers’ jobs / costing / payroll
