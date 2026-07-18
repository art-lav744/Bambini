import base64
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, select

from app.database import engine
from app.main import app
from app.models import Activity, EventLocation, EventMember, EventOwner, User, UserCustomization, UserLocation, UserNotification


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def register(client, name, email):
    response = client.post("/users", json={"name": name, "email": email, "password": "securepass1"})
    assert response.status_code == 201, response.text
    return response.json()


def create_event(client, auth, **overrides):
    now = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {
        "title": "Test event",
        "description": "Event description",
        "visibility": "public",
        "latitude": 48.9226,
        "longitude": 24.7111,
        "capacity": 8,
        "pin_type": "default",
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
    }
    payload.update(overrides)
    response = client.post("/activities", json=payload, headers=auth_header(auth["token"]))
    assert response.status_code == 201, response.text
    return response.json()


def test_security_privacy_integrity_and_validation(monkeypatch):
    with TestClient(app) as client:
        empty = client.post("/users", json={"name": "   ", "email": "blank@example.com", "password": "securepass1"})
        assert empty.status_code == 422

        alice = register(client, "Alice", "alice@example.com")
        bob = register(client, "Bob", "bob@example.com")
        carol = register(client, "Carol", "carol@example.com")

        # A bearer token cannot act through another user's path ID.
        response = client.patch(
            f"/users/{alice['user']['id']}",
            json={"name": "Hacked"},
            headers=auth_header(bob["token"]),
        )
        assert response.status_code == 403
        response = client.put(
            f"/users/{alice['user']['id']}/location",
            json={"latitude": 0, "longitude": 0, "accuracy": 5},
            headers=auth_header(bob["token"]),
        )
        assert response.status_code == 403

        private_event = create_event(client, alice, visibility="private")
        assert client.get(f"/activities/{private_event['code']}").status_code == 401
        assert client.get(f"/activities/{private_event['code']}", headers=auth_header(bob["token"])).status_code == 403
        assert client.get(f"/activities/{private_event['code']}/participants", headers=auth_header(bob["token"])).status_code == 403

        # The private code can be used to join, after which reads are authorized.
        joined = client.post(
            f"/activities/{private_event['code']}/join",
            json={"user_id": bob["user"]["id"]},
            headers=auth_header(bob["token"]),
        )
        assert joined.status_code == 201
        assert client.get(f"/activities/{private_event['code']}", headers=auth_header(bob["token"])).status_code == 200

        # Event-scoped visibility requires both users to be near the same event.
        client.put(
            f"/users/{bob['user']['id']}/location",
            json={"latitude": 48.923166, "longitude": 24.7111, "accuracy": 10},
            headers=auth_header(bob["token"]),
        )
        client.put(
            f"/users/{alice['user']['id']}/location",
            json={"latitude": 47.0, "longitude": 24.0, "accuracy": 10},
            headers=auth_header(alice["token"]),
        )
        remote = client.get(
            f"/users/{alice['user']['id']}/visible-locations",
            headers=auth_header(alice["token"]),
        ).json()
        assert bob["user"]["id"] not in {item["user_id"] for item in remote}

        client.put(
            f"/users/{alice['user']['id']}/location",
            json={"latitude": 48.9226, "longitude": 24.7111, "accuracy": 8},
            headers=auth_header(alice["token"]),
        )
        nearby = client.get(
            f"/users/{alice['user']['id']}/visible-locations",
            headers=auth_header(alice["token"]),
        ).json()
        assert bob["user"]["id"] in {item["user_id"] for item in nearby}
        bob_pin = next(item for item in nearby if item["user_id"] == bob["user"]["id"])
        assert bob_pin["latitude"] == 48.923166
        assert bob_pin["friend_code"] == bob["user"]["friend_code"]
        assert bob_pin["friendship_status"] is None

        friend_request = client.post(
            f"/users/{alice['user']['id']}/friends/request",
            json={"friend_code": bob_pin["friend_code"]},
            headers=auth_header(alice["token"]),
        )
        assert friend_request.status_code == 201, friend_request.text
        refreshed_pin = next(item for item in client.get(
            f"/users/{alice['user']['id']}/visible-locations",
            headers=auth_header(alice["token"]),
        ).json() if item["user_id"] == bob["user"]["id"])
        assert refreshed_pin["friendship_status"] == "pending"

        # Capacity and duplicate membership are enforced in the write statement/database.
        capacity_event = create_event(client, alice, title="Capacity event", capacity=2)
        first_join = client.post(
            f"/activities/{capacity_event['code']}/join",
            json={}, headers=auth_header(bob["token"]),
        )
        assert first_join.status_code == 201
        duplicate = client.post(
            f"/activities/{capacity_event['code']}/join",
            json={}, headers=auth_header(bob["token"]),
        )
        assert duplicate.status_code == 201
        full = client.post(
            f"/activities/{capacity_event['code']}/join",
            json={}, headers=auth_header(carol["token"]),
        )
        assert full.status_code == 409
        with Session(engine) as session:
            members = session.exec(select(EventMember).where(EventMember.activity_id == capacity_event["id"])).all()
            assert len(members) == 2
            assert session.exec(text("PRAGMA foreign_keys")).one()[0] == 1

        visible = client.get("/activities/visible/list", headers=auth_header(bob["token"]))
        assert visible.status_code == 200, visible.text
        visible_codes = {item["code"] for item in visible.json()}
        assert private_event["code"] in visible_codes
        assert capacity_event["code"] in visible_codes

        # Embedded media is moved out of JSON/SQLite into controlled storage.
        pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII="
        image_event = create_event(client, alice, title="Image event", image_url=pixel)
        assert image_event["image_url"].startswith("/media/events/")

        # Organizers can edit event details and every other participant receives
        # a durable notification for both edits and deletion.
        editable_event = create_event(
            client,
            alice,
            title="Editable event",
            tags=["спорт", "football", "SPORT", "music"],
        )
        assert editable_event["tags"] == ["sport", "football", "music"]
        assert client.post(
            f"/activities/{editable_event['code']}/join",
            json={}, headers=auth_header(bob["token"]),
        ).status_code == 201
        forbidden_edit = client.patch(
            f"/activities/{editable_event['code']}",
            json={"title": "Unauthorized edit"},
            headers=auth_header(bob["token"]),
        )
        assert forbidden_edit.status_code == 403
        new_start = datetime.now(timezone.utc) + timedelta(hours=3)
        edited = client.patch(
            f"/activities/{editable_event['code']}",
            json={
                "title": "Edited event",
                "description": "Updated details",
                "visibility": "friends",
                "capacity": 4,
                "pin_type": "football",
                "tags": ["table-tennis", "pet-friendly-event"],
                "start_time": new_start.isoformat(),
                "end_time": (new_start + timedelta(hours=2)).isoformat(),
                "latitude": 48.93,
                "longitude": 24.72,
            },
            headers=auth_header(alice["token"]),
        )
        assert edited.status_code == 200, edited.text
        assert edited.json()["title"] == "Edited event"
        assert edited.json()["tags"] == ["table-tennis", "pet-friendly-event"]
        assert edited.json()["latitude"] == 48.93

        too_many_tags = client.patch(
            f"/activities/{editable_event['code']}",
            json={"tags": ["sport", "football", "basketball", "volleyball", "tennis", "running"]},
            headers=auth_header(alice["token"]),
        )
        assert too_many_tags.status_code == 422
        unknown_tag = client.patch(
            f"/activities/{editable_event['code']}",
            json={"tags": ["not-a-preset"]},
            headers=auth_header(alice["token"]),
        )
        assert unknown_tag.status_code == 422
        participant_rows = client.get(
            f"/activities/{editable_event['code']}/participants",
            headers=auth_header(bob["token"]),
        ).json()
        alice_participant = next(item for item in participant_rows if item["user_id"] == alice["user"]["id"])
        assert alice_participant["friend_code"] == alice["user"]["friend_code"]
        assert alice_participant["friendship_status"] == "pending"
        edit_notifications = client.get(
            f"/users/{bob['user']['id']}/notifications",
            headers=auth_header(bob["token"]),
        )
        assert edit_notifications.status_code == 200
        edit_notice = next(item for item in edit_notifications.json() if item["kind"] == "event_updated")
        assert "Edited event" in edit_notice["message"]
        assert client.post(
            f"/users/{bob['user']['id']}/notifications/{edit_notice['id']}/read",
            headers=auth_header(bob["token"]),
        ).status_code == 204
        deleted_editable = client.delete(
            f"/activities/{editable_event['code']}",
            headers=auth_header(alice["token"]),
        )
        assert deleted_editable.status_code == 204, deleted_editable.text
        delete_notifications = client.get(
            f"/users/{bob['user']['id']}/notifications",
            headers=auth_header(bob["token"]),
        ).json()
        assert any(item["kind"] == "event_deleted" and "Edited event" in item["message"] for item in delete_notifications)
        with Session(engine) as session:
            assert session.exec(select(UserNotification).where(
                UserNotification.user_id == bob["user"]["id"]
            )).first() is not None

        # Only the owner can remove another member or delete the event.
        managed_event = create_event(client, alice, title="Managed event")
        joined_managed = client.post(
            f"/activities/{managed_event['code']}/join",
            json={}, headers=auth_header(bob["token"]),
        )
        assert joined_managed.status_code == 201, joined_managed.text
        forbidden_removal = client.delete(
            f"/activities/{managed_event['code']}/members/{bob['user']['id']}",
            headers=auth_header(carol["token"]),
        )
        assert forbidden_removal.status_code == 403
        owner_cannot_leave = client.delete(
            f"/activities/{managed_event['code']}/members/{alice['user']['id']}",
            headers=auth_header(alice["token"]),
        )
        assert owner_cannot_leave.status_code == 409
        removed = client.delete(
            f"/activities/{managed_event['code']}/members/{bob['user']['id']}",
            headers=auth_header(alice["token"]),
        )
        assert removed.status_code == 204, removed.text
        participants = client.get(
            f"/activities/{managed_event['code']}/participants",
            headers=auth_header(alice["token"]),
        ).json()
        assert bob["user"]["id"] not in {item["user_id"] for item in participants}
        forbidden_delete = client.delete(
            f"/activities/{managed_event['code']}",
            headers=auth_header(bob["token"]),
        )
        assert forbidden_delete.status_code == 403
        deleted = client.delete(
            f"/activities/{managed_event['code']}",
            headers=auth_header(alice["token"]),
        )
        assert deleted.status_code == 204, deleted.text
        with Session(engine) as session:
            assert session.get(Activity, managed_event["id"]) is None
            assert session.get(EventOwner, managed_event["id"]) is None
            assert session.get(EventLocation, managed_event["id"]) is None
            assert session.exec(select(EventMember).where(EventMember.activity_id == managed_event["id"])).first() is None

        # Verified Google identities are linked by sub and work repeatedly.
        import google.oauth2.id_token
        monkeypatch.setattr(
            google.oauth2.id_token,
            "verify_oauth2_token",
            lambda credential, request, audience: {
                "iss": "https://accounts.google.com",
                "sub": "google-sub-123",
                "email": "google@example.com",
                "email_verified": True,
                "name": "Google User",
            },
        )
        first = client.post("/auth/google", json={"credential": "x" * 30})
        second = client.post("/auth/google", json={"credential": "y" * 30})
        assert first.status_code == 200, first.text
        assert second.status_code == 200
        assert first.json()["user"]["id"] == second.json()["user"]["id"]



