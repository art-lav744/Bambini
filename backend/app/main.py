from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import math
import mimetypes
import os
import secrets
import string
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .database import BACKEND_DIR, create_db_and_tables, engine, get_session
from .models import (
    Activity,
    ActivityCreate,
    ActivityJoin,
    ActivityRead,
    AuthRead,
    AuthSession,
    Checkpoint,
    CheckpointCreate,
    CheckpointRead,
    EventLocation,
    EventMember,
    EventOwner,
    EventParticipantRead,
    FriendConnectionRead,
    FriendLocationRead,
    FriendRequestCreate,
    Friendship,
    GoogleLogin,
    LocationSharingUpdate,
    LocationUpdate,
    LocationVisibilityUpdate,
    User,
    UserCreate,
    UserLocation,
    UserLogin,
    UserRead,
    UserUpdate,
    utc_now,
)

EVENT_VISIBILITIES = {"public", "friends", "private"}
PIN_TYPES = {
    "default", "football", "basketball", "volleyball", "tennis", "pingpong",
    "ticket", "eightball", "beer", "popcorn",
}
EVENT_LOCATION_BASE_METERS = 40
EVENT_LOCATION_MIN_EFFECTIVE_METERS = 75
EVENT_LOCATION_MAX_ACCURACY_METERS = 100
LIVE_LOCATION_MAX_AGE_SECONDS = 8 * 60 * 60
AUTH_TOKEN_DAYS = 30
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", str(BACKEND_DIR / "media"))).resolve()
EVENT_MEDIA_DIR = MEDIA_ROOT / "events"
PROFILE_MEDIA_DIR = MEDIA_ROOT / "profiles"
FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()

security = HTTPBearer(auto_error=False)
_rate_lock = threading.Lock()
_rate_buckets: dict[str, deque[float]] = defaultdict(deque)


def normalized_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def user_read(user: User) -> UserRead:
    return UserRead.model_validate(user)


def generate_unique_code(session: Session, model, field_name: str, length: int, alphabet: str) -> str:
    field = getattr(model, field_name)
    for _ in range(80):
        code = "".join(secrets.choice(alphabet) for _ in range(length))
        if session.exec(select(model).where(field == code)).first() is None:
            return code
    raise HTTPException(status_code=503, detail="Не вдалося створити унікальний код")


PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 310_000
LEGACY_PASSWORD_ITERATIONS = 100_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
    payload = base64.b64encode(salt + derived).decode("ascii")
    return f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}${payload}"


def _password_hash_parts(password_hash: str) -> tuple[int, bytes] | None:
    try:
        if password_hash.startswith(f"{PASSWORD_SCHEME}$"):
            _, iterations_text, payload = password_hash.split("$", 2)
            iterations = int(iterations_text)
            if iterations < 100_000 or iterations > 2_000_000:
                return None
            return iterations, base64.b64decode(payload, validate=True)
        # Backward compatibility for the original Bambini hashes, which were
        # unversioned PBKDF2-SHA256 values using 100,000 iterations.
        return LEGACY_PASSWORD_ITERATIONS, base64.b64decode(password_hash, validate=True)
    except (ValueError, binascii.Error):
        return None


def verify_password(password: str, password_hash: str) -> bool:
    parsed = _password_hash_parts(password_hash)
    if parsed is None:
        return False
    iterations, raw = parsed
    if len(raw) <= 16:
        return False
    salt, stored = raw[:16], raw[16:]
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return len(stored) == len(derived) and hmac.compare_digest(stored, derived)


