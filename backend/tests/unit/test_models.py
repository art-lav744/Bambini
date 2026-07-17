from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.models import ActivityCreate, normalize_activity_tags


def activity_payload(**overrides):
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {
        "title": "  Walking route  ",
        "description": "  Bring water  ",
        "visibility": "public",
        "latitude": 48.9226,
        "longitude": 24.7111,
        "tags": ["sport", "sport", "music"],
        "start_time": start,
        "end_time": start + timedelta(hours=2),
    }
    payload.update(overrides)
    return payload


def test_activity_input_normalizes_text_and_tags():
    activity = ActivityCreate.model_validate(activity_payload())

    assert activity.title == "Walking route"
    assert activity.description == "Bring water"
    assert activity.tags == ["sport", "music"]


def test_activity_validation_rejects_invalid_time_ranges():
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    with pytest.raises(ValidationError):
        ActivityCreate.model_validate(activity_payload(start_time=start, end_time=start))


def test_tag_normalization_rejects_unknown_and_excessive_values():
    with pytest.raises(ValueError):
        normalize_activity_tags(["unknown-preset"])
    with pytest.raises(ValueError):
        normalize_activity_tags(["sport", "football", "basketball", "volleyball", "tennis", "running"])
