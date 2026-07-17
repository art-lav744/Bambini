from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.main import event_geofence_match, hash_password, haversine_meters, normalize_event_visibility, verify_password
from app.models import EventLocation, UserLocation


def test_password_hashing_accepts_the_password_and_rejects_other_values():
    password_hash = hash_password("securepass1")
    assert verify_password("securepass1", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_haversine_and_event_geofence_cover_nearby_not_remote_locations():
    event = EventLocation(activity_id=1, latitude=48.9226, longitude=24.7111)
    nearby = UserLocation(user_id=1, latitude=48.9230, longitude=24.7111, accuracy=5, updated_at=datetime.now(timezone.utc))
    remote = UserLocation(user_id=2, latitude=48.93, longitude=24.7111, accuracy=1000, updated_at=datetime.now(timezone.utc))

    assert 40 < haversine_meters(24.7111, 48.9226, 24.7111, 48.9230) < 50
    assert event_geofence_match(nearby, event)
    assert not event_geofence_match(remote, event)


def test_event_visibility_has_safe_normalization():
    assert normalize_event_visibility("friends") == "friends"
    assert normalize_event_visibility("private") == "private"
    with pytest.raises(HTTPException) as error:
        normalize_event_visibility("unexpected")
    assert error.value.status_code == 422
