import base64
import hashlib
import hmac
import os
import random
import string
from contextlib import asynccontextmanager
from datetime import timezone

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlmodel import Session, select

from .database import create_db_and_tables, get_session
from .models import (
    Activity,
    ActivityCreate,
    ActivityJoin,
    ActivityRead,
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
    LocationSharingUpdate,
    LocationUpdate,
    LocationVisibilityUpdate,
    Participant,
    ParticipantJoin,
    ParticipantRead,
    User,
    UserCreate,
    UserLocation,
    UserLogin,
    UserRead,
    UserUpdate,
    utc_now,
)


def generate_unique_code(
    session: Session,
    model,
    field_name: str,
    length: int,
    alphabet: str,
) -> str:
    field = getattr(model, field_name)

    for _ in range(40):
        code = "".join(random.choices(alphabet, k=length))
        existing = session.exec(select(model).where(field == code)).first()
        if existing is None:
            return code

    raise RuntimeError(f"Could not generate unique {field_name}")


def get_activity_or_404(code: str, session: Session) -> Activity:
    activity = session.exec(
        select(Activity).where(Activity.code == code.upper())
    ).first()
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity



def get_user_or_404(user_id: int, session: Session) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


EVENT_VISIBILITIES = {"public", "friends", "private"}


def normalize_event_visibility(value: str) -> str:
    visibility = (value or "").strip().lower()
    if visibility not in EVENT_VISIBILITIES:
        raise HTTPException(
            status_code=422,
            detail="visibility must be one of: public, friends, private",
        )
    return visibility


def are_users_friends(user_id: int, other_user_id: int, session: Session) -> bool:
    if user_id == other_user_id:
        return True
    friendship = session.exec(
        select(Friendship).where(
            (Friendship.status == "accepted")
            & or_(
                (Friendship.requester_id == user_id)
                & (Friendship.addressee_id == other_user_id),
                (Friendship.requester_id == other_user_id)
                & (Friendship.addressee_id == user_id),
            )
        )
    ).first()
    return friendship is not None


def normalized_utc(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return base64.b64encode(salt + dk).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        raw = base64.b64decode(password_hash)
        salt, stored = raw[:16], raw[16:]
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(dk, stored)
    except Exception:
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="Outdoor Activity API",
    version="0.2.0",
    lifespan=lifespan,
)

# Hackathon-friendly CORS. For production, restrict this to known frontend origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# -------------------- Users / friends / live locations --------------------

@app.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, session: Session = Depends(get_session)):
    email = (data.email or "").strip().lower() or None
    if email:
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing is not None:
            raise HTTPException(status_code=400, detail="Email already in use")

    friend_code = generate_unique_code(
        session,
        User,
        "friend_code",
        8,
        string.ascii_uppercase + string.digits,
    )
    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password) if data.password else None,
        photo_url=(data.photo_url or "").strip() or None,
        friend_code=friend_code,
        location_visibility="friends",
        location_sharing_enabled=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.post("/login", response_model=UserRead)
def login_user(data: UserLogin, session: Session = Depends(get_session)):
    email = data.email.strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user


@app.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: int, session: Session = Depends(get_session)):
    return get_user_or_404(user_id, session)




@app.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    data: UserUpdate,
    session: Session = Depends(get_session),
):
    user = get_user_or_404(user_id, session)

    if data.name is not None:
        user.name = data.name.strip()
    if data.photo_url is not None:
        user.photo_url = data.photo_url.strip() or None

    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.put("/users/{user_id}/location", response_model=FriendLocationRead)
