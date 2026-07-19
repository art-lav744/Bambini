from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlmodel import Session, select


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

from .achievements import sync_user_achievements  # noqa: E402
from .database import create_db_and_tables, engine  # noqa: E402
from .main import hash_password, verify_password  # noqa: E402
from .models import (  # noqa: E402
    Activity,
    EmailVerificationChallenge,
    EventLocation,
    EventMember,
    EventOwner,
    Friendship,
    User,
    UserCosmeticSelection,
    UserCustomization,
    UserLocation,
    UserNotification,
)


DEMO_PASSWORD = "Bambini123!"

USER_SPECS = (
    {
        "key": "olena",
        "name": "Олена",
        "email": "demo@bambini.local",
        "friend_code": "DEMO0001",
        "latitude": 48.92262,
        "longitude": 24.71115,
        "theme": "sunset",
        "orca_skin": "default",
        "header_style": "ukrainian",
        "bottom_style": "ukrainian",
        "background_style": "color-splash",
    },
    {
        "key": "marko",
        "name": "Марко",
        "email": "marko.demo@bambini.local",
        "friend_code": "DEMO0002",
        "latitude": 48.92275,
        "longitude": 24.71110,
        "theme": "blue",
        "orca_skin": "dolphin",
        "header_style": "default",
        "bottom_style": "default",
        "background_style": "arcade",
    },
    {
        "key": "sofia",
        "name": "Софія",
        "email": "sofia.demo@bambini.local",
        "friend_code": "DEMO0003",
        "latitude": 48.92258,
        "longitude": 24.71134,
        "theme": "green",
        "orca_skin": "default",
        "header_style": "default",
        "bottom_style": "otaku",
        "background_style": "candy-land",
    },
    {
        "key": "andrii",
        "name": "Андрій",
        "email": "andrii.demo@bambini.local",
        "friend_code": "DEMO0004",
        "latitude": 48.92243,
        "longitude": 24.71096,
        "theme": "red",
        "orca_skin": "default",
        "header_style": "default",
        "bottom_style": "default",
        "background_style": "volcano",
    },
    {
        "key": "kateryna",
        "name": "Катерина",
        "email": "kateryna.demo@bambini.local",
        "friend_code": "DEMO0005",
        "latitude": 48.92282,
        "longitude": 24.71130,
        "theme": "neon",
        "orca_skin": "default",
        "header_style": "default",
        "bottom_style": "default",
        "background_style": "digital-world",
    },
)

FRIENDSHIP_SPECS = (
    ("olena", "marko", "accepted"),
    ("sofia", "olena", "accepted"),
    ("andrii", "olena", "pending"),
    ("olena", "kateryna", "pending"),
)

EVENT_SPECS = (
    {
        "code": "DEMO01",
        "title": "Вечірня прогулянка центром",
        "description": "Зустрічаємося біля позначки, знайомимося та гуляємо містом.",
        "visibility": "public",
        "capacity": 8,
        "pin_type": "default",
        "tags": ["walk", "networking", "coffee"],
        "host": "olena",
        "members": ["olena", "marko", "sofia", "andrii", "kateryna"],
        "latitude": 48.92260,
        "longitude": 24.71110,
        "start_after": timedelta(hours=2),
        "duration": timedelta(hours=2),
    },
    {
        "code": "DEMO02",
        "title": "Пікнік із друзями",
        "description": "Невеликий пікнік у парку. Візьміть плед і щось до спільного столу.",
        "visibility": "friends",
        "capacity": 12,
        "pin_type": "volleyball",
        "tags": ["picnic", "walk", "family"],
        "host": "marko",
        "members": ["marko", "olena", "sofia"],
        "latitude": 48.92510,
        "longitude": 24.70780,
        "start_after": timedelta(days=1, hours=1),
        "duration": timedelta(hours=3),
    },
    {
        "code": "DEMO03",
        "title": "Вечір настільних ігор",
        "description": "Приватна зустріч для невеликої компанії. Приєднання за кодом події.",
        "visibility": "private",
        "capacity": 6,
        "pin_type": "eightball",
        "tags": ["board-games", "coffee"],
        "host": "sofia",
        "members": ["sofia", "olena"],
        "latitude": 48.91990,
        "longitude": 24.71520,
        "start_after": timedelta(days=2),
        "duration": timedelta(hours=3),
    },
)


