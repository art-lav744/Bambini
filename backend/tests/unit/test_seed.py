from datetime import datetime, timezone

from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

from app.main import verify_password
from app.models import (
    Activity,
    EmailVerificationChallenge,
    EventMember,
    EventOwner,
    Friendship,
    User,
    UserCustomization,
    UserLocation,
    UserNotification,
)
from app.seed import DEMO_PASSWORD, EVENT_SPECS, USER_SPECS, seed_database


def test_seed_data_is_complete_login_ready_and_idempotent():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    now = datetime(2026, 7, 19, 12, tzinfo=timezone.utc)

    with Session(engine) as session:
        first = seed_database(session, now)
        second = seed_database(session, now)

        users = session.exec(select(User).where(
            User.email.in_([spec["email"] for spec in USER_SPECS])
        )).all()
        events = session.exec(select(Activity).where(
            Activity.code.in_([spec["code"] for spec in EVENT_SPECS])
        )).all()

        assert first.users == second.users == len(USER_SPECS)
        assert first.events == second.events == len(EVENT_SPECS)
        assert first.memberships == second.memberships == 10
        assert len(users) == len(USER_SPECS)
        assert len(events) == len(EVENT_SPECS)
        assert len(session.exec(select(Friendship)).all()) == 4
        assert len(session.exec(select(EventOwner)).all()) == len(EVENT_SPECS)
        assert len(session.exec(select(EventMember)).all()) == 10
        assert len(session.exec(select(UserNotification)).all()) == 2

        primary = next(user for user in users if user.email == "demo@bambini.local")
        assert verify_password(DEMO_PASSWORD, primary.password_hash)
        assert session.get(EmailVerificationChallenge, primary.id).verified_at is not None
        assert session.get(UserCustomization, primary.id).theme == "sunset"
        assert session.get(UserLocation, primary.id).updated_at is not None

        public_event = next(event for event in events if event.code == "DEMO01")
        assert public_event.visibility == "public"
        assert public_event.start_time > now.replace(tzinfo=None)