def update_user_location(
    user_id: int,
    data: LocationUpdate,
    session: Session = Depends(get_session),
):
    user = get_user_or_404(user_id, session)
    if user.location_visibility == "none" or not user.location_sharing_enabled:
        raise HTTPException(status_code=409, detail="Location sharing is disabled")

    location = session.get(UserLocation, user_id)
    now = utc_now()

    if location is None:
        location = UserLocation(
            user_id=user_id,
            latitude=data.latitude,
            longitude=data.longitude,
            accuracy=data.accuracy,
            updated_at=now,
        )
    else:
        location.latitude = data.latitude
        location.longitude = data.longitude
        location.accuracy = data.accuracy
        location.updated_at = now

    session.add(location)
    session.commit()
    session.refresh(location)

    return FriendLocationRead(
        user_id=user.id,
        name=user.name,
        photo_url=user.photo_url,
        latitude=location.latitude,
        longitude=location.longitude,
        accuracy=location.accuracy,
        updated_at=location.updated_at,
        age_seconds=0,
        presence="online",
    )


@app.put("/users/{user_id}/location-sharing", response_model=UserRead)
def set_location_sharing(
    user_id: int,
    data: LocationSharingUpdate,
    session: Session = Depends(get_session),
):
    # Backward-compatible endpoint used by older clients.
    user = get_user_or_404(user_id, session)
    user.location_sharing_enabled = data.enabled
    user.location_visibility = "friends" if data.enabled else "none"
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.put("/users/{user_id}/location-visibility", response_model=UserRead)
def set_location_visibility(
    user_id: int,
    data: LocationVisibilityUpdate,
    session: Session = Depends(get_session),
):
    user = get_user_or_404(user_id, session)
    visibility = data.visibility.strip().lower()
    if visibility not in {"none", "friends", "everyone"}:
        raise HTTPException(
            status_code=422,
            detail="visibility must be one of: none, friends, everyone",
        )

    user.location_visibility = visibility
    user.location_sharing_enabled = visibility != "none"
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.post(
    "/users/{user_id}/friends/request",
    response_model=FriendConnectionRead,
    status_code=status.HTTP_201_CREATED,
)
def send_friend_request(
    user_id: int,
    data: FriendRequestCreate,
    session: Session = Depends(get_session),
):
    requester = get_user_or_404(user_id, session)
    code = data.friend_code.strip().upper()
    addressee = session.exec(select(User).where(User.friend_code == code)).first()

    if addressee is None:
        raise HTTPException(status_code=404, detail="Friend code not found")
    if addressee.id == requester.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    existing = session.exec(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == requester.id)
                & (Friendship.addressee_id == addressee.id),
                (Friendship.requester_id == addressee.id)
                & (Friendship.addressee_id == requester.id),
            )
        )
    ).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Friendship already exists")

    friendship = Friendship(
        requester_id=requester.id,
        addressee_id=addressee.id,
        status="pending",
    )
    session.add(friendship)
    session.commit()
    session.refresh(friendship)

    return FriendConnectionRead(
        friendship_id=friendship.id,
        user_id=addressee.id,
        name=addressee.name,
        photo_url=addressee.photo_url,
        friend_code=addressee.friend_code,
        status=friendship.status,
        direction="outgoing",
        created_at=friendship.created_at,
    )


@app.post(
    "/users/{user_id}/friends/{friendship_id}/accept",
    response_model=FriendConnectionRead,
)
def accept_friend_request(
    user_id: int,
    friendship_id: int,
    session: Session = Depends(get_session),
):
    user = get_user_or_404(user_id, session)
    friendship = session.get(Friendship, friendship_id)

    if friendship is None:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if friendship.addressee_id != user.id:
        raise HTTPException(status_code=403, detail="This request is not addressed to you")
    if friendship.status != "pending":
        raise HTTPException(status_code=409, detail="Friend request is not pending")

    friendship.status = "accepted"
    session.add(friendship)
    session.commit()
    session.refresh(friendship)

    friend = get_user_or_404(friendship.requester_id, session)
    return FriendConnectionRead(
        friendship_id=friendship.id,
        user_id=friend.id,
        name=friend.name,
        photo_url=friend.photo_url,
        friend_code=friend.friend_code,
        status=friendship.status,
        direction="accepted",
        created_at=friendship.created_at,
    )


