import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import MapLibreMap from "../components/MapLibreMap.jsx";
import { ensureCurrentUser } from "../userSession.js";

export default function RoomPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const loadRoom = useCallback(async () => {
    try {
      const [activityData, participantsData] = await Promise.all([
        api.getActivity(code),
        api.getParticipants(code),
      ]);
      setActivity(activityData);
      setParticipants(participantsData);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [code]);

  useEffect(() => {
    ensureCurrentUser().then(setUser).catch((err) => setError(err.message));
    loadRoom();
    const intervalId = window.setInterval(loadRoom, 5000);
    return () => window.clearInterval(intervalId);
  }, [loadRoom]);

  const isHost = Boolean(user && activity && activity.host_user_id === user.id);
  const isParticipant = Boolean(user && participants.some((participant) => participant.user_id === user.id));

  async function leaveEvent() {
    if (!user || !activity || isHost || !isParticipant || leaving) return;
    if (!window.confirm(`Від’єднатися від події «${activity.title}»?`)) return;

    setLeaving(true);
    setError("");
    try {
      await api.leaveActivity(activity.code, user.id);
      navigate("/events", { replace: true });
    } catch (err) {
      setError(err.message);
      setLeaving(false);
    }
  }

  if (error && !activity) {
    return <main className="form-page"><p className="error">{error}</p></main>;
  }

  if (!activity) {
    return <main className="loading-screen">Завантаження...</main>;
  }

  return (
    <main className="room-map-page">
      <MapLibreMap eventPins={[activity]} enableLocation={false} />

      <div className="room-map-header">
        <Link to="/events" className="room-map-header__back" aria-label="Назад">←</Link>
        <div className="room-map-header__title">
          <strong>{activity.title}</strong>
          <span>Код: {activity.code}</span>
        </div>
        <button
          className="room-map-header__toggle"
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
        >
          {panelOpen ? "×" : "i"}
        </button>
      </div>

      {panelOpen && (
        <aside className="room-sheet event-room-sheet">
          <div className="room-sheet__handle" />
          <div className="room-sheet__meta">
            <div>
              <span className="eyebrow">Учасники</span>
              <strong>{participants.length}</strong>
            </div>
            <div>
              <span className="eyebrow">Точок події</span>
              <strong>1</strong>
            </div>
            {isHost && <span className="badge">Організатор</span>}
            <span className="badge">{activity.is_public ? "Public" : "Private"}</span>
          </div>

          {activity.description && <p className="room-sheet__hint">{activity.description}</p>}

          <div className="participant-chips">
            {participants.map((participant) => (
              <span key={participant.user_id} className="participant-chip participant-chip--user">
                {participant.photo_url ? <img src={participant.photo_url} alt="" /> : null}
                {participant.name}{participant.is_host ? " · host" : ""}
              </span>
            ))}
          </div>

          {!isHost && isParticipant && (
            <button
              className="button danger-button"
              type="button"
              onClick={leaveEvent}
              disabled={leaving}
            >
              {leaving ? "Від’єднання..." : "Від’єднатися від події"}
            </button>
          )}

          {error && <p className="error">{error}</p>}
        </aside>
      )}

      <BottomNav />
    </main>
  );
}