@dataclass(frozen=True)
class SeedResult:
    users: int
    events: int
    friendships: int
    memberships: int


def _as_utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _friendship_pair(user_a: int, user_b: int) -> str:
    first, second = sorted((user_a, user_b))
    return f"{first}:{second}"


def _seed_user(session: Session, spec: dict, now: datetime) -> User:
    user = session.exec(select(User).where(User.email == spec["email"])).first()
    code_owner = session.exec(select(User).where(User.friend_code == spec["friend_code"])).first()
    if code_owner is not None and (user is None or code_owner.id != user.id):
        raise RuntimeError(f"Seed friend code {spec['friend_code']} is already used by another account")

    if user is None:
        user = User(
            name=spec["name"],
            email=spec["email"],
            password_hash=hash_password(DEMO_PASSWORD),
            friend_code=spec["friend_code"],
            location_visibility="everyone",
            location_sharing_enabled=True,
        )
    else:
        user.name = spec["name"]
        user.friend_code = spec["friend_code"]
        user.location_visibility = "everyone"
        user.location_sharing_enabled = True
        if not user.password_hash or not verify_password(DEMO_PASSWORD, user.password_hash):
            user.password_hash = hash_password(DEMO_PASSWORD)

    session.add(user)
    session.flush()

    challenge = session.get(EmailVerificationChallenge, user.id)
    if challenge is None:
        challenge = EmailVerificationChallenge(
            user_id=user.id,
            code_hash=hashlib.sha256(f"seed:{user.id}".encode()).hexdigest(),
            expires_at=now + timedelta(days=3650),
            last_sent_at=now,
            attempts=0,
            verified_at=now,
        )
    else:
        challenge.verified_at = now
        challenge.attempts = 0
    session.add(challenge)

    customization = session.get(UserCustomization, user.id)
    if customization is None:
        customization = UserCustomization(user_id=user.id)
    customization.orca_skin = spec["orca_skin"]
    customization.header_style = spec["header_style"]
    customization.bottom_style = spec["bottom_style"]
    customization.theme = spec["theme"]
    if customization.orca_skin == "dolphin":
        customization.header_style = "default"
        customization.bottom_style = "default"
    session.add(customization)

    cosmetic = session.get(UserCosmeticSelection, user.id)
    if cosmetic is None:
        cosmetic = UserCosmeticSelection(user_id=user.id)
    cosmetic.background_style = spec["background_style"]
    session.add(cosmetic)

    location = session.get(UserLocation, user.id)
    if location is None:
        location = UserLocation(
            user_id=user.id,
            latitude=spec["latitude"],
            longitude=spec["longitude"],
        )
    location.latitude = spec["latitude"]
    location.longitude = spec["longitude"]
    location.accuracy = 12
    location.updated_at = now
    session.add(location)
    return user


def _seed_friendship(
    session: Session,
    requester: User,
    addressee: User,
    status: str,
    now: datetime,
) -> Friendship:
    pair_key = _friendship_pair(requester.id, addressee.id)
    friendship = session.exec(select(Friendship).where(Friendship.pair_key == pair_key)).first()
    if friendship is None:
        friendship = Friendship(
            requester_id=requester.id,
            addressee_id=addressee.id,
            pair_key=pair_key,
            created_at=now,
        )
    friendship.requester_id = requester.id
    friendship.addressee_id = addressee.id
    friendship.status = status
    session.add(friendship)
    return friendship