@app.delete(
    "/users/{user_id}/friends/{friendship_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_friendship(
    user_id: int,
    friendship_id: int,
    session: Session = Depends(get_session),
):
    user = get_user_or_404(user_id, session)
    friendship = session.get(Friendship, friendship_id)
    if friendship is None:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if user.id not in {friendship.requester_id, friendship.addressee_id}:
        raise HTTPException(status_code=403, detail="You cannot delete this friendship")

    session.delete(friendship)
    session.commit()
    return None


@app.get("/users/{user_id}/friends", response_model=list[FriendConnectionRead])
def list_friends(user_id: int, session: Session = Depends(get_session)):
    user = get_user_or_404(user_id, session)
    friendships = session.exec(
        select(Friendship)
        .where(
            or_(
                Friendship.requester_id == user.id,
                Friendship.addressee_id == user.id,
            )
        )
        .order_by(Friendship.created_at.desc())
    ).all()

    result: list[FriendConnectionRead] = []
    for friendship in friendships:
        is_requester = friendship.requester_id == user.id
        other_id = friendship.addressee_id if is_requester else friendship.requester_id
        other = session.get(User, other_id)
        if other is None:
            continue

        if friendship.status == "accepted":
            direction = "accepted"
        else:
            direction = "outgoing" if is_requester else "incoming"

        result.append(
            FriendConnectionRead(
                friendship_id=friendship.id,
                user_id=other.id,
                name=other.name,
                photo_url=other.photo_url,
                friend_code=other.friend_code,
                status=friendship.status,
                direction=direction,
                created_at=friendship.created_at,
            )
        )

    return result


@app.get(
    "/users/{user_id}/friends/locations",
    response_model=list[FriendLocationRead],
)
def list_friend_locations(user_id: int, session: Session = Depends(get_session)):
    user = get_user_or_404(user_id, session)
    friendships = session.exec(
        select(Friendship).where(
            (Friendship.status == "accepted")
            & or_(
                Friendship.requester_id == user.id,
                Friendship.addressee_id == user.id,
            )
        )
    ).all()

    now = utc_now()
    result: list[FriendLocationRead] = []

    for friendship in friendships:
        friend_id = (
            friendship.addressee_id
            if friendship.requester_id == user.id
            else friendship.requester_id
        )
        friend = session.get(User, friend_id)
        location = session.get(UserLocation, friend_id)

        if (
            friend is None
            or location is None
            or not friend.location_sharing_enabled
            or friend.location_visibility not in {"friends", "everyone"}
        ):
            continue

        age = max(
            0,
            int((now - normalized_utc(location.updated_at)).total_seconds()),
        )

        # Old coordinates are not shown on the live map.
        if age > 300:
            continue

        presence = "online" if age <= 20 else "stale" if age <= 60 else "offline"
        result.append(
            FriendLocationRead(
                user_id=friend.id,
                name=friend.name,
                photo_url=friend.photo_url,
                latitude=location.latitude,
                longitude=location.longitude,
                accuracy=location.accuracy,
                updated_at=location.updated_at,
                age_seconds=age,
                presence=presence,
            )
        )

    return result


