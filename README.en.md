# Bambini

[Українська](README.md) · [English](README.en.md)

Bambini is a mobile-first web application for finding people and events nearby. Users can create events, join them based on their location, see available participants on a MapLibre map, add friends, and customize their mascot and application theme.

## Features

### Registration and sign-in

- create an account with a name, email address, and password;
- verify an email address with a six-digit code that remains valid for 10 minutes;
- resend the code with a 60-second cooldown and protection against repeated incorrect attempts;
- sign in through Google Identity Services without an additional email code;
- server-side bearer sessions, protected pages, and account sign-out.

### Map and geolocation

- interactive MapLibre map that automatically centers on the current location;
- display users at their real coordinates without anchoring markers to the screen;
- separate collapsible people filters: nobody, friends only, or all available users;
- separate collapsible event filters: none, the user's events, or all available events;
- filter events by predefined tags;
- user popup with an avatar, mascot, friendship status, and an “Add friend” action;
- event popup with its name, description, date, privacy, and buttons to view or join it when nearby;
- participants physically located near an event are arranged around its marker, with friends prioritized and any overflow shown as a counter;
- event markers scale smoothly and disappear at very distant zoom levels;
- remember the map's latest position and zoom level;
- update geolocation only while the application is actively being used.

### Events

- create up to three owned events per user;
- set a name, description, start and end times, one map location, an image of up to 2 MB, and a marker style;
- optional participant limit from 1 to 50;
- assign up to five predefined tags to an event;
- three access levels: public, friends only, and private;
- join through an event code or through an available public event;
- verify the geofence before joining a public event from the map;
- separate lists for owned, friends-only, and public events;
- distance sorting, displayed distance, and tag filtering;
- details page with date, description, tags, privacy, and a participant list;
- build a route to the event location through Google Maps;
- join, leave, and view available participants on the map;
- add a participant as a friend directly from the event page;
- organizers can edit event details and location, remove participants, or delete the entire event;
- collapse the details panel by swiping down and restore it by swiping up;
- participants receive in-app notifications when an event is edited or deleted.

### Friends

- unique eight-character friend code for each user;
- send a request by code or directly from the map and event pages;
- accept or decline incoming requests;
- view and cancel outgoing requests;
- remove a user from the friends list through a custom confirmation dialog;
- indicator for location availability and the time it was last updated.

### Profile and privacy

- change the profile name and photo;
- remove the photo, with uploads limited to 2 MB;
- view and copy the public friend code;
- three location visibility modes: nobody, friends, or everyone;
- switch the interface between Ukrainian and English, with the choice saved on the device;
- preview the current mascot;
- open style customization and sign out of the account.

### Mascot, themes, and achievements

- mascot builder with a skin, accessory, outfit, and background;
- empty outfit and accessory options for a default mascot without clothing;
- the dolphin skin is a complete standalone appearance and cannot be combined with equipment;
- six interface themes: dark, blue, green, red, sunset, and neon;
- some cosmetics are unlocked through achievements related to events, friends, and user activity;
- locked cosmetics show their requirement, current progress, and remaining amount;
- the selected theme and assembled mascot are stored in the user's profile;
- the mascot is shown on the profile and in the user's map popup.

### Additional features

- responsive interface for phones and desktop computers;
- SVG icons, custom confirmation dialogs, and success or error messages;
- the frontend production build and API can be served by one FastAPI server;
- Bambini can be published as a Telegram Mini App through BotFather.

## Technology stack

| Part | Stack |
| --- | --- |
| Frontend | React 19, Vite 7, React Router, MapLibre GL |
| Backend | FastAPI, SQLModel, Uvicorn |
| Data | SQLite and local file storage for media |
| Authentication | Bearer sessions, Google Identity Services, email verification |
| Tests | pytest, FastAPI TestClient, Node.js test runner |

## Requirements

- Windows 10/11 and PowerShell;
- Python 3.11 or newer;
- Node.js 20.19+ or 22.12+;
- npm;
- internet access for the map, Google sign-in, and email delivery;
- `cloudflared` only when testing through HTTPS from phones or other devices.

Check the installed versions:

```powershell
python --version
node --version
npm --version
```

## Project structure

