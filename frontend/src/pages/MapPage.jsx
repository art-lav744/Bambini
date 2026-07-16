import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import MapLibreMap from "../components/MapLibreMap.jsx";
import { ensureCurrentUser } from "../userSession.js";

const LOCATION_UPLOAD_INTERVAL_MS = 8000;
const LOCATION_HEARTBEAT_MS = 30000;
const LOCATION_POLL_INTERVAL_MS = 8000;
const EVENT_POLL_INTERVAL_MS = 20000;
const SERVER_RETRY_INTERVAL_MS = 10000;

function geolocationMessage(error) {
  if (error?.code === 1) return "Доступ до геолокації заборонено. Дозвольте його в налаштуваннях браузера.";
  if (error?.code === 2) return "Не вдалося визначити позицію. Перевірте геолокацію на телефоні.";
  if (error?.code === 3) return "Визначення позиції зайняло надто багато часу.";
  return "Не вдалося отримати геолокацію.";
}

function positionToLocation(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    updated_at: new Date().toISOString(),
  };
}

function locationVisibility(user) {
  if (!user) return "none";
  return user.location_visibility || (user.location_sharing_enabled ? "friends" : "none");
}

function cachedUser() {
  const id = Number(localStorage.getItem("outdoor_user_id"));
  return {
    id: Number.isInteger(id) && id > 0 ? id : null,
    name: (localStorage.getItem("player_name") || "Користувач").trim() || "Користувач",
    photo_url: null,
    location_visibility: "none",
    location_sharing_enabled: false,
    is_cached: true,
  };
}

export default function MapPage() {
  const [user, setUser] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [visibleLocations, setVisibleLocations] = useState([]);
  const [eventPins, setEventPins] = useState([]);
  const [locationError, setLocationError] = useState("");
  const [serverError, setServerError] = useState("");
  const [serverOnline, setServerOnline] = useState(false);

  const lastUploadAtRef = useRef(0);
  const watchIdRef = useRef(null);
  const latestLocationRef = useRef(null);

  const loadServerUser = useCallback(async () => {
    try {
      const profile = await ensureCurrentUser();
      setUser(profile);
      setServerOnline(true);
      setServerError("");
      return profile;
    } catch (error) {
      setServerOnline(false);
      setServerError(error instanceof ApiError && error.status === 401
        ? error.message
        : "Сервер тимчасово недоступний. Сесія збережена, карта та GPS продовжують працювати локально.");
      setUser((current) => current || cachedUser());
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadServerUser();
    const retryId = window.setInterval(() => {
      if (active && document.visibilityState === "visible" && !serverOnline) loadServerUser();
    }, SERVER_RETRY_INTERVAL_MS);
    return () => { active = false; window.clearInterval(retryId); };
  }, [loadServerUser, serverOnline]);

  const uploadLocation = useCallback(async (location, force = false) => {
    if (!serverOnline || !user?.id || locationVisibility(user) === "none" || !location) return;
    const now = Date.now();
    if (!force && now - lastUploadAtRef.current < LOCATION_UPLOAD_INTERVAL_MS) return;
    lastUploadAtRef.current = now;
    try {
      await api.updateLocation(user.id, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });
      setServerOnline(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) setServerOnline(false);
      setServerError("Позиція залишилась на пристрої та синхронізується після відновлення мережі.");
    }
  }, [serverOnline, user]);

  const handleLocationFound = useCallback((location, forceUpload = false) => {
    latestLocationRef.current = location;
    setCurrentLocation(location);
    setLocationError("");
    uploadLocation(location, forceUpload);
  }, [uploadLocation]);

  useEffect(() => {
    if (!user || !window.isSecureContext || !navigator.geolocation) return undefined;
    let disposed = false;
    const onPosition = (position, force = false) => !disposed && handleLocationFound(positionToLocation(position), force);
    const onError = (error) => !disposed && setLocationError(geolocationMessage(error));
    const clearWatch = () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
    const start = () => {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition((position) => onPosition(position, true), onError, {
        enableHighAccuracy: true, maximumAge: 0, timeout: 20000,
      });
      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition((position) => onPosition(position), onError, {
          enableHighAccuracy: true, maximumAge: 5000, timeout: 30000,
        });
      }
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "visible") { clearWatch(); start(); }
      else clearWatch();
    };
    start();
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("online", start);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("online", start);
      clearWatch();
    };
  }, [handleLocationFound, user]);

  useEffect(() => {
    if (!serverOnline || !user?.id || locationVisibility(user) === "none") return undefined;
    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState === "visible" && latestLocationRef.current) uploadLocation(latestLocationRef.current, true);
    }, LOCATION_HEARTBEAT_MS);
    return () => window.clearInterval(heartbeatId);
  }, [serverOnline, uploadLocation, user]);

  useEffect(() => {
    if (!serverOnline || !user?.id) return undefined;
    let active = true;
    const refreshLocations = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const locations = await api.getVisibleLocations(user.id);
        if (active) { setVisibleLocations(locations); setServerError(""); }
      } catch (error) {
        if (active) setServerError(`Локації не оновлено: ${error.message}`);
      }
    };
    refreshLocations();
    const id = window.setInterval(refreshLocations, LOCATION_POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(id); };
  }, [serverOnline, user]);

  useEffect(() => {
    if (!serverOnline || !user?.id) return undefined;
    let active = true;
    const refreshEvents = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const events = await api.getVisibleActivities();
        if (active) setEventPins(events);
      } catch (error) {
        if (active) setServerError(`Події не оновлено: ${error.message}`);
      }
    };
    refreshEvents();
    const id = window.setInterval(refreshEvents, EVENT_POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(id); };
  }, [serverOnline, user]);

  const visibility = locationVisibility(user);
  const locationStatus = currentLocation
    ? `${visibleLocations.length} людей • ${eventPins.length} подій${serverOnline ? "" : " • локально"}`
    : !window.isSecureContext ? "Карта доступна • GPS потребує HTTPS"
      : visibility === "none" && user?.id ? "Позиція лише на вашому пристрої"
        : "Очікуємо геолокацію...";

  return (
    <main className="fullscreen-map-page">
      <MapLibreMap currentUser={user} currentLocation={currentLocation} friendLocations={visibleLocations}
        eventPins={eventPins} onLocationFound={handleLocationFound} enableLocation />
      <div className="map-brand-card map-user-card">
        <span className={`map-brand-card__dot${currentLocation ? " is-live" : ""}`} />
        <div><strong>{user?.name || "Outdoor Together"}</strong><span>{locationStatus}</span></div>
      </div>
      {serverError && <div className="map-server-toast">{serverError}</div>}
      {locationError && <div className="map-global-toast">{locationError}</div>}
      <BottomNav />
    </main>
  );
}
