## Run backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Run frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```
## Current product behavior

- Accounts are opened on any device with the same email and password. There is no secret profile code.
- Events page filters: My / Friends / Public.
- A participant can leave an event; the organizer cannot leave their own event.
- Accepted friends can be removed from the friends page.
