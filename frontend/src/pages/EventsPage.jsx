import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import { ensureCurrentUser } from "../userSession.js";
import { formatEventDateTime } from "../eventFormat.js";

const FILTERS = [
  { value: "mine", label: "Мої" },
  { value: "friends", label: "Друзі" },
  { value: "public", label: "Публічні" },
];

export default function EventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [myEvents, setMyEvents] = useState([]);
  const [friendEvents, setFriendEvents] = useState([]);
  const [publicEvents, setPublicEvents] = useState([]);
  const [filter, setFilter] = useState("mine");
  const [joiningId, setJoiningId] = useState(null);
  const [leavingId, setLeavingId] = useState(null);
  const [error, setError] = useState("");

  async function loadEvents(profile) {
    const results = await Promise.allSettled([
      api.getUserActivities(profile.id),
      api.getFriendActivities(profile.id),
      api.getPublicActivities(),
    ]);
    const [mine, friends, publicData] = results;
    if (mine.status === "fulfilled") setMyEvents(mine.value);
    if (friends.status === "fulfilled") setFriendEvents(friends.value);
    if (publicData.status === "fulfilled") setPublicEvents(publicData.value);
    const failure = results.find((result) => result.status === "rejected");
    setError(failure ? `Частину списків не оновлено: ${failure.reason?.message || "помилка сервера"}` : "");
  }

  useEffect(() => {
    let active = true;
    ensureCurrentUser()
      .then(async (profile) => {
        if (!active) return;
        setUser(profile);
        await loadEvents(profile);
      })
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  const joinedIds = useMemo(() => new Set(myEvents.map((event) => event.id)), [myEvents]);
  const visibleEvents = filter === "mine"
    ? myEvents
    : filter === "friends"
      ? friendEvents
      : publicEvents;

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

  async function leaveEvent(event) {
    if (!user || event.host_user_id === user.id) return;
    if (!window.confirm(`Від’єднатися від події «${event.title}»?`)) return;

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

  return (
    <main className="main-tab-page">
      <div className="tab-page__content">
        <div className="eyebrow">Активності</div>
        <h1>Події</h1>

        <div className="event-actions">
          <Link className="event-action-card" to="/create">
            <span className="event-action-card__symbol">+</span>
            <div>
              <strong>Створити подію</strong>
              <span>Одна точка на карті</span>
            </div>
          </Link>
          <Link className="event-action-card" to="/join">
            <span className="event-action-card__symbol">#</span>
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

        <section className="event-list-section">
          {visibleEvents.length ? (
            <div className="event-list">
              {visibleEvents.map((event) => {
                const joined = joinedIds.has(event.id);
                const isHost = event.host_user_id === user?.id;
                return (
                  <article className="event-list-card public-event-card" key={event.id}>
                    <div className="event-list-card__media">
                      {event.image_url ? (
                        <img src={event.image_url} alt="" />
                      ) : (
                        <span className="event-list-card__pin">●</span>
                      )}
                    </div>
                    <Link className="event-list-card__content" to={`/room/${event.code}`}>
                      <div className="event-list-card__topline">
                        <strong>{event.title}</strong>
                        <time>{formatEventDateTime(event.start_time)}</time>
                      </div>
                      <span>{event.description || `Код ${event.code}`}</span>
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
              {filter === "mine"
                ? "У вас ще немає подій."
                : filter === "friends"
                  ? "У друзів немає доступних подій."
                  : "Публічних подій поки немає."}
            </div>
          )}
        </section>

        {error && <p className="error">{error}</p>}
      </div>
      <BottomNav />
    </main>
  );
}