def password_hash_needs_upgrade(password_hash: str) -> bool:
    parsed = _password_hash_parts(password_hash)
    return parsed is not None and (not password_hash.startswith(f"{PASSWORD_SCHEME}$") or parsed[0] < PASSWORD_ITERATIONS)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_auth(session: Session, user: User) -> AuthRead:
    token = secrets.token_urlsafe(48)
    auth = AuthSession(
        user_id=user.id,
        token_hash=_token_hash(token),
        expires_at=utc_now() + timedelta(days=AUTH_TOKEN_DAYS),
    )
    session.add(auth)
    session.commit()
    return AuthRead(token=token, user=user_read(user))


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Потрібно увійти в акаунт")
    auth = session.exec(
        select(AuthSession).where(AuthSession.token_hash == _token_hash(credentials.credentials))
    ).first()
    if auth is None or normalized_utc(auth.expires_at) <= utc_now():
        if auth is not None:
            session.delete(auth)
            session.commit()
        raise HTTPException(status_code=401, detail="Сесія завершилася. Увійдіть знову")
    user = session.get(User, auth.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Користувача сесії не знайдено")
    return user


def require_same_user(path_user_id: int, current_user: User) -> None:
    if path_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Не можна виконувати дію від імені іншого користувача")


def check_rate_limit(request: Request, scope: str, limit: int, window_seconds: int) -> None:
    address = request.client.host if request.client else "unknown"
    key = f"{scope}:{address}"
    now = time.monotonic()
    with _rate_lock:
        bucket = _rate_buckets[key]
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(status_code=429, detail="Забагато спроб. Спробуйте пізніше")
        bucket.append(now)


def get_user_or_404(user_id: int, session: Session) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    return user


def get_activity_or_404(code: str, session: Session) -> Activity:
    activity = session.exec(select(Activity).where(Activity.code == code.strip().upper())).first()
    if activity is None:
        raise HTTPException(status_code=404, detail="Подію не знайдено")
    return activity


def normalize_event_visibility(value: str) -> str:
    visibility = (value or "").strip().lower()
    if visibility not in EVENT_VISIBILITIES:
        raise HTTPException(status_code=422, detail="visibility: public, friends або private")
    return visibility


def friendship_pair(user_a: int, user_b: int) -> str:
    low, high = sorted((user_a, user_b))
    return f"{low}:{high}"


def are_users_friends(user_id: int, other_user_id: int, session: Session) -> bool:
    if user_id == other_user_id:
        return True
    friendship = session.exec(
        select(Friendship).where(
            (Friendship.pair_key == friendship_pair(user_id, other_user_id))
            & (Friendship.status == "accepted")
        )
    ).first()
    return friendship is not None


def is_event_member(activity_id: int, user_id: int, session: Session) -> bool:
    return session.exec(
        select(EventMember.id).where(
            (EventMember.activity_id == activity_id) & (EventMember.user_id == user_id)
        )
    ).first() is not None


def can_view_activity(activity: Activity, viewer: User, session: Session) -> bool:
    owner = session.get(EventOwner, activity.id)
    if owner and owner.user_id == viewer.id:
        return True
    if is_event_member(activity.id, viewer.id, session):
        return True
    if activity.visibility == "public":
        return True
    if activity.visibility == "friends" and owner:
        return are_users_friends(viewer.id, owner.user_id, session)
    return False


def ensure_can_view_activity(activity: Activity, viewer: User, session: Session) -> None:
    if not can_view_activity(activity, viewer, session):
        raise HTTPException(status_code=403, detail="Ця подія недоступна для вашого акаунта")


def active_activity_condition(now: datetime | None = None):
    now = now or utc_now()
    legacy_cutoff = now - timedelta(hours=6)
    return or_(
        Activity.end_time >= now,
        (Activity.end_time.is_(None)) & (Activity.start_time.is_(None)),
        (Activity.end_time.is_(None)) & (Activity.start_time >= legacy_cutoff),
    )


def haversine_meters(longitude_a: float, latitude_a: float, longitude_b: float, latitude_b: float) -> float:
    radius = 6_371_000
    lat_a = math.radians(latitude_a)
    lat_b = math.radians(latitude_b)
    d_lat = math.radians(latitude_b - latitude_a)
    d_lng = math.radians(longitude_b - longitude_a)
    value = math.sin(d_lat / 2) ** 2 + math.cos(lat_a) * math.cos(lat_b) * math.sin(d_lng / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(value))


def event_geofence_match(user_location: UserLocation, event_location: EventLocation) -> bool:
    accuracy = min(max(float(user_location.accuracy or 0), 0), EVENT_LOCATION_MAX_ACCURACY_METERS)
    allowed = max(EVENT_LOCATION_MIN_EFFECTIVE_METERS, EVENT_LOCATION_BASE_METERS + accuracy)
    return haversine_meters(
        user_location.longitude, user_location.latitude,
        event_location.longitude, event_location.latitude,
    ) <= allowed


def location_is_fresh(location: UserLocation | None, now: datetime | None = None) -> bool:
    if location is None:
        return False
    now = now or utc_now()
    return 0 <= (now - normalized_utc(location.updated_at)).total_seconds() <= LIVE_LOCATION_MAX_AGE_SECONDS


def _media_extension(mime_type: str) -> str:
    allowed = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
        "image/gif": ".gif", "image/avif": ".avif",
    }
    return allowed.get(mime_type.lower(), "")


