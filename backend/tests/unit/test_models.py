from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.models import ActivityCreate, EmailVerificationCodeInput, UserCustomizationUpdate, normalize_activity_tags


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


def test_customization_normalizes_known_values_and_rejects_unknown_ones():
    customization = UserCustomizationUpdate.model_validate({
        "orca_skin": " DOLPHIN ",
        "header_style": "Space",
        "bottom_style": "cyberpunk",
        "background_style": "garden",
        "theme": "Green",
    })

    assert customization.orca_skin == "dolphin"
    assert customization.header_style == "default"
    assert customization.bottom_style == "default"
    assert customization.background_style == "garden"
    assert customization.theme == "green"

    empty_equipment = UserCustomizationUpdate.model_validate({
        "orca_skin": "default",
        "header_style": "none",
        "bottom_style": "none",
    })
    assert empty_equipment.header_style == "default"
    assert empty_equipment.bottom_style == "default"

    assert UserCustomizationUpdate.model_validate({"theme": "light"}).theme == "dark"
    assert UserCustomizationUpdate.model_validate({"theme": "forest"}).theme == "dark"
    assert UserCustomizationUpdate.model_validate({"background_style": "arcade"}).background_style == "arcade"

    with pytest.raises(ValidationError):
        UserCustomizationUpdate.model_validate({"bottom_style": "missing"})
    with pytest.raises(ValidationError):
        UserCustomizationUpdate.model_validate({"background_style": "missing"})
    with pytest.raises(ValidationError):
        UserCustomizationUpdate.model_validate({"theme": "missing"})


def test_email_verification_code_requires_exactly_six_digits():
    assert EmailVerificationCodeInput.model_validate({"code": " 123 456 "}).code == "123456"
    with pytest.raises(ValidationError):
        EmailVerificationCodeInput.model_validate({"code": "12345"})
    with pytest.raises(ValidationError):
        EmailVerificationCodeInput.model_validate({"code": "12a456"})