def test_legacy_password_upgrade_logout_and_media_clear():
    password = "oldsecurepass"
    salt = b"0123456789abcdef"
    old_derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    old_hash = base64.b64encode(salt + old_derived).decode("ascii")

    with TestClient(app) as client:
        with Session(engine) as session:
            legacy = User(
                name="Legacy",
                email="legacy@example.com",
                password_hash=old_hash,
                friend_code="LEGACY01",
                location_visibility="friends",
                location_sharing_enabled=True,
            )
            session.add(legacy)
            session.commit()
            session.refresh(legacy)
            legacy_id = legacy.id

        login = client.post("/login", json={"email": "legacy@example.com", "password": password})
        assert login.status_code == 200, login.text
        legacy_token = login.json()["token"]
        with Session(engine) as session:
            upgraded = session.get(User, legacy_id)
            assert upgraded.password_hash.startswith("pbkdf2_sha256$310000$")
            assert session.get(UserCustomization, legacy_id) is not None

        # Explicitly sending an empty photo clears the existing image.
        pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII="
        owner = client.post("/users", json={
            "name": "Owner", "email": "owner2@example.com", "password": "securepass1", "photo_url": pixel,
        })
        assert owner.status_code == 201, owner.text
        owner_auth = owner.json()
        assert owner_auth["user"]["photo_url"].startswith("/media/profiles/")
        cleared = client.patch(
            f"/users/{owner_auth['user']['id']}",
            json={"photo_url": ""},
            headers=auth_header(owner_auth["token"]),
        )
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["photo_url"] is None

        # Logout invalidates the exact bearer token server-side.
        logged_out = client.post("/logout", headers=auth_header(legacy_token))
        assert logged_out.status_code == 204
        assert client.get("/users/me", headers=auth_header(legacy_token)).status_code == 401