```text
Bambini/
├── backend/
│   ├── app/                  # FastAPI, models, and database access
│   │   └── seed.py           # repeatable local demo data
│   ├── tests/
│   │   ├── unit/             # backend unit tests
│   │   └── integration/      # API integration tests
│   ├── .env.example
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── public/               # logo and static assets
│   ├── src/                  # React application
│   ├── tests/unit/           # frontend unit tests
│   ├── themes/               # color themes
│   └── .env.example
├── start-dev.ps1             # local development
├── start-android.ps1         # production build + HTTPS Quick Tunnel
├── README.md                 # Ukrainian documentation
└── README.en.md              # English documentation
```

## Publishing as a Telegram Mini App (optional)

Bambini can be published as a Telegram Mini App through [@BotFather](https://t.me/BotFather). Telegram does not deploy the frontend or backend itself: BotFather stores an HTTPS address that Telegram opens in its embedded WebView.

1. Deploy Bambini at a permanent HTTPS address or start a Cloudflare Quick Tunnel.
2. Open `@BotFather` and create a bot with `/newbot`, or select an existing bot through `/mybots`.
3. Go to **Bot Settings → Configure Mini App → Enable Mini App**.
4. Enter the Bambini HTTPS address, name, description, image, and a unique short name.
5. Once configured, the application can be opened using a direct link:

```text
https://t.me/<bot_username>/<short_name>
```

Example of a configured Mini App:

**[https://t.me/bambiniapp_bot/bambini](https://t.me/bambiniapp_bot/bambini)**

In this example, `bambiniapp_bot` is the bot username and `bambini` is the Mini App short name. The link demonstrates the expected format; it is not a required address for every deployment.

When using a Cloudflare Quick Tunnel, update the Web App URL in BotFather whenever the `https://...trycloudflare.com` address changes. Never add the token issued by `/newbot` to the README, Git, or frontend code. A separate Telegram bot process is not required simply to open Bambini; it is only needed for messages or other Telegram Bot API features.

## First run

### 1. Create local configuration files

Run this in the repository root:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

The `.env` files are excluded from Git. Do not commit passwords, a Google Client Secret, an SMTP App Password, or a tunnel token.

### 2. Configure authentication

For email registration, keep this setting in `backend/.env`:

```dotenv
EMAIL_VERIFICATION_ENABLED=true
```

Then provide the SMTP settings. Gmail example:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USERNAME=sender@gmail.com
SMTP_PASSWORD=your-16-character-google-app-password
SMTP_FROM_EMAIL=sender@gmail.com
SMTP_FROM_NAME=Bambini
EMAIL_VERIFICATION_SECRET=replace-with-a-long-random-value
```

`SMTP_PASSWORD` must be a Google App Password, not the regular account password or a Google Authenticator code. Two-Step Verification must be enabled on the Google account before an App Password can be created.

If SMTP has not been configured yet, use the verified seed account described in the “Demo data” section. It does not require an email to be sent. New email users cannot finish registration until SMTP works. Google sign-in may remain disabled by leaving `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` empty.

### 3. Start development mode

```powershell
.\start-dev.ps1
```

The script will:

1. create `backend/.venv` if it does not exist;
2. install backend dependencies;
3. start FastAPI in a separate PowerShell window;
4. start Vite in the current window.

Open:

- frontend: <http://localhost:5173>;
- API: <http://127.0.0.1:8000>;
- Swagger: <http://127.0.0.1:8000/docs>;
- health check: <http://127.0.0.1:8000/health>.

Stop Vite with `Ctrl+C` and close the separate FastAPI window.

## Demo data

After installing backend dependencies, populate the local database with consistent test data:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed
```

The seed creates:

- five verified demo users with different themes and mascots;
- accepted, incoming, and outgoing friend requests;
- a public, friends-only, and private event scheduled in the future;
- participants and recent coordinates near the public event;
- sample in-app notifications and achievement progress.

Primary demo account:

```text
Email: demo@bambini.local
Password: Bambini123!
```

Other `*.demo@bambini.local` accounts use the same password. The command is repeatable: it updates only reserved demo records and does not create duplicates. The seed does not remove other data, but it should never be run against a production database.

## Manual startup

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

In a second PowerShell window:

```powershell
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` and `/media` to FastAPI, so no separate API address is required for local development.

## HTTPS testing from a phone or multiple devices

Mobile browsers allow geolocation only in a secure HTTPS context. A Cloudflare Quick Tunnel provides temporary access to Bambini from a phone or another computer.

Install `cloudflared` once:

```powershell
winget install --id Cloudflare.cloudflared
```

Then run this from the repository root:

```powershell
.\start-android.ps1
```

The script installs missing dependencies, builds the frontend, starts FastAPI, and prints a temporary address similar to:

```text
https://random-name.trycloudflare.com
```

The same address can be opened on multiple devices at the same time. Keep the FastAPI and `cloudflared` windows open while testing. The address stops working when the tunnel stops, and the next launch creates a new one.

Google sign-in works only from addresses listed under **Authorized JavaScript origins**. To test it through a Quick Tunnel, add the current `https://...trycloudflare.com` address in Google Console. It does not need to be added to **Authorized redirect URIs**. Until that is done, use the regular email and password sign-in.

## Google sign-in configuration

Create an OAuth Client of type **Web application** in Google Auth Platform. Put the same Client ID in both files.

`backend/.env`:

```dotenv
GOOGLE_CLIENT_ID=000000000000-example.apps.googleusercontent.com
```

`frontend/.env`:

```dotenv
VITE_GOOGLE_CLIENT_ID=000000000000-example.apps.googleusercontent.com
```

Add the required addresses to **Authorized JavaScript origins**:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:8000
http://127.0.0.1:8000
```

Bambini uses a popup and JavaScript callback, so **Authorized redirect URIs should remain empty**.

Restart Vite or rebuild the frontend after changing `frontend/.env`. Values prefixed with `VITE_*` are embedded into JavaScript during the build.

## Production build

```powershell
cd frontend
npm ci
npm run check

cd ..\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`npm run check` runs the frontend tests and creates `frontend/dist`. If the `dist` directory exists, FastAPI serves the React Router fallback, the API under `/api`, and uploaded files under `/media`.

For a real deployment, use an HTTPS reverse proxy and persistent storage for SQLite and media.

## Data and backups

By default, the application creates:

```text
backend/app.db
backend/media/
```

Both paths are excluded from Git. Back up the database and the `media` directory to preserve users, events, customization, and uploaded images.

The paths can be changed in `backend/.env`:

```dotenv
DATABASE_URL=sqlite:///C:/absolute/path/to/app.db
MEDIA_ROOT=C:/absolute/path/to/media
```

Do not start two independent servers with different SQLite copies if they are expected to share data.

## Tests

### Backend

Install test dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Run all backend tests:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Run individual groups:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\unit -q
.\.venv\Scripts\python.exe -m pytest tests\integration -q
```

The tests use a temporary database and media directory. They do not modify `backend/app.db` or `backend/media`.

### Frontend

```powershell
cd frontend
npm ci
npm run test:unit
```

Run tests and the production build together:

```powershell
npm run check
```

## Main environment variables

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID used by the backend to verify a Google credential |
| `VITE_GOOGLE_CLIENT_ID` | the same Client ID used by the Google button in the frontend |
| `EMAIL_VERIFICATION_ENABLED` | enables the required six-digit email code |
| `SMTP_HOST`, `SMTP_PORT` | SMTP server and port |
| `SMTP_USE_SSL` | SSL connection to SMTP |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | email account credentials |
| `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | message sender |
| `EMAIL_VERIFICATION_SECRET` | secret used for HMAC hashing of verification codes |
| `CORS_ORIGINS` | allowed origins when the frontend and backend run separately |
| `DATABASE_URL` | database path or URL |
| `MEDIA_ROOT` | uploaded image directory |
| `VITE_API_URL` | API address; defaults to `/api` |

## Troubleshooting

### PowerShell does not allow scripts to run

Enable scripts for the current process only:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

### Registration returns `503 Service Unavailable`

SMTP is not configured or the mail server rejected the sign-in. Check the `SMTP_*` variables and make sure a Google App Password is being used. To inspect the application locally without email, run the seed and sign in as `demo@bambini.local` instead of creating a new account.

### Resending a code returns `429 Too Many Requests`

There is a 60-second cooldown between messages. Wait for the timer to finish.

### Gmail returns `Application-specific password required`

Create a Google App Password after enabling Two-Step Verification. Do not use the regular Gmail password or an Authenticator code.

### Google reports a disallowed origin

Add the exact origin of the current page to **Authorized JavaScript origins**. An origin contains the protocol, hostname, and port, but no path.

### Geolocation does not work on a phone

Check the browser's location permission and use HTTPS. `localhost` is an exception; a LAN IP over HTTP is not a secure context.

### The map is empty

Check the internet connection and make sure the network is not blocking MapLibre/OpenFreeMap resources.
