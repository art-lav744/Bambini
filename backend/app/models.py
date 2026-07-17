from __future__ import annotations

import re
from datetime import datetime, timezone

from pydantic import field_validator, model_validator
from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_required(value: str, field_name: str, minimum: int, maximum: int) -> str:
    normalized = (value or "").strip()
    if len(normalized) < minimum:
        raise ValueError(f"{field_name} must contain at least {minimum} non-space characters")
    if len(normalized) > maximum:
        raise ValueError(f"{field_name} must contain at most {maximum} characters")
    return normalized


def _clean_optional_url(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def _normalize_email(value: str | None) -> str | None:
    normalized = (value or "").strip().lower()
    if not normalized:
        return None
    if len(normalized) > 320 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
        raise ValueError("Invalid email address")
    return normalized


def _require_aware_datetime(value: datetime | None, field_name: str) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone offset")
    return value.astimezone(timezone.utc)


ACTIVITY_TAGS = (
    "sport", "football", "basketball", "volleyball", "tennis", "table-tennis",
    "badminton", "padel-squash", "running", "cycling", "skate-roller", "swimming-pool",
    "water-sports", "martial-arts", "gymnastics-acro", "climbing", "extreme-sports", "winter-sports",
    "chess", "billiards-bowling", "golf", "walk", "picnic", "hiking",
    "camping", "excursion", "fishing-hunting", "stargazing", "birdwatching", "music-concert",
    "music-fest", "opera-ballet", "theater", "cinema-openair", "standup-comedy", "karaoke",
    "dj-set", "jam-session", "musical-instrument-lessons", "art-exhibition", "museum", "literature-club",
    "poetry-night", "painting-drawing", "sculpture-pottery", "photography", "handicraft", "modelling",
    "dance-bachata", "dance-modern", "board-games", "rpg-dnd", "pub-quiz", "gaming-pc-console",
    "esports", "anime-cosplay", "comic-con", "coffee", "tea-ceremony", "wine-tasting",
    "craft-beer", "cocktail-party", "food-court", "restaurant-opening", "cooking-masterclass", "vegan-vegetarian",
    "party-home", "night-club", "bar-hopping", "pool-party", "networking", "speed-dating",
    "business-conference", "startup-pitch", "it-meetup", "marketing-pr", "crypto-web3", "investing-finance",
    "e-commerce", "lecture", "seminar-training", "language-club", "science-pop", "tedx-format",
    "oratory-skills", "family-day", "kids-entertainment", "kids-development", "parenting-club", "baby-fairs",
    "fitness-group", "yoga-stretching", "meditation-sound-healing", "psychology-group", "beauty-day", "healthy-lifestyle",
    "spa-sauna", "charity-auction", "volunteer-work", "eco-cleanup", "animal-shelter-help", "blood-donation",
    "urbanism-community", "garage-sale", "flea-market", "pop-up-market", "fashion-show", "book-fair",
    "auto-show", "moto-meetup", "karting-race", "test-drive", "pets-walk", "pet-exhibition",
    "pet-friendly-event", "music", "cinema", "party", "family", "kids",
)
ACTIVITY_TAG_ALIASES = {
    "спорт": "sport",
    "футбол": "football",
    "баскетбол": "basketball",
    "волейбол": "volleyball",
    "теніс": "tennis",
    "біг": "running",
    "велосипед": "cycling",
    "прогулянка": "walk",
    "пікнік": "picnic",
    "туризм": "hiking",
    "музика": "music",
    "кіно": "cinema",
    "настільні ігри": "board-games",
    "вечірка": "party",
    "кава": "coffee",
    "сім’я": "family",
    "сім'я": "family",
    "діти": "kids",
    "знайомства": "networking",
}
_ACTIVITY_TAG_LOOKUP = {tag.casefold(): tag for tag in ACTIVITY_TAGS} | ACTIVITY_TAG_ALIASES


def normalize_activity_tags(value, *, reject_unknown: bool = True) -> list[str]:
    if value is None:
        return []
    items = value.split(",") if isinstance(value, str) else value
    if not isinstance(items, (list, tuple, set)):
        raise ValueError("tags must be a list")

    normalized: list[str] = []
    seen: set[str] = set()
    for item in items:
        raw_tag = re.sub(r"\s+", " ", str(item or "")).strip().lstrip("#").strip()
        if not raw_tag:
            continue
        tag = _ACTIVITY_TAG_LOOKUP.get(raw_tag.casefold())
        if tag is None:
            if reject_unknown:
                raise ValueError(f"unknown event tag: {raw_tag}")
            continue
        key = tag.casefold()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(tag)
    if len(normalized) > 5:
        if reject_unknown:
            raise ValueError("an event can contain at most 5 tags")
        return normalized[:5]
    return normalized


class ActivityBase(SQLModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=1000)

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value):
        return _clean_required(str(value or ""), "title", 3, 120)

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, value):
        return str(value or "").strip()