@app.get(
    "/users/{user_id}/visible-locations",
    response_model=list[FriendLocationRead],
)
def list_visible_locations(user_id: int, session: Session = Depends(get_session)):
    """Return live locations visible to this user.

    Accepted friends are visible when they share with friends or everyone.
    Non-friends are visible only when they explicitly share with everyone.
    """
    viewer = get_user_or_404(user_id, session)
    friendships = session.exec(
        select(Friendship).where(
            (Friendship.status == "accepted")
            & or_(
                Friendship.requester_id == viewer.id,
                Friendship.addressee_id == viewer.id,
            )
        )
    ).all()

    friend_ids: set[int] = set()
    for friendship in friendships:
        friend_ids.add(
            friendship.addressee_id
            if friendship.requester_id == viewer.id
            else friendship.requester_id
        )

    now = utc_now()
    result: list[FriendLocationRead] = []
    users = session.exec(select(User).where(User.id != viewer.id)).all()

    for candidate in users:
        visibility = candidate.location_visibility or (
            "friends" if candidate.location_sharing_enabled else "none"
        )
        is_friend = candidate.id in friend_ids
        can_see = visibility == "everyone" or (
            visibility == "friends" and is_friend
        )
        if not can_see or not candidate.location_sharing_enabled:
            continue

        location = session.get(UserLocation, candidate.id)
        if location is None:
            continue

        age = max(
            0,
            int((now - normalized_utc(location.updated_at)).total_seconds()),
        )
        if age > 300:
            continue

        presence = "online" if age <= 20 else "stale" if age <= 60 else "offline"
        result.append(
            FriendLocationRead(
                user_id=candidate.id,
                name=candidate.name,
                photo_url=candidate.photo_url,
                latitude=location.latitude,
                longitude=location.longitude,
                accuracy=location.accuracy,
                updated_at=location.updated_at,
                age_seconds=age,
                presence=presence,
            )
        )

    return result


@app.get("/users/{user_id}/friend-activities", response_model=list[ActivityRead])
def list_friend_activities(user_id: int, session: Session = Depends(get_session)):
    user = get_user_or_404(user_id, session)
    friendships = session.exec(
        select(Friendship).where(
            (Friendship.status == "accepted")
            & or_(
                Friendship.requester_id == user.id,
                Friendship.addressee_id == user.id,
            )
        )
    ).all()

    friend_ids = {
        friendship.addressee_id
        if friendship.requester_id == user.id
        else friendship.requester_id
        for friendship in friendships
    }
    if not friend_ids:
        return []

    owners = session.exec(
        select(EventOwner).where(EventOwner.user_id.in_(friend_ids))
    ).all()
    activity_ids = [owner.activity_id for owner in owners]
    if not activity_ids:
        return []

    activities = session.exec(
        select(Activity)
        .where(
            (Activity.id.in_(activity_ids))
            & (Activity.visibility.in_(["public", "friends"]))
        )
        .order_by(Activity.created_at.desc())
    ).all()
    return [activity_to_read(activity, session) for activity in activities]


# -------------------- Activities / events --------------------

def activity_to_read(activity: Activity, session: Session) -> ActivityRead:
    owner = session.get(EventOwner, activity.id)
    location = session.get(EventLocation, activity.id)
    return ActivityRead(
        id=activity.id,
        title=activity.title,
        description=activity.description,
        code=activity.code,
        visibility=activity.visibility,
        image_url=activity.image_url,
        start_time=activity.start_time,
        created_at=activity.created_at,
        host_user_id=owner.user_id if owner else None,
        latitude=location.latitude if location else None,
        longitude=location.longitude if location else None,
    )


def ensure_event_member(activity_id: int, user_id: int, session: Session) -> EventMember:
    existing = session.exec(
        select(EventMember).where(
            (EventMember.activity_id == activity_id) & (EventMember.user_id == user_id)
        )
    ).first()
    if existing is not None:
        return existing

    member = EventMember(activity_id=activity_id, user_id=user_id)
    session.add(member)
    session.commit()
    session.refresh(member)
    return member


@app.post(
    "/activities",
    response_model=ActivityRead,
    status_code=status.HTTP_201_CREATED,
)
def create_activity(data: ActivityCreate, session: Session = Depends(get_session)):
    user = get_user_or_404(data.user_id, session)
    activity = Activity(
        title=data.title.strip(),
        description=data.description.strip(),
        visibility=normalize_event_visibility(data.visibility),
        image_url=(data.image_url or "").strip() or None,
        start_time=data.start_time,
        code=generate_unique_code(
            session,
            Activity,
            "code",
            6,
            string.ascii_uppercase + string.digits,
        ),
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)

    session.add(EventOwner(activity_id=activity.id, user_id=user.id))
    session.add(
        EventLocation(
            activity_id=activity.id,
            latitude=data.latitude,
            longitude=data.longitude,
        )
    )
    session.add(EventMember(activity_id=activity.id, user_id=user.id))
    session.commit()
    return activity_to_read(activity, session)


