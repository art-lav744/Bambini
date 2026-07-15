import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import MapLibreMap from "../components/MapLibreMap.jsx";
import { ensureCurrentUser } from "../userSession.js";

const LOCATION_UPLOAD_INTERVAL_MS = 5000;
const LOCATION_HEARTBEAT_MS = 15000;
const LIVE_DATA_POLL_INTERVAL_MS = 3000;
const SERVER_RETRY_INTERVAL_MS = 5000;

function geolocationMessage(error) {
  if (error?.code === 1) {
    return "Доступ до геолокації заборонено. Дозвольте доступ до місцезнаходження для цього сайту в налаштуваннях браузера.";
  }

  if (error?.code === 2) {
    return "Не вдалося визначити позицію. Перевірте, чи увімкнена геолокація на телефоні.";
  }

  if (error?.code === 3) {
    return "Визначення позиції зайняло надто багато часу. Спробуйте ще раз.";
  }

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

function localFallbackUser() {
  const name = (localStorage.getItem("player_name") || "Гість").trim() || "Гість";
  return {
    id: null,
    name,
    photo_url: null,
    location_visibility: "none",
    location_sharing_enabled: false,
    is_local_fallback: true,
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
      await api.health();
      const profile = await ensureCurrentUser();
      setUser(profile);
      setServerOnline(true);
      setServerError("");

      try {
        const events = await api.getUserActivities(profile.id);
        setEventPins(events);
      } catch (error) {
        setServerError(error.message);
      }

      return profile;
    } catch (error) {
      setServerOnline(false);
      setServerError(
        "Серверна частина недоступна. Запустіть FastAPI на цьому ПК; карта продовжить працювати локально."
      );
      setUser((current) => current || localFallbackUser());
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    loadServerUser();
    const retryId = window.setInterval(() => {
      if (active && !serverOnline) loadServerUser();
    }, SERVER_RETRY_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(retryId);
    };
  }, [loadServerUser, serverOnline]);

  const uploadLocation = useCallback(
    async (location, force = false) => {
      if (!serverOnline || !user?.id || locationVisibility(user) === "none" || !location) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastUploadAtRef.current < LOCATION_UPLOAD_INTERVAL_MS) {
        return;
      }

      lastUploadAtRef.current = now;

      try {
        await api.updateLocation(user.id, {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        });
        setServerError("");
      } catch {
        setServerOnline(false);
        setServerError(
          "Зв’язок із сервером втрачено. Ваша позиція залишається видимою локально й синхронізується після відновлення сервера."
        );
      }
    },
    [serverOnline, user]
  );

  const handleLocationFound = useCallback(
    (location, forceUpload = false) => {
      latestLocationRef.current = location;
      setCurrentLocation(location);
      setLocationError("");
      uploadLocation(location, forceUpload);
    },
    [uploadLocation]
  );

  // GPS is independent from backend availability. The current user marker can
  // keep working locally even while the API is temporarily unavailable.
  useEffect(() => {
    if (!user) return undefined;
    if (!window.isSecureContext || !navigator.geolocation) return undefined;

    let disposed = false;

    const onPosition = (position, forceUpload = false) => {
      if (disposed) return;
      handleLocationFound(positionToLocation(position), forceUpload);
    };

    const onError = (error) => {
      if (!disposed) setLocationError(geolocationMessage(error));
    };

    const clearWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const requestFreshPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => onPosition(position, true),
        onError,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        }
      );
    };

    const startWatch = () => {
      if (watchIdRef.current !== null) return;

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => onPosition(position, false),
        onError,
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 30000,
        }
      );
    };

    const restartTracking = () => {
      if (document.visibilityState !== "visible") return;
      clearWatch();
      requestFreshPosition();
      startWatch();
    };

    requestFreshPosition();
    startWatch();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") restartTracking();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", restartTracking);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", restartTracking);
      clearWatch();
    };
  }, [handleLocationFound, user]);

  useEffect(() => {
    if (!serverOnline || !user?.id || locationVisibility(user) === "none") return undefined;

    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (latestLocationRef.current) {
        uploadLocation(latestLocationRef.current, true);
      }
    }, LOCATION_HEARTBEAT_MS);

    return () => window.clearInterval(heartbeatId);
  }, [serverOnline, uploadLocation, user]);

  useEffect(() => {
    if (!serverOnline || !user?.id) return undefined;
    let active = true;

    async function refreshLiveData() {
      try {
        const [locations, events] = await Promise.all([
          api.getVisibleLocations(user.id),
          api.getUserActivities(user.id),
        ]);

        if (active) {
          setVisibleLocations(locations);
          setEventPins(events);
          setServerError("");
        }
      } catch {
        if (active) {
          setServerOnline(false);
          setServerError("Втрачено з’єднання із сервером. Повторне підключення виконується автоматично.");
        }
      }
    }

    refreshLiveData();
    const intervalId = window.setInterval(refreshLiveData, LIVE_DATA_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [serverOnline, user]);

  const visibility = locationVisibility(user);
  const locationStatus = currentLocation
    ? `${visibleLocations.length} людей • ${eventPins.length} подій${serverOnline ? "" : " • локально"}`
    : !window.isSecureContext
      ? "Карта доступна • GPS потребує HTTPS"
      : visibility === "none" && user?.id
        ? "Позиція лише на вашому пристрої"
        : "Очікуємо геолокацію...";

  return (
    <main className="fullscreen-map-page">
      <MapLibreMap
        currentUser={user}
        currentLocation={currentLocation}
        friendLocations={visibleLocations}
        eventPins={eventPins}
        onLocationFound={handleLocationFound}
        enableLocation
      />

      <div className="map-brand-card map-user-card">
        <span className={`map-brand-card__dot${currentLocation ? " is-live" : ""}`} />
        <div>
          <strong>{user?.name || "Outdoor Together"}</strong>
          <span>{locationStatus}</span>
        </div>
      </div>

      {serverError && <div className="map-server-toast">{serverError}</div>}
      {locationError && <div className="map-global-toast">{locationError}</div>}
      <BottomNav />
    </main>
  );
}
