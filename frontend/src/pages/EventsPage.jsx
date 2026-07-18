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

const FILTERS = [
  { value: "mine", label: "Мої" },
  { value: "friends", label: "Друзі" },
  { value: "public", label: "Публічні" },
];
const EVENTS_REFRESH_MS = 8000;

export default function EventsPage() {
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
    setError(failure ? `Частину списків не оновлено: ${failure.reason?.message || "помилка сервера"}` : "");
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
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

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
      setError(err.message);
    } finally {
      setJoiningId(null);
    }
  }

  function leaveEvent(event) {
    if (!user || event.host_user_id === user.id) return;
    setConfirmation({
      title: "Вийти з події?",
      message: `Ви більше не будете учасником події «${event.title}».`,
      confirmLabel: "Від’єднатися",
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
      setError(err.message);
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
      setError(err.message);
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
        <div className="eyebrow">Активності</div>
        <h1>Події</h1>

        {notifications.length > 0 && (
          <section className="event-notifications" aria-label="Повідомлення про події">
            {notifications.map((notification) => (
              <article className="event-notification" key={notification.id}>
                <div>
                  <strong>{notification.kind === "event_deleted" ? "Подію видалено" : "Подію оновлено"}</strong>
                  <span>{notification.message}</span>
                </div>
                {notification.kind === "event_updated" && notification.event_code && (
                  <Link to={`/room/${notification.event_code}`}>Переглянути</Link>
                )}
                <button type="button" aria-label="Закрити повідомлення" onClick={() => dismissNotification(notification.id)}><AppIcon name="close" /></button>
              </article>
            ))}
          </section>
        )}

        <div className="event-actions">
          <Link className="event-action-card" to="/create">
            <span className="event-action-card__symbol"><AppIcon name="plus" /></span>
            <div>
              <strong>Створити подію</strong>
              <span>Одна точка на карті</span>
            </div>
          </Link>
          <Link className="event-action-card" to="/join">
            <span className="event-action-card__symbol"><AppIcon name="hash" /></span>
            <div>
              <strong>Приєднатися за кодом</strong>
              <span>Для публічних і приватних подій</span>
            </div>
          </Link>
        </div>

        <div className="event-filter" role="tablist" aria-label="Фільтр подій">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              className={`event-filter__button${filter === item.value ? " is-active" : ""}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className={`event-tag-filter${tagFilterExpanded ? " is-expanded" : ""}`} aria-label="Фільтр подій за тегами">
          <div className="event-tag-filter__heading">
            <button
              className="event-tag-filter__toggle"
              type="button"
              aria-expanded={tagFilterExpanded}
              aria-controls="event-tag-filter-options"
              onClick={() => setTagFilterExpanded((expanded) => !expanded)}
            >
              <strong>Теги{tagFilter.length ? ` ${tagFilter.length}` : ""}</strong>
            </button>
            {tagFilter.length > 0 && <button type="button" onClick={() => setTagFilter([])}>Скинути</button>}
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
                  {tag.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="event-list-section">
          {distanceStatus === "loading" && <p className="event-distance-status">Визначаємо відстань до подій…</p>}
          {distanceStatus === "unavailable" && <p className="event-distance-status">Дозвольте геолокацію, щоб побачити відстань і сортування найближчих подій.</p>}
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
                        <time>{formatEventDateTime(event.start_time)}</time>
                      </div>
                      <span>{event.description || `Код ${event.code}`}</span>
                      {Number.isFinite(distanceMeters) && (
                        <span className="event-list-card__distance">До події: {formatEventDistance(distanceMeters)}</span>
                      )}
                      {event.tags?.length > 0 && (
                        <div className="event-tag-list event-tag-list--compact">
                          {event.tags.map((tag) => <span className="event-tag" key={tag}>#{eventTagLabel(tag)}</span>)}
                        </div>
                      )}
                      <small>
                        {isHost
                          ? "Організатор"
                          : joined
                            ? "Учасник"
                            : event.visibility === "friends"
                              ? "Лише друзі"
                              : event.visibility === "private"
                                ? "Приватна"
                                : "Публічна"}
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
                          {leavingId === event.id ? "..." : "Вийти"}
                        </button>
                      )
                    ) : (
                      <button
                        className="small-action"
                        type="button"
                        onClick={() => joinEvent(event)}
                        disabled={joiningId === event.id}
                      >
                        {joiningId === event.id ? "..." : "Приєднатися"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact">
              {tagFilter.length > 0
                ? "За обраними тегами подій немає."
                : filter === "mine"
                ? "У вас ще немає подій."
                : filter === "friends"
                  ? "У друзів немає доступних подій."
                  : "Публічних подій поки немає."}
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
