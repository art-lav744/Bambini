import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import { ensureCurrentUser } from "../userSession.js";

export default function EventsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [publicEvents, setPublicEvents] = useState([]);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    ensureCurrentUser()
      .then(async (profile) => {
        if (!active) return;
        setUser(profile);
        const [ownEvents, publicData] = await Promise.all([
          api.getUserActivities(profile.id),
          api.getPublicActivities(),
        ]);
        if (active) {
          setEvents(ownEvents);
          setPublicEvents(publicData);
        }
      })
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  const joinedIds = useMemo(() => new Set(events.map((event) => event.id)), [events]);
  const discoverableEvents = publicEvents.filter((event) => !joinedIds.has(event.id));

  async function joinPublicEvent(event) {
    if (!user) return;
    setJoiningId(event.id);
    setError("");
    try {
      await api.joinActivity(event.code, user.id);
      navigate(`/room/${event.code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <main className="main-tab-page">
      <div className="tab-page__content">
        <div className="eyebrow">Активності</div>
        <h1>Події</h1>
        <p className="muted">
          Події прив’язані до вашого профілю. Створені та приєднані події автоматично з’являються на головній карті.
        </p>

        <div className="event-actions">
          <Link className="event-action-card" to="/create">
            <span className="event-action-card__symbol">+</span>
            <div>
              <strong>Створити подію</strong>
              <span>Одна точка на карті, public або private</span>
            </div>
          </Link>

          <Link className="event-action-card" to="/join">
            <span className="event-action-card__symbol">#</span>
            <div>
              <strong>Приєднатися за кодом</strong>
              <span>Працює також для приватних подій</span>
            </div>
          </Link>
        </div>

        <section className="event-list-section">
          <h2>Мої події</h2>
          {events.length ? (
            <div className="event-list">
              {events.map((event) => (
                <Link className="event-list-card" key={event.id} to={`/room/${event.code}`}>
                  <span className="event-list-card__pin">●</span>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.description || `Код ${event.code}`}</span>
                  </div>
                  <small>
                    {event.host_user_id === user?.id ? "Організатор" : "Учасник"}
                    {` · ${event.is_public ? "Public" : "Private"}`}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">Ви ще не створили та не приєдналися до жодної події.</div>
          )}
        </section>

        <section className="event-list-section">
          <h2>Публічні події</h2>
          {discoverableEvents.length ? (
            <div className="event-list">
              {discoverableEvents.map((event) => (
                <article className="event-list-card public-event-card" key={event.id}>
                  <span className="event-list-card__pin">●</span>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.description || `Код ${event.code}`}</span>
                  </div>
                  <button
                    className="small-action"
                    type="button"
                    onClick={() => joinPublicEvent(event)}
                    disabled={joiningId === event.id}
                  >
                    {joiningId === event.id ? "..." : "Приєднатися"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">Нових публічних подій поки немає.</div>
          )}
        </section>

        {error && <p className="error">{error}</p>}
      </div>
      <BottomNav />
    </main>
  );
}