class Activity(ActivityBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True, max_length=6)
    visibility: str = Field(default="public", max_length=20)
    image_url: str | None = Field(default=None, max_length=1000)
    capacity: int | None = Field(default=None, ge=1, le=50)
    pin_type: str = Field(default="default", max_length=30)
    tags_json: str = Field(default="[]", max_length=1000)
    start_time: datetime | None = None
    end_time: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)


class ActivityCreate(ActivityBase):
    # Retained only for backwards-compatible clients. The backend verifies it
    # against the authenticated account and never trusts it as identity.
    user_id: int | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    visibility: str = Field(default="public", min_length=6, max_length=20)
    image_url: str | None = Field(default=None, max_length=3_000_000)
    capacity: int | None = Field(default=None, ge=1, le=50)
    pin_type: str = Field(default="default", max_length=30)
    tags: list[str] = Field(default_factory=list)
    start_time: datetime
    end_time: datetime | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, value):
        return normalize_activity_tags(value)

    @field_validator("start_time", mode="after")
    @classmethod
    def validate_start_time(cls, value):
        return _require_aware_datetime(value, "start_time")

    @field_validator("end_time", mode="after")
    @classmethod
    def validate_end_time(cls, value):
        return _require_aware_datetime(value, "end_time")

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class ActivityUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    visibility: str | None = Field(default=None, min_length=6, max_length=20)
    image_url: str | None = Field(default=None, max_length=3_000_000)
    capacity: int | None = Field(default=None, ge=1, le=50)
    pin_type: str | None = Field(default=None, max_length=30)
    tags: list[str] | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, value):
        if value is None:
            return None
        return normalize_activity_tags(value)

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, value):
        if value is None:
            return None
        return _clean_required(str(value), "title", 3, 120)

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, value):
        if value is None:
            return None
        return str(value).strip()

    @field_validator("start_time", "end_time", mode="after")
    @classmethod
    def validate_datetime(cls, value, info):
        return _require_aware_datetime(value, info.field_name)


class ActivityJoin(SQLModel):
    user_id: int | None = None


class ActivityRead(ActivityBase):
    id: int
    code: str
    visibility: str
    image_url: str | None
    capacity: int | None
    pin_type: str
    tags: list[str] = Field(default_factory=list)
    participant_count: int = 0
    participant_user_ids: list[int] = Field(default_factory=list)
    start_time: datetime | None
    end_time: datetime | None
    created_at: datetime
    host_user_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None


class EventOwner(SQLModel, table=True):
    activity_id: int = Field(foreign_key="activity.id", primary_key=True, ondelete="CASCADE")
    user_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")


class EventLocation(SQLModel, table=True):
    activity_id: int = Field(foreign_key="activity.id", primary_key=True, ondelete="CASCADE")
    latitude: float
    longitude: float


class EventMember(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("activity_id", "user_id", name="uq_event_member"),)

    id: int | None = Field(default=None, primary_key=True)
    activity_id: int = Field(foreign_key="activity.id", index=True, ondelete="CASCADE")
    user_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    joined_at: datetime = Field(default_factory=utc_now)


class EventParticipantRead(SQLModel):
    user_id: int
    name: str
    photo_url: str | None
    is_host: bool
    joined_at: datetime
    friend_code: str | None = None
    friendship_id: int | None = None
    friendship_status: str | None = None
    friendship_direction: str | None = None


