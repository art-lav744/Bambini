from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import event, text
from sqlmodel import SQLModel, Session, create_engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BACKEND_DIR / "app.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)


if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_integrity(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


def _columns(connection, table_name: str) -> set[str]:
    return {row[1] for row in connection.execute(text(f'PRAGMA table_info("{table_name}")')).fetchall()}


def _run_lightweight_sqlite_migrations() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return

    with engine.begin() as connection:
        user_columns = _columns(connection, "user")
        if user_columns and "profile_code" in user_columns:
            connection.execute(text("DROP INDEX IF EXISTS ix_user_profile_code"))
            connection.execute(text('ALTER TABLE "user" DROP COLUMN profile_code'))
            user_columns.remove("profile_code")
        if user_columns and "location_visibility" not in user_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN location_visibility TEXT NOT NULL DEFAULT "friends"'))
            if "location_sharing_enabled" in user_columns:
                connection.execute(text('UPDATE "user" SET location_visibility = CASE WHEN location_sharing_enabled = 0 THEN "none" ELSE "friends" END'))
        if user_columns and "email" not in user_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN email TEXT'))
        if user_columns and "password_hash" not in user_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN password_hash TEXT'))
        if user_columns and "google_sub" not in user_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN google_sub TEXT'))
        connection.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_user_email ON "user" (email) WHERE email IS NOT NULL'))
        connection.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_user_google_sub ON "user" (google_sub) WHERE google_sub IS NOT NULL'))

        activity_columns = _columns(connection, "activity")
        if activity_columns and "visibility" not in activity_columns:
            connection.execute(text('ALTER TABLE "activity" ADD COLUMN visibility TEXT NOT NULL DEFAULT "public"'))
            if "is_public" in activity_columns:
                connection.execute(text('UPDATE "activity" SET visibility = CASE WHEN is_public = 1 THEN "public" ELSE "private" END'))
        if activity_columns and "is_public" in activity_columns:
            connection.execute(text('ALTER TABLE "activity" DROP COLUMN is_public'))
        for column, sql_type in (("image_url", "TEXT"), ("start_time", "DATETIME"), ("end_time", "DATETIME"), ("capacity", "INTEGER")):
            if activity_columns and column not in activity_columns:
                connection.execute(text(f'ALTER TABLE "activity" ADD COLUMN {column} {sql_type}'))
        if activity_columns and "pin_type" not in activity_columns:
            connection.execute(text('ALTER TABLE "activity" ADD COLUMN pin_type TEXT NOT NULL DEFAULT "default"'))

        friendship_columns = _columns(connection, "friendship")
        if friendship_columns and "pair_key" not in friendship_columns:
            connection.execute(text('ALTER TABLE friendship ADD COLUMN pair_key TEXT'))
            connection.execute(text("UPDATE friendship SET pair_key = CASE WHEN requester_id < addressee_id THEN requester_id || ':' || addressee_id ELSE addressee_id || ':' || requester_id END"))
        if friendship_columns:
            # Remove legacy duplicate rows before enforcing the unique pair index.
            connection.execute(text("DELETE FROM friendship WHERE id NOT IN (SELECT MIN(id) FROM friendship GROUP BY pair_key)"))
            connection.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS uq_friendship_pair ON friendship(pair_key)'))

        eventmember_columns = _columns(connection, "eventmember")
        if eventmember_columns:
            connection.execute(text("DELETE FROM eventmember WHERE id NOT IN (SELECT MIN(id) FROM eventmember GROUP BY activity_id, user_id)"))
            connection.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS uq_event_member ON eventmember(activity_id, user_id)'))


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _run_lightweight_sqlite_migrations()


def get_session():
    with Session(engine) as session:
        yield session
