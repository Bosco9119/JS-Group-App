# JS-Group Driver Mobile App — Client Spec Against Existing Laravel API

> Copy this entire document into another Cursor project as the agent prompt when building the driver mobile client.
>
> Scope: **mobile client only** against **this** JS-Group Laravel backend (`/api/v1`). Do **not** invent self-registration.

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
4. **Trip detail** — `GET /transport/trips/{driverTrip}` (ordered stops + job address/customer summary).
5. **Start trip** — `POST /transport/trips/{driverTrip}/clock-in` (`planned` → `in_progress`).
6. **Arrive at stop** — `POST /transport/stops/{tripStop}/clock-in` (marks stop arrived; job → `in_progress`).
7. **Complete stop / POD** — `POST /transport/stops/{tripStop}/complete` with **at least 1 photo** (multipart). Optional signature image, received-by name, notes, geo, `client_uuid`.
8. **End trip** — when all stops are done, show dialog → `POST /transport/trips/{driverTrip}/clock-out` (`in_progress` → `completed`).
9. **Proof gallery for a job** — list / upload / delete completion-proof photos on a transport job.

### Blocked / incomplete without new backend work (document as gaps; stub UI only if needed)

| Driver need | Status |
|---|---|
| Pre-trip vehicle checklist | **Missing API** — admin only |
| Push / assignment requests / dynamic insert acknowledge | **Missing API** |
| Helper pairing, vehicle picker | **Not on mobile API** |
| Offline queue / sync protocol | **Partial**: `client_uuid` idempotency on photo upload only — no full offline trip sync API |

**Day flow:** Drivers list today’s trips, start them, complete stops, then end the trip (clock-out) once all stops are done. Stop clock-in/complete require the trip to be `in_progress` (403 otherwise). Mobile clock-out requires all stops terminal (`completed` / `skipped` / `failed`).

---

## Domain model (mobile-relevant)

```
User 1──1 Driver (drivers.user_id)
Driver 1──* DriverTrip (assigned driver_id)
DriverTrip 1──* TripStop (ordered)
TripStop *──1 TransportJob
TransportJob 1──* TripPhoto (completion_proof)
```

Statuses (simplified):

- **Trip:** `planned` → `in_progress` (mobile trip clock-in) → `completed` (mobile trip clock-out)
- **Stop:** `pending` → `arrived` (clock-in) → `completed` (complete + photos)
- **Job:** … → `assigned` → `in_progress` (on stop clock-in) → `completed` (on stop complete)

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
| `GET` | `/api/v1/transport/trips/{driverTrip}` | Trip detail with ordered stops + job summary |
| `POST` | `/api/v1/transport/trips/{driverTrip}/clock-in` | Start trip (`planned` → `in_progress`) |
| `POST` | `/api/v1/transport/trips/{driverTrip}/clock-out` | End trip (`in_progress` → `completed`) when all stops done |
| `GET` | `/api/v1/transport/jobs/{transportJob}/proof-photos` | List completion-proof photos |
| `POST` | `/api/v1/transport/jobs/{transportJob}/proof-photos` | Upload 1–10 images (multipart) |
| `DELETE` | `/api/v1/transport/jobs/{transportJob}/proof-photos/{tripPhoto}` | Delete one proof photo |
| `POST` | `/api/v1/transport/stops/{tripStop}/clock-in` | Arrive at stop |
| `POST` | `/api/v1/transport/stops/{tripStop}/complete` | Complete stop with proof |

Authorization: assigned linked driver of the trip (`driver_app.access` + matching `driver_id`) may act. Trip show/clock-in/clock-out use `DriverTripPolicy`. Failed/cancelled jobs deny proof manage.

#### Trip inbox — `GET .../trips`

Returns `{ "data": [ trip payloads ] }` for the authenticated driver’s own trips where:

- `planned_date` is today and status is `planned` or `in_progress`, **or**
- status is `in_progress` (covers overnight trips still open)

Each trip payload includes: `id`, `trip_no`, `status`, `status_label`, `planned_date`, `planned_start`, `planned_end`, `actual_start`, `actual_end`, `vehicle`, stop counts, `can_clock_in`, `all_stops_done`, `can_clock_out`, and `stops[]` (with nested `job` summary: job_no, type, customer, address, contacts, instructions).

#### Trip show — `GET .../trips/{driverTrip}`

Same trip payload shape for one trip. `403` if not the assigned driver (and not ERP editor).

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
3. **Trip detail** — `GET /transport/trips/{id}`; **Start trip** when `can_clock_in`; then open stops. When `can_clock_out`, show “Trip completed” dialog / **End trip**.
4. **Stop detail** — Arrive → clock-in; Complete → camera/library + optional signature → multipart complete; if last stop, prompt end-trip dialog.
5. **Job proofs** — gallery from GET; add/delete photos.

Do not build: registration, forgot-password (unless admin later adds API), ERP dispatcher, checklist UI calling missing endpoints.

---

## Backend reference (JS-Group repo — do not reimplement)

- Routes: `routes/api.php`
- Controllers: `app/Http/Controllers/Api/V1/Auth/DriverAuthController.php`, `DriverTripController.php`, `TransportJobProofPhotoController.php`, `TripStopClockInController.php`, `TripStopCompleteController.php`
- Services: `DriverUserAccountService`, `TransportJobProofService`, `DriverTripService`
- Policies: `DriverTripPolicy`, `TransportJobPolicy`
- Tests: `tests/Feature/DriverMobileAuthTest.php`, `DriverMobileTripInboxTest.php`, `TransportJobProofPhotoTest.php`
- Docs: `docs/ARCHITECTURE.md` §5.17 (“React Native mobile app deferred”)

## Explicit out of scope for the mobile client repo

- Admin ERP CRUD, dispatcher board, commission
- Creating drivers/users (admin only)
- Calling web/Inertia admin routes with session cookies

## Definition of done (phase 1 client)

- [x] Login / logout / me with secure token storage
- [x] No registration UI
- [x] Trip inbox + trip clock-in against live API
- [x] Trip clock-out when all stops done (dialog → API → ERP Completed)
- [x] Clock-in stop + complete stop with ≥1 photo against live API
- [x] Proof photo list/upload/delete against live API
- [x] Errors: 401 → re-login; 403 → show message; 422 → field errors
- [x] Configurable API base via `EXPO_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`; Android emulator `http://10.0.2.2:8000/api/v1`)