# Legacy tables retained so existing local databases remain readable.
class Participant(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    activity_id: int = Field(foreign_key="activity.id", index=True, ondelete="CASCADE")
    name: str = Field(min_length=2, max_length=60)
    is_host: bool = False
    joined_at: datetime = Field(default_factory=utc_now)


class ParticipantJoin(SQLModel):
    name: str = Field(min_length=2, max_length=60)


class ParticipantRead(SQLModel):
    id: int
    activity_id: int
    name: str
    is_host: bool
    joined_at: datetime


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(min_length=2, max_length=60)
    email: str | None = Field(default=None, index=True, unique=True, max_length=320)
    password_hash: str | None = Field(default=None, max_length=300)
    google_sub: str | None = Field(default=None, index=True, unique=True, max_length=255)
    photo_url: str | None = Field(default=None, max_length=1000)
    friend_code: str = Field(index=True, unique=True, max_length=8)
    location_sharing_enabled: bool = True
    location_visibility: str = Field(default="friends", max_length=20)
    created_at: datetime = Field(default_factory=utc_now)


class UserCreate(SQLModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    photo_url: str | None = Field(default=None, max_length=3_000_000)

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value):
        return _clean_required(str(value or ""), "name", 2, 60)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value):
        normalized = _normalize_email(str(value or ""))
        if normalized is None:
            raise ValueError("Email is required")
        return normalized


class UserUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=2, max_length=60)
    photo_url: str | None = Field(default=None, max_length=3_000_000)

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value):
        if value is None:
            return None
        return _clean_required(str(value), "name", 2, 60)

    @field_validator("photo_url", mode="before")
    @classmethod
    def validate_photo_url(cls, value):
        return _clean_optional_url(value)


class UserRead(SQLModel):
    id: int
    name: str
    photo_url: str | None
    friend_code: str
    location_sharing_enabled: bool
    location_visibility: str
    created_at: datetime


class UserLogin(SQLModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value):
        normalized = _normalize_email(str(value or ""))
        if normalized is None:
            raise ValueError("Email is required")
        return normalized


class GoogleLogin(SQLModel):
    credential: str = Field(min_length=20, max_length=10_000)


class AuthRead(SQLModel):
    token: str
    user: UserRead


class AuthSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    token_hash: str = Field(index=True, unique=True, max_length=64)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime


class Friendship(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("pair_key", name="uq_friendship_pair"),
        CheckConstraint("requester_id != addressee_id", name="ck_friendship_not_self"),
    )

    id: int | None = Field(default=None, primary_key=True)
    requester_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    addressee_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    pair_key: str = Field(index=True, max_length=50)
    status: str = Field(default="pending", max_length=20)
    created_at: datetime = Field(default_factory=utc_now)


class FriendRequestCreate(SQLModel):
    friend_code: str = Field(min_length=8, max_length=8)


class FriendConnectionRead(SQLModel):
    friendship_id: int
    user_id: int
    name: str
    photo_url: str | None
    friend_code: str
    status: str
    direction: str
    created_at: datetime


class UserLocation(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True, ondelete="CASCADE")
    latitude: float
    longitude: float
    accuracy: float | None = None
    updated_at: datetime = Field(default_factory=utc_now)


class LocationUpdate(SQLModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0, le=10_000)


class LocationSharingUpdate(SQLModel):
    enabled: bool


class LocationVisibilityUpdate(SQLModel):
    visibility: str = Field(min_length=4, max_length=20)


class FriendLocationRead(SQLModel):
    user_id: int
    name: str
    photo_url: str | None
    latitude: float
    longitude: float
    accuracy: float | None
    updated_at: datetime
    age_seconds: int
    presence: str
    friend_code: str | None = None
    friendship_status: str | None = None


class UserNotification(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    kind: str = Field(max_length=40)
    message: str = Field(max_length=500)
    event_code: str | None = Field(default=None, max_length=6)
    event_title: str = Field(default="", max_length=120)
    created_at: datetime = Field(default_factory=utc_now, index=True)
    read_at: datetime | None = None


class UserNotificationRead(SQLModel):
    id: int
    kind: str
    message: str
    event_code: str | None
    event_title: str
    created_at: datetime
    read_at: datetime | None
