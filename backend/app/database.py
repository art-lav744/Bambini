from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


def _run_lightweight_sqlite_migrations() -> None:
    """Keep existing hackathon SQLite databases usable after small schema changes."""
    with engine.begin() as connection:
        user_columns = {
            row[1]
            for row in connection.execute(text('PRAGMA table_info("user")')).fetchall()
        }
        if user_columns and "profile_code" in user_columns:
            connection.execute(text('DROP INDEX IF EXISTS ix_user_profile_code'))
            connection.execute(text('ALTER TABLE "user" DROP COLUMN profile_code'))
            user_columns.remove("profile_code")

        if user_columns and "location_visibility" not in user_columns:
            connection.execute(
                text(
                    'ALTER TABLE "user" ADD COLUMN location_visibility '
                    'TEXT NOT NULL DEFAULT "friends"'
                )
            )
            # Preserve the meaning of the older boolean setting.
            if "location_sharing_enabled" in user_columns:
                connection.execute(
                    text(
                        'UPDATE "user" SET location_visibility = '
                        'CASE WHEN location_sharing_enabled = 0 THEN "none" '
                        'ELSE "friends" END'
                    )
                )

        if user_columns and "email" not in user_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN email TEXT'))
            connection.execute(
                text(
                    'CREATE UNIQUE INDEX IF NOT EXISTS ix_user_email '
                    'ON "user" (email)'
                )
            )

        if user_columns and "password_hash" not in user_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN password_hash TEXT'))

        activity_columns = {
            row[1]
            for row in connection.execute(text('PRAGMA table_info("activity")')).fetchall()
        }
        if activity_columns and "visibility" not in activity_columns:
            connection.execute(
                text(
                    'ALTER TABLE "activity" ADD COLUMN visibility '
                    'TEXT NOT NULL DEFAULT "public"'
                )
            )
            if "is_public" in activity_columns:
                connection.execute(
                    text(
                        'UPDATE "activity" SET visibility = '
                        'CASE WHEN is_public = 1 THEN "public" ELSE "private" END'
                    )
                )
            activity_columns.add("visibility")

        if activity_columns and "is_public" in activity_columns:
            connection.execute(text('ALTER TABLE "activity" DROP COLUMN is_public'))
            activity_columns.remove("is_public")

        if activity_columns and "image_url" not in activity_columns:
            connection.execute(text('ALTER TABLE "activity" ADD COLUMN image_url TEXT'))

        if activity_columns and "start_time" not in activity_columns:
            connection.execute(text('ALTER TABLE "activity" ADD COLUMN start_time DATETIME'))


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _run_lightweight_sqlite_migrations()


def get_session():
    with Session(engine) as session:
        yield session
