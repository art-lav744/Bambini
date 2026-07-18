from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from sqlalchemy import or_
from sqlmodel import Session, select

from .models import (
    AchievementRead,
    AchievementSummaryRead,
    EventMember,
    EventOwner,
    Friendship,
    UserAchievement,
)


@dataclass(frozen=True)
class AchievementDefinition:
    id: str
    category: str
    category_label: str
    title: str
    description: str
    reward_name: str
    metric: str
    target: int
    reward_field: str
    reward_value: str


ACHIEVEMENTS = (
    AchievementDefinition("first-alliance", "friends", "Друзі", "Перший Союз", "Додати 1 друга", "Вишиванка", "friends", 1, "bottom_style", "ukrainian"),
    AchievementDefinition("blood-brother", "friends", "Друзі", "Кровний Побратим", "Додати 2 друзів", "Шапка до вишиванки", "friends", 2, "header_style", "ukrainian"),
    AchievementDefinition("alliance-lord", "friends", "Друзі", "Володар Альянсів", "Додати 3 друзів", "Соняшники", "friends", 3, "background_style", "sunflowers"),
    AchievementDefinition("ally-collector", "friends", "Друзі", "Збирач Союзників", "Додати 10 друзів", "Сакури", "friends", 10, "background_style", "sakura"),
    AchievementDefinition("community-master", "friends", "Друзі", "Повелитель Спільноти", "Додати 20 друзів", "Спортивна кофта", "friends", 20, "bottom_style", "y2k"),

    AchievementDefinition("awakening", "joined-events", "Участь у подіях", "Пробудження", "Приєднатися до 1 події", "Рожеві окуляри", "joined_events", 1, "header_style", "hawaii"),
    AchievementDefinition("call-of-adventure", "joined-events", "Участь у подіях", "Поклик Пригод", "Приєднатися до 2 подій", "Сорочка з ананасами", "joined_events", 2, "bottom_style", "hawaii"),
    AchievementDefinition("fate-conqueror", "joined-events", "Участь у подіях", "Підкорювач Доль", "Приєднатися до 3 подій", "Тропічний пляж", "joined_events", 3, "background_style", "tropical-beach"),
    AchievementDefinition("explorer", "joined-events", "Участь у подіях", "Дослідник", "Приєднатися до 5 подій", "Пов’язка", "joined_events", 5, "header_style", "otaku"),
    AchievementDefinition("pilgrim", "joined-events", "Участь у подіях", "Пілігрим", "Приєднатися до 10 подій", "Місто", "joined_events", 10, "background_style", "city"),
    AchievementDefinition("continent-conqueror", "joined-events", "Участь у подіях", "Підкорювач Континентів", "Приєднатися до 20 подій", "Куртка кіберпанк", "joined_events", 20, "bottom_style", "cyberpunk"),
    AchievementDefinition("living-legend", "joined-events", "Участь у подіях", "Жива Легенда", "Приєднатися до 50 подій", "Магазин", "joined_events", 50, "background_style", "shop"),
    AchievementDefinition("endless-traveler", "joined-events", "Участь у подіях", "Мандрівник Без Кінця", "Приєднатися до 100 подій", "Куртка глітч", "joined_events", 100, "bottom_style", "glitch"),

    AchievementDefinition("spark-kindler", "created-events", "Створення подій", "Той, Хто Запалив Іскру", "Створити 1 подію", "Кепка", "created_events", 1, "header_style", "skater"),
    AchievementDefinition("world-creator", "created-events", "Створення подій", "Творець Світів", "Створити 2 події", "Сорочка з футболкою", "created_events", 2, "bottom_style", "skater"),
    AchievementDefinition("supreme-architect", "created-events", "Створення подій", "Верховний Архітектор", "Створити 3 події", "Скейт-парк", "created_events", 3, "background_style", "skatepark"),

    AchievementDefinition("heard-voice", "event-popularity", "Популярність подій", "Голос, Який Почули", "До вашої події приєдналося 3 людини", "Куртка космонавта", "event_popularity", 3, "bottom_style", "space"),
    AchievementDefinition("followed-one", "event-popularity", "Популярність подій", "Той, За Ким Ідуть", "До вашої події приєдналося 5 людей", "Шолом", "event_popularity", 5, "header_style", "space"),
    AchievementDefinition("legend-leader", "event-popularity", "Популярність подій", "Лідер Легенди", "До вашої події приєдналося 10 людей", "Космос", "event_popularity", 10, "background_style", "space"),
    AchievementDefinition("era-standard-bearer", "event-popularity", "Популярність подій", "Прапороносець Епохи", "До вашої події приєдналося 20 людей", "Халат", "event_popularity", 20, "bottom_style", "gimnazia"),

    AchievementDefinition("glory-hunter", "achievements", "Досягнення", "Мисливець за Славою", "Отримати 3 досягнення", "Хустка", "achievements", 3, "bottom_style", "mexica"),
    AchievementDefinition("achievement-keeper", "achievements", "Досягнення", "Хранитель Досягнень", "Отримати 5 досягнень", "Светр", "achievements", 5, "bottom_style", "cottagecore"),
    AchievementDefinition("chosen-of-fate", "achievements", "Досягнення", "Обранець Долі", "Отримати 10 досягнень", "Фонтан", "achievements", 10, "background_style", "fountain"),
    AchievementDefinition("immortal-hero", "achievements", "Досягнення", "Безсмертний Герой", "Отримати 15 досягнень", "Сад", "achievements", 15, "background_style", "garden"),
)