def test_stale_viewer_location_cannot_unlock_event_presence():
    with TestClient(app) as client:
        viewer = register(client, "Viewer", "viewer-stale@example.com")
        candidate = register(client, "Candidate", "candidate-stale@example.com")
        event = create_event(client, viewer, title="Fresh location required", visibility="private")
        joined = client.post(
            f"/activities/{event['code']}/join", json={}, headers=auth_header(candidate["token"]),
        )
        assert joined.status_code == 201

        for account in (viewer, candidate):
            response = client.put(
                f"/users/{account['user']['id']}/location",
                json={"latitude": 48.9226, "longitude": 24.7111, "accuracy": 5},
                headers=auth_header(account["token"]),
            )
            assert response.status_code == 200, response.text

        with Session(engine) as session:
            location = session.get(UserLocation, viewer["user"]["id"])
            location.updated_at = datetime.now(timezone.utc) - timedelta(hours=9)
            session.add(location)
            session.commit()

        visible = client.get(
            f"/users/{viewer['user']['id']}/visible-locations",
            headers=auth_header(viewer["token"]),
        )
        assert visible.status_code == 200
        assert candidate["user"]["id"] not in {item["user_id"] for item in visible.json()}


def test_customization_defaults_updates_and_stays_private():
    with TestClient(app) as client:
        alice = register(client, "Style Alice", "style-alice@example.com")
        bob = register(client, "Style Bob", "style-bob@example.com")
        alice_id = alice["user"]["id"]
        bob_id = bob["user"]["id"]

        with Session(engine) as session:
            assert session.get(UserCustomization, alice_id) is not None
            assert session.get(UserCustomization, bob_id) is not None

        default_response = client.get(
            f"/users/{alice_id}/customization",
            headers=auth_header(alice["token"]),
        )
        assert default_response.status_code == 200
        assert default_response.json() == {
            "user_id": alice_id,
            "orca_skin": "default",
            "header_style": "default",
            "bottom_style": "default",
            "theme": "dark",
        }

        payload = {"orca_skin": "default", "header_style": "space", "bottom_style": "y2k", "theme": "sunset"}
        updated = client.put(
            f"/users/{alice_id}/customization",
            json=payload,
            headers=auth_header(alice["token"]),
        )
        assert updated.status_code == 200, updated.text
        assert updated.json() == {"user_id": alice_id, **payload}

        persisted = client.get(
            f"/users/{alice_id}/customization",
            headers=auth_header(alice["token"]),
        )
        assert persisted.json() == {"user_id": alice_id, **payload}

        visibility = client.put(
            f"/users/{alice_id}/location-visibility",
            json={"visibility": "everyone"},
            headers=auth_header(alice["token"]),
        )
        assert visibility.status_code == 200, visibility.text
        location = client.put(
            f"/users/{alice_id}/location",
            json={"latitude": 48.9226, "longitude": 24.7111, "accuracy": 5},
            headers=auth_header(alice["token"]),
        )
        assert location.status_code == 200, location.text
        visible = client.get(
            f"/users/{bob_id}/visible-locations",
            headers=auth_header(bob["token"]),
        )
        assert visible.status_code == 200, visible.text
        alice_on_map = next(item for item in visible.json() if item["user_id"] == alice_id)
        assert {key: alice_on_map[key] for key in payload} == payload

        dolphin = client.put(
            f"/users/{alice_id}/customization",
            json={**payload, "orca_skin": "dolphin"},
            headers=auth_header(alice["token"]),
        )
        assert dolphin.status_code == 200, dolphin.text
        assert dolphin.json() == {
            "user_id": alice_id,
            "orca_skin": "dolphin",
            "header_style": "none",
            "bottom_style": "none",
            "theme": "sunset",
        }

        forbidden = client.get(
            f"/users/{alice_id}/customization",
            headers=auth_header(bob["token"]),
        )
        assert forbidden.status_code == 403

        invalid = client.put(
            f"/users/{alice_id}/customization",
            json={**payload, "header_style": "unknown"},
            headers=auth_header(alice["token"]),
        )
        assert invalid.status_code == 422