def _seed_event(
    session: Session,
    spec: dict,
    users: dict[str, User],
    now: datetime,
) -> Activity:
    host = users[spec["host"]]
    activity = session.exec(select(Activity).where(Activity.code == spec["code"])).first()
    if activity is None:
        activity = Activity(code=spec["code"], title=spec["title"])
        session.add(activity)
        session.flush()
        session.add(EventOwner(activity_id=activity.id, user_id=host.id))
    else:
        owner = session.get(EventOwner, activity.id)
        if owner is None or owner.user_id != host.id:
            raise RuntimeError(f"Seed event code {spec['code']} is already used by another event")

    activity.title = spec["title"]
    activity.description = spec["description"]
    activity.visibility = spec["visibility"]
    activity.capacity = spec["capacity"]
    activity.pin_type = spec["pin_type"]
    activity.tags_json = json.dumps(spec["tags"], ensure_ascii=False)
    activity.start_time = now + spec["start_after"]
    activity.end_time = activity.start_time + spec["duration"]
    session.add(activity)
    session.flush()

    event_location = session.get(EventLocation, activity.id)
    if event_location is None:
        event_location = EventLocation(activity_id=activity.id)
    event_location.latitude = spec["latitude"]
    event_location.longitude = spec["longitude"]
    session.add(event_location)

    for user_key in spec["members"]:
        user = users[user_key]
        membership = session.exec(select(EventMember).where(
            (EventMember.activity_id == activity.id) & (EventMember.user_id == user.id)
        )).first()
        if membership is None:
            session.add(EventMember(activity_id=activity.id, user_id=user.id, joined_at=now))
    return activity


def _seed_notification(
    session: Session,
    user: User,
    kind: str,
    message: str,
    event_code: str | None,
    event_title: str,
    now: datetime,
) -> None:
    notification = session.exec(select(UserNotification).where(
        (UserNotification.user_id == user.id)
        & (UserNotification.kind == kind)
        & (UserNotification.event_title == event_title)
        & (UserNotification.message == message)
    )).first()
    if notification is None:
        session.add(UserNotification(
            user_id=user.id,
            kind=kind,
            message=message,
            event_code=event_code,
            event_title=event_title,
            created_at=now,
        ))


def seed_database(session: Session, now: datetime | None = None) -> SeedResult:
    """Create or refresh only Bambini's reserved demo records."""
    now = _as_utc(now)
    users = {spec["key"]: _seed_user(session, spec, now) for spec in USER_SPECS}
    session.flush()

    friendships = [
        _seed_friendship(session, users[requester], users[addressee], status, now)
        for requester, addressee, status in FRIENDSHIP_SPECS
    ]
    session.flush()

    activities: dict[str, Activity] = {}
    for spec in EVENT_SPECS:
        activity = _seed_event(session, spec, users, now)
        activities[spec["code"]] = activity
    session.flush()

    _seed_notification(
        session,
        users["olena"],
        "event_updated",
        "Організатор оновив час події «Пікнік із друзями».",
        activities["DEMO02"].code,
        activities["DEMO02"].title,
        now,
    )
    _seed_notification(
        session,
        users["olena"],
        "event_deleted",
        "Подію «Ранкова йога» було видалено організатором.",
        None,
        "Ранкова йога",
        now - timedelta(minutes=15),
    )
    session.flush()

    for user in users.values():
        sync_user_achievements(session, user.id)
    session.commit()

    membership_total = 0
    activity_ids = {activity.id for activity in activities.values()}
    if activity_ids:
        membership_total = len(session.exec(
            select(EventMember).where(EventMember.activity_id.in_(activity_ids))
        ).all())
    return SeedResult(
        users=len(users),
        events=len(activities),
        friendships=len(friendships),
        memberships=membership_total,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Create idempotent Bambini demo data")
    parser.parse_args()
    create_db_and_tables()
    with Session(engine) as session:
        result = seed_database(session)

    print("Bambini demo data is ready.")
    print(f"Users: {result.users}; events: {result.events}; friendships: {result.friendships}; memberships: {result.memberships}")
    print("Primary login: demo@bambini.local")
    print(f"Password: {DEMO_PASSWORD}")
    print("All other *.demo@bambini.local accounts use the same password.")


if __name__ == "__main__":
    main()