ACHIEVEMENT_BY_ID = {achievement.id: achievement for achievement in ACHIEVEMENTS}
ACHIEVEMENT_BY_REWARD = {
    (achievement.reward_field, achievement.reward_value): achievement
    for achievement in ACHIEVEMENTS
}


def achievement_stats(session: Session, user_id: int) -> dict[str, int]:
    friendships = session.exec(select(Friendship).where(
        (Friendship.status == "accepted")
        & or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id)
    )).all()
    owned_events = session.exec(select(EventOwner).where(EventOwner.user_id == user_id)).all()
    owned_event_ids = {owner.activity_id for owner in owned_events}
    memberships = session.exec(select(EventMember).where(EventMember.user_id == user_id)).all()
    joined_event_ids = {membership.activity_id for membership in memberships} - owned_event_ids

    guests_per_event: Counter[int] = Counter()
    if owned_event_ids:
        for membership in session.exec(select(EventMember).where(EventMember.activity_id.in_(owned_event_ids))).all():
            if membership.user_id != user_id:
                guests_per_event[membership.activity_id] += 1

    return {
        "friends": len(friendships),
        "joined_events": len(joined_event_ids),
        "created_events": len(owned_event_ids),
        "event_popularity": max(guests_per_event.values(), default=0),
    }


def unlocked_achievement_ids(stats: dict[str, int], already_unlocked: set[str] | None = None) -> set[str]:
    unlocked = {achievement_id for achievement_id in (already_unlocked or set()) if achievement_id in ACHIEVEMENT_BY_ID}
    unlocked.update(
        achievement.id
        for achievement in ACHIEVEMENTS
        if achievement.metric != "achievements" and stats.get(achievement.metric, 0) >= achievement.target
    )

    changed = True
    while changed:
        changed = False
        for achievement in ACHIEVEMENTS:
            if achievement.metric != "achievements" or achievement.id in unlocked:
                continue
            if len(unlocked) >= achievement.target:
                unlocked.add(achievement.id)
                changed = True
    return unlocked


def sync_user_achievements(session: Session, user_id: int) -> AchievementSummaryRead:
    stored = {
        row.achievement_id: row
        for row in session.exec(select(UserAchievement).where(UserAchievement.user_id == user_id)).all()
        if row.achievement_id in ACHIEVEMENT_BY_ID
    }
    stats = achievement_stats(session, user_id)
    unlocked_ids = unlocked_achievement_ids(stats, set(stored))

    for achievement in ACHIEVEMENTS:
        if achievement.id not in unlocked_ids or achievement.id in stored:
            continue
        row = UserAchievement(user_id=user_id, achievement_id=achievement.id)
        session.add(row)
        stored[achievement.id] = row
    session.flush()

    achievement_count = len(unlocked_ids)
    return AchievementSummaryRead(
        unlocked_count=achievement_count,
        total_count=len(ACHIEVEMENTS),
        achievements=[
            AchievementRead(
                id=achievement.id,
                category=achievement.category,
                category_label=achievement.category_label,
                title=achievement.title,
                description=achievement.description,
                reward_name=achievement.reward_name,
                reward_field=achievement.reward_field,
                reward_value=achievement.reward_value,
                progress=min(
                    achievement_count if achievement.metric == "achievements" else stats.get(achievement.metric, 0),
                    achievement.target,
                ),
                target=achievement.target,
                unlocked=achievement.id in unlocked_ids,
                unlocked_at=stored[achievement.id].unlocked_at if achievement.id in stored else None,
            )
            for achievement in ACHIEVEMENTS
        ],
    )


def required_achievement(reward_field: str, reward_value: str) -> AchievementDefinition | None:
    return ACHIEVEMENT_BY_REWARD.get((reward_field, reward_value))


def unlocked_reward_keys(summary: AchievementSummaryRead) -> set[tuple[str, str]]:
    return {
        (achievement.reward_field, achievement.reward_value)
        for achievement in summary.achievements
        if achievement.unlocked
    }
