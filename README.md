# Bambini

Android-first React + MapLibre frontend with a FastAPI/SQLite backend.

This repaired source snapshot intentionally excludes databases, real user/location data, `.env` files, `.git`, virtual environments, `node_modules`, generated media, and build output.

## Local development on Windows

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
.\start-dev.ps1
```

Or start each service manually.

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

API documentation: `http://127.0.0.1:8000/docs`

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Frontend: `http://localhost:5173`

The Vite development server proxies both `/api` and `/media` to FastAPI.

## Android HTTPS testing

Browser geolocation requires HTTPS outside `localhost`.

```powershell
.\start-android.ps1
```

The script creates a fresh frontend build and serves it with FastAPI on one stable origin before opening the Cloudflare tunnel. Normal local development still uses Vite through `start-dev.ps1`; rerun `start-android.ps1` after source changes to refresh the Android build.

## Production build

```powershell
cd frontend
npm ci
npm run check
cd ..\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

After `npm run build`, FastAPI serves `frontend/dist`, supports React Router fallback routes, exposes the API under `/api`, and serves uploaded media under `/media`. A separate reverse proxy is optional rather than required.

Set `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` to the same Google OAuth web client ID before enabling Google Sign-In. The backend verifies the Google credential; the browser-decoded payload is never trusted.

Email/password registration is locked behind a six-digit verification code when `EMAIL_VERIFICATION_ENABLED=true`. Configure the `SMTP_*` values shown in `backend/.env.example`; for Gmail, use an app password rather than the account password. Codes expire after 10 minutes, resends are limited to once per minute, and repeated incorrect attempts are blocked.

## Tests

Unit tests live in `backend/tests/unit` and `frontend/tests/unit`. Backend API integration tests live in `backend/tests/integration`.

Backend — install the test dependencies once:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Run only backend unit tests:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\unit -q
```

Run only backend API integration tests:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\integration -q
```

Run every backend test:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend — install dependencies once, then run unit tests:

```powershell
cd frontend
npm.cmd ci
npm.cmd run test:unit
```

Run frontend unit tests and verify the production build together:

```powershell
npm.cmd run check
```

The backend suite uses a temporary database and temporary media directory. It does not modify `backend/app.db` or `backend/media`.

## Existing database migration

The app creates a new database automatically. To migrate an existing Bambini database:

1. Make a backup.
2. Place the copy at `backend/app.db`, or set an absolute `DATABASE_URL`.
3. Start the backend once.

Startup migrations add the new authentication/data-integrity columns, remove duplicate membership/friendship rows before unique indexes are created, enable SQLite foreign keys, and move embedded Base64 images into controlled media storage. Keep the backup until the migrated app has been verified.

## Main behavioral changes

- Server-issued bearer sessions and server-side actor authorization.
- Backend-verified Google login linked by Google `sub`.
- Private/friends event read authorization and active-event filtering.
- Atomic event creation and capacity-safe, duplicate-safe joining.
- Fresh, accuracy-aware event geofencing; both viewer and participant must be near the active event.
- User pins remain on their real coordinates; no visual displacement at regional zoom.
- Event pins hide at country scale, scale with zoom, and pan only after an explicit event click.
- Up to eight attendee orbit slots, with an overflow badge instead of silently hiding additional participants.
- Uploaded images are stored as files and API payloads contain only URLs.
- Mobile-aware polling, GPS throttling, hidden-tab suspension, route-level code splitting, and responsive room scrolling.

See `FIXES_AND_TESTS.md` for the audit repair matrix.
