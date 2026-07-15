from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ActivityBase(SQLModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=1000)


class Activity(ActivityBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True, max_length=6)
    is_public: bool = True
    created_at: datetime = Field(default_factory=utc_now)


class ActivityCreate(ActivityBase):
    user_id: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    is_public: bool = True


class ActivityJoin(SQLModel):
    user_id: int


class ActivityRead(ActivityBase):
    id: int
    code: str
    is_public: bool
    created_at: datetime
    host_user_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None


class EventOwner(SQLModel, table=True):
    activity_id: int = Field(foreign_key="activity.id", primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)


class EventLocation(SQLModel, table=True):
    activity_id: int = Field(foreign_key="activity.id", primary_key=True)
    latitude: float
    longitude: float


class EventMember(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    activity_id: int = Field(foreign_key="activity.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    joined_at: datetime = Field(default_factory=utc_now)


class EventParticipantRead(SQLModel):
    user_id: int
    name: str
    photo_url: str | None
    is_host: bool
    joined_at: datetime


# Legacy tables retained so existing local databases remain readable.
class Participant(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    activity_id: int = Field(foreign_key="activity.id", index=True)
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


# Legacy checkpoint model retained for compatibility; new events use one EventLocation only.
class Checkpoint(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    activity_id: int = Field(foreign_key="activity.id", index=True)
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    latitude: float
    longitude: float
    order_index: int = 0


class CheckpointCreate(SQLModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    latitude: float
    longitude: float
    order_index: int = 0


class CheckpointRead(CheckpointCreate):
    id: int
    activity_id: int


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(min_length=2, max_length=60)
    email: str | None = Field(default=None, index=True, unique=True, max_length=320)
    password_hash: str | None = Field(default=None, max_length=200)
    photo_url: str | None = Field(default=None, max_length=1000)
    friend_code: str = Field(index=True, unique=True, max_length=8)
    location_sharing_enabled: bool = True
    location_visibility: str = Field(default="friends", max_length=20)
    created_at: datetime = Field(default_factory=utc_now)


class UserCreate(SQLModel):
    name: str = Field(min_length=2, max_length=60)
    email: str | None = Field(default=None, max_length=320)
    password: str | None = Field(default=None, min_length=6, max_length=128)
    photo_url: str | None = Field(default=None, max_length=1000)


class UserUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=2, max_length=60)
    photo_url: str | None = Field(default=None, max_length=1000)


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
    password: str = Field(min_length=6, max_length=128)


class Friendship(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    requester_id: int = Field(foreign_key="user.id", index=True)
    addressee_id: int = Field(foreign_key="user.id", index=True)
    status: str = Field(default="pending", max_length=20)
    created_at: datetime = Field(default_factory=utc_now)


class FriendRequestCreate(SQLModel):
    friend_code: str = Field(min_length=4, max_length=8)


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
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    latitude: float
    longitude: float
    accuracy: float | None = None
    updated_at: datetime = Field(default_factory=utc_now)


class LocationUpdate(SQLModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)


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