def store_image(value: str | None, category: str) -> str | None:
    normalized = (value or "").strip()
    if not normalized:
        return None
    if normalized.startswith("/media/"):
        return normalized
    if not normalized.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="Зображення потрібно завантажити файлом")
    try:
        header, encoded = normalized.split(",", 1)
        mime_type = header[5:].split(";", 1)[0].lower()
        extension = _media_extension(mime_type)
        if not extension or ";base64" not in header.lower():
            raise ValueError
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=422, detail="Некоректний файл зображення")
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Зображення має бути не більше 2 МБ")
    target_dir = EVENT_MEDIA_DIR if category == "events" else PROFILE_MEDIA_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{secrets.token_hex(20)}{extension}"
    (target_dir / filename).write_bytes(raw)
    return f"/media/{category}/{filename}"


def remove_stored_image(value: str | None, category: str) -> None:
    prefix = f"/media/{category}/"
    normalized = (value or "").strip()
    if not normalized.startswith(prefix):
        return
    target_dir = (MEDIA_ROOT / category).resolve()
    target = (target_dir / Path(normalized).name).resolve()
    if target.parent != target_dir:
        return
    try:
        target.unlink(missing_ok=True)
    except OSError:
        # Deleting the database record is authoritative; an unavailable media
        # file must not prevent the organizer from deleting the event.
        pass


def migrate_embedded_images() -> None:
    EVENT_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    PROFILE_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    with Session(engine) as session:
        changed = False
        for activity in session.exec(select(Activity)).all():
            if activity.image_url and activity.image_url.startswith("data:image/"):
                try:
                    activity.image_url = store_image(activity.image_url, "events")
                except HTTPException:
                    activity.image_url = None
                session.add(activity)
                changed = True
            elif activity.image_url and not activity.image_url.startswith("/media/"):
                activity.image_url = None
                session.add(activity)
                changed = True
        for user in session.exec(select(User)).all():
            if user.photo_url and user.photo_url.startswith("data:image/"):
                try:
                    user.photo_url = store_image(user.photo_url, "profiles")
                except HTTPException:
                    user.photo_url = None
                session.add(user)
                changed = True
            elif user.photo_url and not user.photo_url.startswith("/media/"):
                user.photo_url = None
                session.add(user)
                changed = True
        if changed:
            session.commit()


def serialize_activities(activities: Iterable[Activity], session: Session) -> list[ActivityRead]:
    items = list(activities)
    if not items:
        return []
    ids = [item.id for item in items]
    owners = {row.activity_id: row for row in session.exec(select(EventOwner).where(EventOwner.activity_id.in_(ids))).all()}
    locations = {row.activity_id: row for row in session.exec(select(EventLocation).where(EventLocation.activity_id.in_(ids))).all()}
    memberships_by_activity: dict[int, list[EventMember]] = defaultdict(list)
    memberships = session.exec(
        select(EventMember).where(EventMember.activity_id.in_(ids)).order_by(EventMember.joined_at, EventMember.id)
    ).all()
    for membership in memberships:
        memberships_by_activity[membership.activity_id].append(membership)
    result = []
    for activity in items:
        owner = owners.get(activity.id)
        location = locations.get(activity.id)
        members = memberships_by_activity.get(activity.id, [])
        result.append(ActivityRead(
            id=activity.id,
            title=activity.title,
            description=activity.description,
            code=activity.code,
            visibility=activity.visibility,
            image_url=activity.image_url,
            capacity=activity.capacity,
            pin_type=activity.pin_type,
            participant_count=len(members),
            participant_user_ids=[member.user_id for member in members],
            start_time=activity.start_time,
            end_time=activity.end_time,
            created_at=activity.created_at,
            host_user_id=owner.user_id if owner else None,
            latitude=location.latitude if location else None,
            longitude=location.longitude if location else None,
        ))
    return result


def activity_to_read(activity: Activity, session: Session) -> ActivityRead:
    return serialize_activities([activity], session)[0]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    create_db_and_tables()
    migrate_embedded_images()
    yield


app = FastAPI(title="Outdoor Activity API", version="0.3.0", lifespan=lifespan)

allowed_origins = [item.strip() for item in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def support_api_prefix(request: Request, call_next):
    # The production frontend uses /api while the historic dev API used root
    # routes. Supporting both keeps old clients working and enables one-server
    # deployment without a separate reverse proxy.
    path = request.scope.get("path", "")
    if path == "/api":
        request.scope["path"] = "/"
    elif path.startswith("/api/"):
        request.scope["path"] = path[4:]
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(self)")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
    return response


app.mount("/media", StaticFiles(directory=MEDIA_ROOT, check_dir=False), name="media")


@app.get("/health")
def health():
    return {"status": "ok"}


# -------------------- Authentication --------------------

@app.post("/users", response_model=AuthRead, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, request: Request, session: Session = Depends(get_session)):
    check_rate_limit(request, "register", 8, 600)
    if session.exec(select(User).where(User.email == data.email)).first() is not None:
        raise HTTPException(status_code=409, detail="Email already використовується")
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        photo_url=store_image(data.photo_url, "profiles"),
        friend_code=generate_unique_code(session, User, "friend_code", 8, string.ascii_uppercase + string.digits),
        location_visibility="friends",
        location_sharing_enabled=True,
    )
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Email already використовується")
    session.refresh(user)
    return create_auth(session, user)


