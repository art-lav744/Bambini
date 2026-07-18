from app.achievements import unlocked_achievement_ids


def test_achievement_thresholds_unlock_rewards_and_meta_achievements_cascade():
    unlocked = unlocked_achievement_ids({
        "friends": 3,
        "joined_events": 3,
        "created_events": 3,
        "event_popularity": 3,
    })

    assert {"first-alliance", "blood-brother", "alliance-lord"}.issubset(unlocked)
    assert {"awakening", "call-of-adventure", "fate-conqueror"}.issubset(unlocked)
    assert {"spark-kindler", "world-creator", "supreme-architect"}.issubset(unlocked)
    assert "heard-voice" in unlocked
    assert {"glory-hunter", "achievement-keeper", "chosen-of-fate"}.issubset(unlocked)
    assert "immortal-hero" not in unlocked
