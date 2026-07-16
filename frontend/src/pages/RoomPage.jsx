import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import MapLibreMap from "../components/MapLibreMap.jsx";
import { ensureCurrentUser } from "../userSession.js";
import { formatEventDateTime } from "../eventFormat.js";

const ROOM_REFRESH_MS = 10000;
const ROOM_LOCATION_UPLOAD_MS = 8000;

function locationVisibility(user) {
  return user?.location_visibility || (user?.location_sharing_enabled ? "friends" : "none");
}

function positionToLocation(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    updated_at: new Date().toISOString(),
  };
}

export default function RoomPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [visibleLocations, setVisibleLocations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [joining, setJoining] = useState(false);
  const watchRef = useRef(null);
  const lastUploadAtRef = useRef(0);

  const loadRoom = useCallback(async () => {
    const [activityResult, participantsResult] = await Promise.allSettled([
      api.getActivity(code),
      api.getParticipants(code),
    ]);

    if (activityResult.status === "rejected") {
      setError(activityResult.reason?.message || "Не вдалося завантажити подію");
      return;
    }

    setActivity(activityResult.value);
    if (participantsResult.status === "fulfilled") {
      setParticipants(participantsResult.value);
      setError("");
    } else {
      setError(`Подію завантажено, але список учасників не оновлено: ${participantsResult.reason?.message || "помилка сервера"}`);
    }
  }, [code]);

  useEffect(() => {
    let active = true;
    ensureCurrentUser()
      .then((profile) => active && setUser(profile))
      .catch((err) => active && setError(err.message));
    loadRoom();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") loadRoom();
    }, ROOM_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadRoom]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const locations = await api.getVisibleLocations(user.id);
        if (active) setVisibleLocations(locations);
      } catch {
        // Room details remain usable if live locations temporarily fail.
      }
    };
    refresh();
    const id = window.setInterval(refresh, ROOM_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [user]);

  const uploadLocation = useCallback(async (location, force = false) => {
    if (!user?.id || locationVisibility(user) === "none" || !location) return;
    const now = Date.now();
    if (!force && now - lastUploadAtRef.current < ROOM_LOCATION_UPLOAD_MS) return;
    lastUploadAtRef.current = now;
    try {
      await api.updateLocation(user.id, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });
    } catch {
      // Keep the local marker. The next GPS update retries synchronization.
    }
  }, [user]);

  const handleLocationFound = useCallback((location, force = false) => {
    setCurrentLocation(location);
    uploadLocation(location, force);
  }, [uploadLocation]);

  useEffect(() => {
    if (!user || !window.isSecureContext || !navigator.geolocation) return undefined;
    let disposed = false;

    const clearWatch = () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
    const onPosition = (position, force = false) => {
      if (!disposed) handleLocationFound(positionToLocation(position), force);
    };
    const startWatch = () => {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (position) => onPosition(position, true),
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
      if (watchRef.current === null) {
        watchRef.current = navigator.geolocation.watchPosition(
          (position) => onPosition(position),
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
        );
      }
    };
    const onVisibilityChange = () => {
      clearWatch();
      if (document.visibilityState === "visible") startWatch();
    };

    startWatch();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearWatch();
    };
  }, [handleLocationFound, user]);

  const isHost = Boolean(user && activity && activity.host_user_id === user.id);
  const isParticipant = Boolean(user && participants.some((participant) => participant.user_id === user.id));

  async function joinEvent() {
    if (!user || !activity || joining || isParticipant) return;
    setJoining(true);
    setError("");
    try {
      await api.joinActivity(activity.code, user.id);
      await loadRoom();
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

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
    return (
      <main className="form-page">
        <p className="error">{error}</p>
        <Link className="button secondary" to="/events">До подій</Link>
      </main>
    );
  }
  if (!activity) return <main className="loading-screen">Завантаження...</main>;

  return (
    <main className="room-map-page">
      <MapLibreMap
        eventPins={[activity]}
        currentUser={user}
        currentLocation={currentLocation}
        friendLocations={visibleLocations}
        enableLocation
        onLocationFound={handleLocationFound}
      />

      <div className="room-map-header">
        <Link to="/events" className="room-map-header__back" aria-label="Назад">←</Link>
        <div className="room-map-header__title"><strong>{activity.title}</strong><span>Код: {activity.code}</span></div>
        <button className="room-map-header__toggle" type="button" onClick={() => setPanelOpen((value) => !value)}>{panelOpen ? "×" : "i"}</button>
      </div>

      {panelOpen && (
        <aside className="room-sheet event-room-sheet">
          <div className="room-sheet__handle" />
          {activity.image_url && <div className="event-room-sheet__image"><img src={activity.image_url} alt="" /></div>}
          <div className="event-room-sheet__time">{formatEventDateTime(activity.start_time, activity.end_time)}</div>
          <div className="room-sheet__meta">
            <div><span className="eyebrow">Учасники</span><strong>{participants.length}{activity.capacity ? `/${activity.capacity}` : ""}</strong></div>
            <div><span className="eyebrow">Точок події</span><strong>1</strong></div>
            {isHost && <span className="badge">Організатор</span>}
            <span className="badge">{activity.visibility === "friends" ? "Лише друзі" : activity.visibility === "private" ? "Приватна" : "Публічна"}</span>
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

          {!isParticipant && (
            <button className="button primary" type="button" onClick={joinEvent} disabled={joining}>
              {joining ? "Приєднання..." : "Приєднатися до події"}
            </button>
          )}
          {!isHost && isParticipant && (
            <button className="button danger-button" type="button" onClick={leaveEvent} disabled={leaving}>
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
