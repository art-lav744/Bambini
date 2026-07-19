import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import AppIcon from "../components/AppIcon.jsx";
import BottomNav from "../components/BottomNav.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { ensureCurrentUser } from "../userSession.js";
import { formatEventDateTime } from "../eventFormat.js";
import { EVENT_TAG_OPTIONS, eventTagLabel, filterEventsByTags, toggleEventTag } from "../eventTags.js";
import { eventsWithDistance, formatEventDistance } from "../mapMath.js";
import { localizeApiMessage, useI18n } from "../i18n.js";

const FILTERS = [
  { value: "mine", label: "Мої", labelEn: "Mine" },
  { value: "friends", label: "Друзі", labelEn: "Friends" },
  { value: "public", label: "Публічні", labelEn: "Public" },
];
const EVENTS_REFRESH_MS = 8000;

export default function EventsPage() {
  const { language, tr } = useI18n();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [myEvents, setMyEvents] = useState([]);
  const [friendEvents, setFriendEvents] = useState([]);
  const [publicEvents, setPublicEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("mine");
  const [tagFilter, setTagFilter] = useState([]);
  const [tagFilterExpanded, setTagFilterExpanded] = useState(false);
  const [viewerLocation, setViewerLocation] = useState(null);
  const [distanceStatus, setDistanceStatus] = useState("loading");
  const [joiningId, setJoiningId] = useState(null);
  const [leavingId, setLeavingId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState("");

  async function loadEvents(profile) {
    const results = await Promise.allSettled([
      api.getUserActivities(profile.id),
      api.getFriendActivities(profile.id),
      api.getPublicActivities(),
      api.getNotifications(profile.id),
    ]);
    const [mine, friends, publicData, notificationData] = results;
    if (mine.status === "fulfilled") setMyEvents(mine.value);
    if (friends.status === "fulfilled") setFriendEvents(friends.value);
    if (publicData.status === "fulfilled") setPublicEvents(publicData.value);
    if (notificationData.status === "fulfilled") setNotifications(notificationData.value);
    const failure = results.find((result) => result.status === "rejected");
    setError(failure ? tr(
      `Частину списків не оновлено: ${failure.reason?.message || "помилка сервера"}`,
      `Some lists were not updated: ${localizeApiMessage(failure.reason?.message, language) || "server error"}`,
    ) : "");
  }

  useEffect(() => {
    let active = true;
    let intervalId;
    ensureCurrentUser()
      .then(async (profile) => {
        if (!active) return;
        setUser(profile);
        await loadEvents(profile);
        if (!active) return;
        intervalId = window.setInterval(() => {
          if (document.visibilityState === "visible") loadEvents(profile);
        }, EVENTS_REFRESH_MS);
      })
      .catch((err) => active && setError(localizeApiMessage(err.message, language)));
    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [language]);

  useEffect(() => {
    let active = true;
    if (!window.isSecureContext || !navigator.geolocation) {
      setDistanceStatus("unavailable");
      return () => { active = false; };
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active) return;
        setViewerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setDistanceStatus("ready");
      },
      () => active && setDistanceStatus("unavailable"),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 12000 }
    );
    return () => { active = false; };
  }, []);

  const joinedIds = useMemo(() => new Set(myEvents.map((event) => event.id)), [myEvents]);
  const sourceEvents = filter === "mine"
    ? myEvents
    : filter === "friends"
      ? friendEvents
      : publicEvents;
  const visibleEvents = useMemo(
    () => eventsWithDistance(filterEventsByTags(sourceEvents, tagFilter), viewerLocation),
    [sourceEvents, tagFilter, viewerLocation]
  );

  async function joinEvent(event) {
    if (!user) return;
    setJoiningId(event.id);
    setError("");
    try {
      await api.joinActivity(event.code, user.id);
      await loadEvents(user);
      navigate(`/room/${event.code}`);
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setJoiningId(null);
    }
  }

  function leaveEvent(event) {
    if (!user || event.host_user_id === user.id) return;
    setConfirmation({
      title: tr("Вийти з події?", "Leave the event?"),
      message: tr(`Ви більше не будете учасником події «${event.title}».`, `You will no longer be a participant of “${event.title}”.`),
      confirmLabel: tr("Від’єднатися", "Leave"),
      action: () => performLeaveEvent(event),
    });
  }

  async function performLeaveEvent(event) {
    setLeavingId(event.id);
    setError("");
    try {
      await api.leaveActivity(event.code, user.id);
      await loadEvents(user);
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setLeavingId(null);
    }
  }

  async function dismissNotification(notificationId) {
    if (!user) return;
    setNotifications((current) => current.filter((item) => item.id !== notificationId));
    try {
      await api.markNotificationRead(user.id, notificationId);
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
      await loadEvents(user);
    }
  }

  function confirmPendingAction() {
    const action = confirmation?.action;
    setConfirmation(null);
    action?.();
  }

  return (
    <main className="main-tab-page">
      <div className="tab-page__content">
        <div className="eyebrow">{tr("Активності", "Activities")}</div>
        <h1>{tr("Події", "Events")}</h1>

        {notifications.length > 0 && (
          <section className="event-notifications" aria-label={tr("Повідомлення про події", "Event notifications")}>
            {notifications.map((notification) => (
              <article className="event-notification" key={notification.id}>
                <div>
                  <strong>{notification.kind === "event_deleted" ? tr("Подію видалено", "Event deleted") : tr("Подію оновлено", "Event updated")}</strong>
                  <span>{language === "en"
                    ? notification.kind === "event_deleted"
                      ? `The event “${notification.event_title || "Event"}” was deleted by its host.`
                      : `The event “${notification.event_title || "Event"}” was updated by its host.`
                    : notification.message}</span>
                </div>
                {notification.kind === "event_updated" && notification.event_code && (
                  <Link to={`/room/${notification.event_code}`}>{tr("Переглянути", "View")}</Link>
                )}
                <button type="button" aria-label={tr("Закрити повідомлення", "Close notification")} onClick={() => dismissNotification(notification.id)}><AppIcon name="close" /></button>
              </article>
            ))}
          </section>
        )}

        <div className="event-actions">
          <Link className="event-action-card" to="/create">
            <span className="event-action-card__symbol"><AppIcon name="plus" /></span>
            <div>
              <strong>{tr("Створити подію", "Create event")}</strong>
              <span>{tr("Одна точка на карті", "One location on the map")}</span>
            </div>
          </Link>
          <Link className="event-action-card" to="/join">
            <span className="event-action-card__symbol"><AppIcon name="hash" /></span>
            <div>
              <strong>{tr("Приєднатися за кодом", "Join with code")}</strong>
              <span>{tr("Для публічних і приватних подій", "For public and private events")}</span>
            </div>
          </Link>
        </div>

        <div className="event-filter" role="tablist" aria-label={tr("Фільтр подій", "Event filter")}>
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              className={`event-filter__button${filter === item.value ? " is-active" : ""}`}
              onClick={() => setFilter(item.value)}
            >
              {language === "en" ? item.labelEn : item.label}
            </button>
          ))}
        </div>

        <section className={`event-tag-filter${tagFilterExpanded ? " is-expanded" : ""}`} aria-label={tr("Фільтр подій за тегами", "Filter events by tags")}>
          <div className="event-tag-filter__heading">
            <button
              className="event-tag-filter__toggle"
              type="button"
              aria-expanded={tagFilterExpanded}
              aria-controls="event-tag-filter-options"
              onClick={() => setTagFilterExpanded((expanded) => !expanded)}
            >
              <strong>{tr("Теги", "Tags")}{tagFilter.length ? ` ${tagFilter.length}` : ""}</strong>
            </button>
            {tagFilter.length > 0 && <button type="button" onClick={() => setTagFilter([])}>{tr("Скинути", "Reset")}</button>}
          </div>
          {tagFilterExpanded && (
            <div className="event-tag-filter__options" id="event-tag-filter-options">
              {EVENT_TAG_OPTIONS.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  className={tagFilter.includes(tag.value) ? "is-active" : ""}
                  aria-pressed={tagFilter.includes(tag.value)}
                  onClick={() => setTagFilter((current) => toggleEventTag(current, tag.value, Number.POSITIVE_INFINITY))}
                >
                  {eventTagLabel(tag.value, language)}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="event-list-section">
          {distanceStatus === "loading" && <p className="event-distance-status">{tr("Визначаємо відстань до подій…", "Calculating distances to events…")}</p>}
          {distanceStatus === "unavailable" && <p className="event-distance-status">{tr("Дозвольте геолокацію, щоб побачити відстань і сортування найближчих подій.", "Allow location access to see distances and sort events by proximity.")}</p>}
          {visibleEvents.length ? (
            <div className="event-list">
              {visibleEvents.map(({ event, distanceMeters }) => {
                const joined = joinedIds.has(event.id);
                const isHost = event.host_user_id === user?.id;
                return (
                  <article className="event-list-card public-event-card" key={event.id}>
                    <div className="event-list-card__media">
                      {event.image_url ? (
                        <img src={event.image_url} alt="" />
                      ) : (
                        <span className="event-list-card__pin"><AppIcon name="pin" /></span>
                      )}
                    </div>
                    <Link className="event-list-card__content" to={`/room/${event.code}`}>
                      <div className="event-list-card__topline">
                        <strong>{event.title}</strong>
                        <time>{formatEventDateTime(event.start_time, null, language)}</time>
                      </div>
                      <span>{event.description || tr(`Код ${event.code}`, `Code ${event.code}`)}</span>
                      {Number.isFinite(distanceMeters) && (
                        <span className="event-list-card__distance">{tr("До події:", "Distance:")} {formatEventDistance(distanceMeters, language)}</span>
                      )}
                      {event.tags?.length > 0 && (
                        <div className="event-tag-list event-tag-list--compact">
                          {event.tags.map((tag) => <span className="event-tag" key={tag}>#{eventTagLabel(tag, language)}</span>)}
                        </div>
                      )}
                      <small>
                        {isHost
                          ? tr("Організатор", "Host")
                          : joined
                            ? tr("Учасник", "Participant")
                            : event.visibility === "friends"
                              ? tr("Лише друзі", "Friends only")
                              : event.visibility === "private"
                                ? tr("Приватна", "Private")
                                : tr("Публічна", "Public")}
                      </small>
                    </Link>
                    {joined ? (
                      !isHost && (
                        <button
                          className="small-action small-action--danger"
                          type="button"
                          onClick={() => leaveEvent(event)}
                          disabled={leavingId === event.id}
                        >
                          {leavingId === event.id ? "..." : tr("Вийти", "Leave")}
                        </button>
                      )
                    ) : (
                      <button
                        className="small-action"
                        type="button"
                        onClick={() => joinEvent(event)}
                        disabled={joiningId === event.id}
                      >
                        {joiningId === event.id ? "..." : tr("Приєднатися", "Join")}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact">
              {tagFilter.length > 0
                ? tr("За обраними тегами подій немає.", "No events match the selected tags.")
                : filter === "mine"
                ? tr("У вас ще немає подій.", "You do not have any events yet.")
                : filter === "friends"
                  ? tr("У друзів немає доступних подій.", "Your friends have no available events.")
                  : tr("Публічних подій поки немає.", "There are no public events yet.")}
            </div>
          )}
        </section>

        {error && <p className="error">{error}</p>}
      </div>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmLabel={confirmation?.confirmLabel}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmPendingAction}
      />
      <BottomNav />
    </main>
  );
}