@app.post("/login", response_model=AuthRead)
def login_user(data: UserLogin, request: Request, session: Session = Depends(get_session)):
    check_rate_limit(request, "login", 12, 600)
    user = session.exec(select(User).where(User.email == data.email)).first()
    if user is None or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Невірний email або пароль")
    if password_hash_needs_upgrade(user.password_hash):
        user.password_hash = hash_password(data.password)
        session.add(user)
        session.commit()
        session.refresh(user)
    return create_auth(session, user)


@app.post("/auth/google", response_model=AuthRead)
def google_login(data: GoogleLogin, request: Request, session: Session = Depends(get_session)):
    check_rate_limit(request, "google-login", 15, 600)
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Sign-In не налаштовано на сервері")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
        payload = id_token.verify_oauth2_token(data.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    except Exception:
        raise HTTPException(status_code=401, detail="Google credential не пройшов перевірку")
    if payload.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Недійсний видавець Google token")
    if not payload.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email не підтверджено")
    google_sub = str(payload.get("sub") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    name = str(payload.get("name") or payload.get("given_name") or "Користувач Google").strip()
    if not google_sub or not email:
        raise HTTPException(status_code=401, detail="Google не повернув ідентифікатор акаунта")
    user = session.exec(select(User).where(User.google_sub == google_sub)).first()
    if user is None:
        user = session.exec(select(User).where(User.email == email)).first()
        if user is None:
            user = User(
                name=name[:60], email=email, google_sub=google_sub,
                friend_code=generate_unique_code(session, User, "friend_code", 8, string.ascii_uppercase + string.digits),
                location_visibility="friends", location_sharing_enabled=True,
            )
        elif user.google_sub and user.google_sub != google_sub:
            raise HTTPException(status_code=409, detail="Цей email уже пов’язаний з іншим Google акаунтом")
        else:
            user.google_sub = google_sub
        session.add(user)
        session.commit()
        session.refresh(user)
    return create_auth(session, user)


@app.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    del current_user
    if credentials:
        auth = session.exec(select(AuthSession).where(AuthSession.token_hash == _token_hash(credentials.credentials))).first()
        if auth:
            session.delete(auth)
            session.commit()
    return None


@app.get("/users/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: int, current_user: User = Depends(get_current_user)):
    require_same_user(user_id, current_user)
    return current_user


@app.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_same_user(user_id, current_user)
    if data.name is not None:
        current_user.name = data.name
    if "photo_url" in data.model_fields_set:
        current_user.photo_url = store_image(data.photo_url, "profiles")
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


# -------------------- Locations and friends --------------------

@app.put("/users/{user_id}/location", response_model=FriendLocationRead)
def update_user_location(
    user_id: int,
    data: LocationUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_same_user(user_id, current_user)
    if current_user.location_visibility == "none" or not current_user.location_sharing_enabled:
        raise HTTPException(status_code=409, detail="Поширення геолокації вимкнено")
    location = session.get(UserLocation, current_user.id)
    now = utc_now()
    if location is None:
        location = UserLocation(user_id=current_user.id, latitude=data.latitude, longitude=data.longitude, accuracy=data.accuracy, updated_at=now)
    else:
        location.latitude, location.longitude, location.accuracy, location.updated_at = data.latitude, data.longitude, data.accuracy, now
    session.add(location)
    session.commit()
    session.refresh(location)
    return FriendLocationRead(
        user_id=current_user.id, name=current_user.name, photo_url=current_user.photo_url,
        latitude=location.latitude, longitude=location.longitude, accuracy=location.accuracy,
        updated_at=location.updated_at, age_seconds=0, presence="online",
    )


@app.put("/users/{user_id}/location-sharing", response_model=UserRead)
def set_location_sharing(
    user_id: int,
    data: LocationSharingUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_same_user(user_id, current_user)
    current_user.location_sharing_enabled = data.enabled
    current_user.location_visibility = "friends" if data.enabled else "none"
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@app.put("/users/{user_id}/location-visibility", response_model=UserRead)
def set_location_visibility(
    user_id: int,
    data: LocationVisibilityUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_same_user(user_id, current_user)
    visibility = data.visibility.strip().lower()
    if visibility not in {"none", "friends", "everyone"}:
        raise HTTPException(status_code=422, detail="visibility: none, friends або everyone")
    current_user.location_visibility = visibility
    current_user.location_sharing_enabled = visibility != "none"
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@app.post("/users/{user_id}/friends/request", response_model=FriendConnectionRead, status_code=201)
def send_friend_request(
    user_id: int,
    data: FriendRequestCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_same_user(user_id, current_user)
    check_rate_limit(request, f"friend-code:{current_user.id}", 20, 3600)
    addressee = session.exec(select(User).where(User.friend_code == data.friend_code.strip().upper())).first()
    if addressee is None:
        raise HTTPException(status_code=404, detail="Код друга не знайдено")
    if addressee.id == current_user.id:
        raise HTTPException(status_code=400, detail="Не можна додати себе")
    pair_key = friendship_pair(current_user.id, addressee.id)
    if session.exec(select(Friendship).where(Friendship.pair_key == pair_key)).first() is not None:
        raise HTTPException(status_code=409, detail="Запит або дружба вже існує")
    friendship = Friendship(
        requester_id=current_user.id, addressee_id=addressee.id,
        pair_key=pair_key, status="pending",
    )
    session.add(friendship)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Запит або дружба вже існує")
    session.refresh(friendship)
    return FriendConnectionRead(
        friendship_id=friendship.id, user_id=addressee.id, name=addressee.name,
        photo_url=addressee.photo_url, friend_code=addressee.friend_code,
        status=friendship.status, direction="outgoing", created_at=friendship.created_at,
    )


@app.post("/users/{user_id}/friends/{friendship_id}/accept", response_model=FriendConnectionRead)
def accept_friend_request(
    user_id: int,
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_same_user(user_id, current_user)
    friendship = session.get(Friendship, friendship_id)
    if friendship is None:
        raise HTTPException(status_code=404, detail="Запит не знайдено")
    if friendship.addressee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Цей запит адресований іншому користувачу")
    if friendship.status != "pending":
        raise HTTPException(status_code=409, detail="Запит уже оброблено")
    friendship.status = "accepted"
    session.add(friendship)
    session.commit()
    session.refresh(friendship)
    friend = get_user_or_404(friendship.requester_id, session)
    return FriendConnectionRead(
        friendship_id=friendship.id, user_id=friend.id, name=friend.name,
        photo_url=friend.photo_url, friend_code=friend.friend_code,
        status="accepted", direction="accepted", created_at=friendship.created_at,
    )


@app.delete("/users/{user_id}/friends/{friendship_id}", status_code=204)
def delete_friendship(
    user_id: int,
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    require_same_user(user_id, current_user)
    friendship = session.get(Friendship, friendship_id)
    if friendship is None:
        raise HTTPException(status_code=404, detail="Запит або дружбу не знайдено")
    if current_user.id not in {friendship.requester_id, friendship.addressee_id}:
        raise HTTPException(status_code=403, detail="Недостатньо прав")
    session.delete(friendship)
    session.commit()
    return None


def _friend_connections(user: User, session: Session) -> list[FriendConnectionRead]:
    friendships = session.exec(
        select(Friendship).where(or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id)).order_by(Friendship.created_at.desc())
    ).all()
    other_ids = {row.addressee_id if row.requester_id == user.id else row.requester_id for row in friendships}
    users = {item.id: item for item in session.exec(select(User).where(User.id.in_(other_ids))).all()} if other_ids else {}
    result = []
    for friendship in friendships:
        is_requester = friendship.requester_id == user.id
        other = users.get(friendship.addressee_id if is_requester else friendship.requester_id)
        if not other:
            continue
        direction = "accepted" if friendship.status == "accepted" else ("outgoing" if is_requester else "incoming")
        result.append(FriendConnectionRead(
            friendship_id=friendship.id, user_id=other.id, name=other.name,
            photo_url=other.photo_url, friend_code=other.friend_code,
            status=friendship.status, direction=direction, created_at=friendship.created_at,
        ))
    return result


@app.get("/users/{user_id}/friends", response_model=list[FriendConnectionRead])
def list_friends(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    require_same_user(user_id, current_user)
    return _friend_connections(current_user, session)


def _location_read(
    user: User,
    location: UserLocation,
    now: datetime,
    friendship_status: str | None = None,
) -> FriendLocationRead | None:
    age = max(0, int((now - normalized_utc(location.updated_at)).total_seconds()))
    if age > LIVE_LOCATION_MAX_AGE_SECONDS:
        return None
    presence = "online" if age <= 30 else "stale" if age <= 120 else "offline"
    return FriendLocationRead(
        user_id=user.id, name=user.name, photo_url=user.photo_url, friend_code=user.friend_code,
        friendship_status=friendship_status,
        latitude=location.latitude, longitude=location.longitude, accuracy=location.accuracy,
        updated_at=location.updated_at, age_seconds=age, presence=presence,
    )


@app.get("/users/{user_id}/friends/locations", response_model=list[FriendLocationRead])
def list_friend_locations(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    require_same_user(user_id, current_user)
    accepted = [item for item in _friend_connections(current_user, session) if item.status == "accepted"]
    ids = [item.user_id for item in accepted]
    if not ids:
        return []
    users = {item.id: item for item in session.exec(select(User).where(User.id.in_(ids))).all()}
    locations = {item.user_id: item for item in session.exec(select(UserLocation).where(UserLocation.user_id.in_(ids))).all()}
    now = utc_now()
    result = []
    for friend_id in ids:
        friend, location = users.get(friend_id), locations.get(friend_id)
        if not friend or not location or not friend.location_sharing_enabled or friend.location_visibility not in {"friends", "everyone"}:
            continue
        item = _location_read(friend, location, now, friendship_status="accepted")
        if item:
            result.append(item)
    return result


@app.get("/users/{user_id}/visible-locations", response_model=list[FriendLocationRead])
def list_visible_locations(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    require_same_user(user_id, current_user)
    now = utc_now()
    friendships = session.exec(select(Friendship).where(
        or_(Friendship.requester_id == current_user.id, Friendship.addressee_id == current_user.id)
    )).all()
    friendships_by_user = {
        (row.addressee_id if row.requester_id == current_user.id else row.requester_id): row
        for row in friendships
    }
    friend_ids = {
        row.addressee_id if row.requester_id == current_user.id else row.requester_id
        for row in friendships if row.status == "accepted"
    }

    # Event presence is temporary and is valid only when the viewer has a fresh
    # location and both users belong to the same active event geofence.
    viewer_location = session.get(UserLocation, current_user.id)
    viewer_activity_ids: set[int] = set()
    if location_is_fresh(viewer_location, now):
        active_memberships = session.exec(
            select(EventMember)
            .join(Activity, Activity.id == EventMember.activity_id)
            .where((EventMember.user_id == current_user.id) & active_activity_condition(now))
        ).all()
        viewer_activity_ids = {row.activity_id for row in active_memberships}

    event_locations = {
        row.activity_id: row
        for row in session.exec(select(EventLocation).where(EventLocation.activity_id.in_(viewer_activity_ids))).all()
    } if viewer_activity_ids else {}
    viewer_near_activity_ids = {
        activity_id for activity_id, event_location in event_locations.items()
        if event_geofence_match(viewer_location, event_location)
    }

    memberships_by_user: dict[int, set[int]] = defaultdict(set)
    event_user_ids: set[int] = set()
    if viewer_near_activity_ids:
        for row in session.exec(select(EventMember).where(EventMember.activity_id.in_(viewer_near_activity_ids))).all():
            if row.user_id != current_user.id:
                memberships_by_user[row.user_id].add(row.activity_id)
                event_user_ids.add(row.user_id)

    # Query only users who could be visible: friends, shared-event members, or
    # users who explicitly selected public location sharing.
    candidate_filter = or_(
        User.location_visibility == "everyone",
        User.id.in_(friend_ids | event_user_ids) if (friend_ids or event_user_ids) else User.id == -1,
    )
    users = session.exec(select(User).where((User.id != current_user.id) & candidate_filter)).all()
    user_ids = [user.id for user in users]
    locations = {
        row.user_id: row
        for row in session.exec(select(UserLocation).where(UserLocation.user_id.in_(user_ids))).all()
    } if user_ids else {}

    result = []
    for candidate in users:
        if not candidate.location_sharing_enabled or candidate.location_visibility == "none":
            continue
        location = locations.get(candidate.id)
        if not location_is_fresh(location, now):
            continue
        is_friend = candidate.id in friend_ids
        standard_can_see = candidate.location_visibility == "everyone" or (candidate.location_visibility == "friends" and is_friend)
        shared_event_can_see = any(
            event_geofence_match(location, event_locations[activity_id])
            for activity_id in memberships_by_user.get(candidate.id, set())
        )
        if not standard_can_see and not shared_event_can_see:
            continue
        item = _location_read(
            candidate,
            location,
            now,
            friendship_status=friendships_by_user.get(candidate.id).status
            if candidate.id in friendships_by_user else None,
        )
        if item:
            result.append(item)
    return result


# -------------------- Activities --------------------

@app.post("/activities", response_model=ActivityRead, status_code=201)
def create_activity(
    data: ActivityCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if data.user_id is not None:
        require_same_user(data.user_id, current_user)
    activity = Activity(
        title=data.title,
        description=data.description,
        visibility=normalize_event_visibility(data.visibility),
        image_url=store_image(data.image_url, "events"),
        capacity=data.capacity,
        pin_type=data.pin_type if data.pin_type in PIN_TYPES else "default",
        start_time=data.start_time,
        end_time=data.end_time,
        code=generate_unique_code(session, Activity, "code", 6, string.ascii_uppercase + string.digits),
    )
    session.add(activity)
    session.flush()
    session.add(EventOwner(activity_id=activity.id, user_id=current_user.id))
    session.add(EventLocation(activity_id=activity.id, latitude=data.latitude, longitude=data.longitude))
    session.add(EventMember(activity_id=activity.id, user_id=current_user.id))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Не вдалося створити подію")
    session.refresh(activity)
    return activity_to_read(activity, session)


@app.get("/activities/public/list", response_model=list[ActivityRead])
def list_public_activities(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    del current_user
    activities = session.exec(
        select(Activity).where((Activity.visibility == "public") & active_activity_condition()).order_by(Activity.start_time, Activity.created_at.desc())
    ).all()
    return serialize_activities(activities, session)


@app.get("/activities/visible/list", response_model=list[ActivityRead])
def list_visible_activities(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    owned_ids = {row.activity_id for row in session.exec(select(EventOwner).where(EventOwner.user_id == current_user.id)).all()}
    joined_ids = {row.activity_id for row in session.exec(select(EventMember).where(EventMember.user_id == current_user.id)).all()}
    friendships = session.exec(select(Friendship).where(
        (Friendship.status == "accepted") & or_(Friendship.requester_id == current_user.id, Friendship.addressee_id == current_user.id)
    )).all()
    friend_ids = {
        row.addressee_id if row.requester_id == current_user.id else row.requester_id
        for row in friendships
    }
    friend_event_ids = {
        row.activity_id for row in session.exec(select(EventOwner).where(EventOwner.user_id.in_(friend_ids))).all()
    } if friend_ids else set()
    direct_ids = owned_ids | joined_ids
    visibility_filter = or_(
        Activity.visibility == "public",
        Activity.id.in_(direct_ids) if direct_ids else Activity.id == -1,
        ((Activity.visibility == "friends") & Activity.id.in_(friend_event_ids)) if friend_event_ids else Activity.id == -1,
    )
    activities = session.exec(
        select(Activity)
        .where(active_activity_condition() & visibility_filter)
        .order_by(Activity.start_time, Activity.created_at.desc())
    ).all()
    return serialize_activities(activities, session)


@app.get("/activities/{code}", response_model=ActivityRead)
def get_activity(code: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    activity = get_activity_or_404(code, session)
    ensure_can_view_activity(activity, current_user, session)
    return activity_to_read(activity, session)


@app.post("/activities/{code}/join", response_model=ActivityRead, status_code=201)
def join_activity(
    code: str,
    data: ActivityJoin,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if data.user_id is not None:
        require_same_user(data.user_id, current_user)
    check_rate_limit(request, f"event-code:{current_user.id}", 30, 3600)
    activity = get_activity_or_404(code, session)
    owner = session.get(EventOwner, activity.id)
    if activity.visibility == "friends" and owner and owner.user_id != current_user.id and not are_users_friends(current_user.id, owner.user_id, session):
        raise HTTPException(status_code=403, detail="Ця подія доступна лише друзям організатора")

    # One atomic SQLite statement handles duplicate protection and the capacity
    # predicate together, avoiding count-then-insert races.
    now = utc_now().isoformat()
    statement = text("""
        INSERT OR IGNORE INTO eventmember (activity_id, user_id, joined_at)
        SELECT :activity_id, :user_id, :joined_at
        WHERE :capacity IS NULL OR (
            SELECT COUNT(*) FROM eventmember WHERE activity_id = :activity_id
        ) < :capacity
    """)
    result = session.execute(statement, {
        "activity_id": activity.id, "user_id": current_user.id,
        "joined_at": now, "capacity": activity.capacity,
    })
    session.commit()
    if result.rowcount == 0 and not is_event_member(activity.id, current_user.id, session):
        raise HTTPException(status_code=409, detail="У події вже немає вільних місць")
    return activity_to_read(activity, session)


@app.delete("/activities/{code}/members/{user_id}", status_code=204)
def remove_activity_member(
    code: str,
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    activity = get_activity_or_404(code, session)
    owner = session.get(EventOwner, activity.id)
    is_owner = bool(owner and owner.user_id == current_user.id)
    if user_id != current_user.id and not is_owner:
        raise HTTPException(status_code=403, detail="Лише організатор може видаляти інших учасників")
    if owner and owner.user_id == user_id:
        raise HTTPException(status_code=409, detail="Організатор не може вийти з власної події")
    membership = session.exec(select(EventMember).where(
        (EventMember.activity_id == activity.id) & (EventMember.user_id == user_id)
    )).first()
    if membership is None:
        raise HTTPException(status_code=404, detail="Учасника не знайдено в цій події")
    session.delete(membership)
    session.commit()
    return None


@app.delete("/activities/{code}", status_code=204)
def delete_activity(
    code: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    activity = get_activity_or_404(code, session)
    owner = session.get(EventOwner, activity.id)
    if owner is None or owner.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Лише організатор може видалити подію")
    image_url = activity.image_url
    session.delete(activity)
    session.commit()
    remove_stored_image(image_url, "events")
    return None


@app.get("/activities/{code}/participants", response_model=list[EventParticipantRead])
def list_participants(code: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    activity = get_activity_or_404(code, session)
    ensure_can_view_activity(activity, current_user, session)
    owner = session.get(EventOwner, activity.id)
    memberships = session.exec(select(EventMember).where(EventMember.activity_id == activity.id).order_by(EventMember.joined_at)).all()
    user_ids = [row.user_id for row in memberships]
    users = {row.id: row for row in session.exec(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    return [
        EventParticipantRead(
            user_id=member.user_id, name=users[member.user_id].name,
            photo_url=users[member.user_id].photo_url,
            is_host=bool(owner and owner.user_id == member.user_id),
            joined_at=member.joined_at,
        )
        for member in memberships if member.user_id in users
    ]


@app.get("/users/{user_id}/activities", response_model=list[ActivityRead])
def list_user_activities(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    require_same_user(user_id, current_user)
    memberships = session.exec(select(EventMember).where(EventMember.user_id == current_user.id).order_by(EventMember.joined_at.desc())).all()
    activity_ids = [row.activity_id for row in memberships]
    activities = session.exec(select(Activity).where((Activity.id.in_(activity_ids)) & active_activity_condition())).all() if activity_ids else []
    order = {activity_id: index for index, activity_id in enumerate(activity_ids)}
    activities.sort(key=lambda item: order.get(item.id, len(order)))
    return serialize_activities(activities, session)


@app.get("/users/{user_id}/friend-activities", response_model=list[ActivityRead])
def list_friend_activities(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    require_same_user(user_id, current_user)
    friendships = session.exec(select(Friendship).where(
        (Friendship.status == "accepted") & or_(Friendship.requester_id == current_user.id, Friendship.addressee_id == current_user.id)
    )).all()
    friend_ids = {row.addressee_id if row.requester_id == current_user.id else row.requester_id for row in friendships}
    if not friend_ids:
        return []
    owners = session.exec(select(EventOwner).where(EventOwner.user_id.in_(friend_ids))).all()
    ids = [row.activity_id for row in owners]
    activities = session.exec(select(Activity).where(
        (Activity.id.in_(ids)) & (Activity.visibility.in_(["public", "friends"])) & active_activity_condition()
    ).order_by(Activity.start_time, Activity.created_at.desc())).all() if ids else []
    return serialize_activities(activities, session)


# Checkpoint creation now matches the frontend API. Only the event owner may edit.
@app.get("/activities/{code}/checkpoints", response_model=list[CheckpointRead])
def list_checkpoints(code: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    activity = get_activity_or_404(code, session)
    ensure_can_view_activity(activity, current_user, session)
    return session.exec(select(Checkpoint).where(Checkpoint.activity_id == activity.id).order_by(Checkpoint.order_index, Checkpoint.id)).all()


@app.post("/activities/{code}/checkpoints", response_model=CheckpointRead, status_code=201)
def create_checkpoint(
    code: str,
    data: CheckpointCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    activity = get_activity_or_404(code, session)
    owner = session.get(EventOwner, activity.id)
    if owner is None or owner.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Лише організатор може додавати точки")
    checkpoint = Checkpoint(activity_id=activity.id, **data.model_dump())
    session.add(checkpoint)
    session.commit()
    session.refresh(checkpoint)
    return checkpoint


# Serve a production Vite build from the same process. API routes above remain
# authoritative; unknown browser paths fall back to index.html for React Router.
@app.get("/{full_path:path}", include_in_schema=False)
def frontend_fallback(full_path: str):
    if not FRONTEND_DIST.exists():
        raise HTTPException(status_code=404, detail="Not found")
    requested = (FRONTEND_DIST / full_path).resolve()
    if requested.is_file() and FRONTEND_DIST.resolve() in requested.parents:
        return FileResponse(requested, media_type=mimetypes.guess_type(requested.name)[0])
    return FileResponse(FRONTEND_DIST / "index.html", media_type="text/html")