@app.get("/activities/public/list", response_model=list[ActivityRead])
def list_public_activities(session: Session = Depends(get_session)):
    activities = session.exec(
        select(Activity)
        .where(Activity.visibility == "public")
        .order_by(Activity.created_at.desc())
    ).all()
    return [activity_to_read(activity, session) for activity in activities]


@app.get("/activities/{code}", response_model=ActivityRead)
def get_activity(code: str, session: Session = Depends(get_session)):
    return activity_to_read(get_activity_or_404(code, session), session)


@app.post(
    "/activities/{code}/join",
    response_model=ActivityRead,
    status_code=status.HTTP_201_CREATED,
)
def join_activity(
    code: str,
    data: ActivityJoin,
    session: Session = Depends(get_session),
):
    activity = get_activity_or_404(code, session)
    get_user_or_404(data.user_id, session)

    owner = session.get(EventOwner, activity.id)
    if (
        activity.visibility == "friends"
        and owner is not None
        and owner.user_id != data.user_id
        and not are_users_friends(data.user_id, owner.user_id, session)
    ):
        raise HTTPException(
            status_code=403,
            detail="Ця подія доступна лише друзям організатора",
        )

    ensure_event_member(activity.id, data.user_id, session)
    return activity_to_read(activity, session)


@app.delete(
    "/activities/{code}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def leave_activity(
    code: str,
    user_id: int,
    session: Session = Depends(get_session),
):
    activity = get_activity_or_404(code, session)
    get_user_or_404(user_id, session)

    owner = session.get(EventOwner, activity.id)
    if owner and owner.user_id == user_id:
        raise HTTPException(
            status_code=409,
            detail="Організатор не може від’єднатися від власної події",
        )

    membership = session.exec(
        select(EventMember).where(
            (EventMember.activity_id == activity.id)
            & (EventMember.user_id == user_id)
        )
    ).first()
    if membership is None:
        raise HTTPException(status_code=404, detail="Ви не є учасником цієї події")

    session.delete(membership)
    session.commit()
    return None


@app.get(
    "/activities/{code}/participants",
    response_model=list[EventParticipantRead],
)
def list_participants(code: str, session: Session = Depends(get_session)):
    activity = get_activity_or_404(code, session)
    owner = session.get(EventOwner, activity.id)
    memberships = session.exec(
        select(EventMember)
        .where(EventMember.activity_id == activity.id)
        .order_by(EventMember.joined_at)
    ).all()

    result: list[EventParticipantRead] = []
    for membership in memberships:
        user = session.get(User, membership.user_id)
        if user is None:
            continue
        result.append(
            EventParticipantRead(
                user_id=user.id,
                name=user.name,
                photo_url=user.photo_url,
                is_host=bool(owner and owner.user_id == user.id),
                joined_at=membership.joined_at,
            )
        )
    return result


@app.get("/users/{user_id}/activities", response_model=list[ActivityRead])
def list_user_activities(user_id: int, session: Session = Depends(get_session)):
    get_user_or_404(user_id, session)
    memberships = session.exec(
        select(EventMember)
        .where(EventMember.user_id == user_id)
        .order_by(EventMember.joined_at.desc())
    ).all()

    result: list[ActivityRead] = []
    for membership in memberships:
        activity = session.get(Activity, membership.activity_id)
        if activity is not None:
            result.append(activity_to_read(activity, session))
    return result


# Legacy checkpoint endpoints are intentionally left read-only for old local data.
# New events have exactly one EventLocation pin and do not create checkpoints.
@app.get("/activities/{code}/checkpoints", response_model=list[CheckpointRead])
def list_checkpoints(code: str, session: Session = Depends(get_session)):
    activity = get_activity_or_404(code, session)
    return session.exec(
        select(Checkpoint)
        .where(Checkpoint.activity_id == activity.id)
        .order_by(Checkpoint.order_index, Checkpoint.id)
    ).all()
