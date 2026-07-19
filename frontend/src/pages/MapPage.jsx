import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import MapLibreMap from "../components/MapLibreMap.jsx";
import { filterMapEvents, MAP_EVENT_FILTER_OPTIONS, normalizeMapEventFilter } from "../mapEventFilter.js";
import { filterMapPeopleWithEventParticipants, MAP_PEOPLE_FILTER_OPTIONS, normalizeMapPeopleFilter } from "../mapPeopleFilter.js";
import { EVENT_TAG_OPTIONS, eventTagLabel, filterEventsByTags, normalizeEventTags, toggleEventTag } from "../eventTags.js";
import { DEFAULT_CUSTOMIZATION, normalizeCustomization } from "../customization.js";
import { ensureCurrentUser } from "../userSession.js";
import { localizeApiMessage, translate, useI18n } from "../i18n.js";

const LOCATION_UPLOAD_INTERVAL_MS = 8000;
const LOCATION_HEARTBEAT_MS = 30000;
const LOCATION_POLL_INTERVAL_MS = 8000;
const EVENT_POLL_INTERVAL_MS = 20000;
const SERVER_RETRY_INTERVAL_MS = 10000;
const PEOPLE_FILTER_STORAGE_KEY = "bambini:map:people-filter";
const EVENT_FILTER_STORAGE_KEY = "bambini:map:event-filter";
const EVENT_TAG_FILTER_STORAGE_KEY = "bambini:map:event-tag-filter";

function initialPeopleFilter() {
  try {
    return normalizeMapPeopleFilter(localStorage.getItem(PEOPLE_FILTER_STORAGE_KEY));
  } catch {
    return "all";
  }
}

function initialEventFilter() {
  try {
    return normalizeMapEventFilter(localStorage.getItem(EVENT_FILTER_STORAGE_KEY));
  } catch {
    return "all";
  }
}

function initialEventTagFilter() {
  try {
    return normalizeEventTags(JSON.parse(localStorage.getItem(EVENT_TAG_FILTER_STORAGE_KEY) || "[]"), Number.POSITIVE_INFINITY);
  } catch {
    return [];
  }
}

function geolocationMessage(error, language) {
  if (error?.code === 1) return translate("Доступ до геолокації заборонено. Дозвольте його в налаштуваннях браузера.", "Location access is denied. Allow it in your browser settings.", language);
  if (error?.code === 2) return translate("Не вдалося визначити позицію. Перевірте геолокацію на телефоні.", "Could not determine your position. Check location services on your phone.", language);
  if (error?.code === 3) return translate("Визначення позиції зайняло надто багато часу.", "Determining your position took too long.", language);
  return translate("Не вдалося отримати геолокацію.", "Could not get your location.", language);
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

function cachedUser(language) {
  const id = Number(localStorage.getItem("outdoor_user_id"));
  return {
    id: Number.isInteger(id) && id > 0 ? id : null,
    name: (localStorage.getItem("player_name") || translate("Користувач", "User", language)).trim() || translate("Користувач", "User", language),
    photo_url: null,
    location_visibility: "none",
    location_sharing_enabled: false,
    ...DEFAULT_CUSTOMIZATION,
    is_cached: true,
  };
}

export default function MapPage() {
  const { language, tr } = useI18n();
  const [user, setUser] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [visibleLocations, setVisibleLocations] = useState([]);
  const [eventPins, setEventPins] = useState([]);
  const [locationError, setLocationError] = useState("");
  const [serverError, setServerError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [serverOnline, setServerOnline] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState(initialPeopleFilter);
  const [eventFilter, setEventFilter] = useState(initialEventFilter);
  const [eventTagFilter, setEventTagFilter] = useState(initialEventTagFilter);
  const [peopleFilterExpanded, setPeopleFilterExpanded] = useState(false);
  const [eventFilterExpanded, setEventFilterExpanded] = useState(false);
  const [eventTagFilterExpanded, setEventTagFilterExpanded] = useState(false);

  const lastUploadAtRef = useRef(0);
  const watchIdRef = useRef(null);
  const latestLocationRef = useRef(null);
  const actionMessageTimerRef = useRef(null);

  const showActionMessage = useCallback((message) => {
    window.clearTimeout(actionMessageTimerRef.current);
    setActionMessage(message);
    actionMessageTimerRef.current = window.setTimeout(() => setActionMessage(""), 3500);
  }, []);

  useEffect(() => () => window.clearTimeout(actionMessageTimerRef.current), []);

  const loadServerUser = useCallback(async () => {
    try {
      const profile = await ensureCurrentUser();
      const customization = normalizeCustomization(await api.getCustomization(profile.id));
      const styledProfile = { ...profile, ...customization };
      setUser(styledProfile);
      setServerOnline(true);
      setServerError("");
      return styledProfile;
    } catch (error) {
      setServerOnline(false);
      setServerError(error instanceof ApiError && error.status === 401
        ? error.message
        : tr("Сервер тимчасово недоступний. Сесія збережена, карта та GPS продовжують працювати локально.", "The server is temporarily unavailable. Your session is saved; the map and GPS continue to work locally."));
      setUser((current) => current || cachedUser(language));
      return null;
    }
  }, [language, tr]);

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
      setServerError(tr("Позиція залишилась на пристрої та синхронізується після відновлення мережі.", "Your position remains on this device and will sync when the network returns."));
    }
  }, [serverOnline, tr, user]);

  const joinNearbyEvent = useCallback(async (event) => {
    if (!user?.id) return;
    try {
      const joined = await api.joinActivity(event.code, user.id);
      setEventPins((current) => current.map((item) => item.id === joined.id ? joined : item));
      showActionMessage(tr(`Ви приєдналися до «${event.title}»`, `You joined “${event.title}”`));
      return joined;
    } catch (error) {
      setServerError(localizeApiMessage(error.message, language));
      throw error;
    }
  }, [language, showActionMessage, tr, user]);

  const addVisibleUserToFriends = useCallback(async (visibleUser) => {
    if (!user?.id || !visibleUser?.friend_code) return;
    try {
      const request = await api.sendFriendRequest(user.id, visibleUser.friend_code);
      setVisibleLocations((current) => current.map((item) =>
        item.user_id === visibleUser.user_id
          ? { ...item, friendship_status: "pending" }
          : item
      ));
      showActionMessage(tr(`Запит для ${visibleUser.name} надіслано`, `Request sent to ${visibleUser.name}`));
      return request;
    } catch (error) {
      setServerError(localizeApiMessage(error.message, language));
      throw error;
    }
  }, [language, showActionMessage, tr, user]);

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
    const onError = (error) => !disposed && setLocationError(geolocationMessage(error, language));
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
  }, [handleLocationFound, language, user]);

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
        if (active) setServerError(tr(`Локації не оновлено: ${error.message}`, `Locations were not updated: ${localizeApiMessage(error.message, language)}`));
      }
    };
    refreshLocations();
    const id = window.setInterval(refreshLocations, LOCATION_POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(id); };
  }, [language, serverOnline, tr, user]);

  useEffect(() => {
    if (!serverOnline || !user?.id) return undefined;
    let active = true;
    const refreshEvents = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const events = await api.getVisibleActivities();
        if (active) setEventPins(events);
      } catch (error) {
        if (active) setServerError(tr(`Події не оновлено: ${error.message}`, `Events were not updated: ${localizeApiMessage(error.message, language)}`));
      }
    };
    refreshEvents();
    const id = window.setInterval(refreshEvents, EVENT_POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(id); };
  }, [language, serverOnline, tr, user]);

  const visibility = locationVisibility(user);
  const displayedEvents = useMemo(() => filterEventsByTags(
    filterMapEvents(eventPins, eventFilter, user?.id),
    eventTagFilter
  ), [eventFilter, eventPins, eventTagFilter, user?.id]);
  const displayedLocations = useMemo(
    () => filterMapPeopleWithEventParticipants(visibleLocations, peopleFilter, displayedEvents, user?.id),
    [displayedEvents, peopleFilter, user?.id, visibleLocations]
  );
  const locationStatus = currentLocation
    ? tr(
      `${displayedLocations.length} людей • ${displayedEvents.length} подій${serverOnline ? "" : " • локально"}`,
      `${displayedLocations.length} people • ${displayedEvents.length} events${serverOnline ? "" : " • local"}`,
    )
    : !window.isSecureContext ? tr("Карта доступна • GPS потребує HTTPS", "Map available • GPS requires HTTPS")
      : visibility === "none" && user?.id ? tr("Позиція лише на вашому пристрої", "Position only on your device")
        : tr("Очікуємо геолокацію...", "Waiting for location...");

  return (
    <main className="fullscreen-map-page">
      <MapLibreMap currentUser={user} currentLocation={currentLocation} friendLocations={displayedLocations}
        eventPins={displayedEvents} onLocationFound={handleLocationFound} onJoinEvent={joinNearbyEvent}
        onAddFriend={addVisibleUserToFriends} enableLocation autoCenterOnUser />
      <div className="map-brand-card map-user-card">
        <span className={`map-brand-card__dot${currentLocation ? " is-live" : ""}`} />
        <div><strong>{user?.name || "Bambini"}</strong><span>{locationStatus}</span></div>
      </div>
      <div className="map-filter-stack">
        <div className={`map-layer-filter map-people-filter${peopleFilterExpanded ? " is-expanded" : ""}`} role="group" aria-label={tr("Кого показувати на карті", "Who to show on the map")}>
          <button
            className={`map-layer-filter__label${peopleFilterExpanded ? " is-expanded" : ""}`}
            type="button"
            aria-expanded={peopleFilterExpanded}
            aria-controls="map-people-filter-options"
            onClick={() => setPeopleFilterExpanded((expanded) => !expanded)}
          >
            {tr("Люди", "People")}
          </button>
          {peopleFilterExpanded && (
            <div className="map-layer-filter__options" id="map-people-filter-options">
              {MAP_PEOPLE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={peopleFilter === option.value ? "is-active" : ""}
                  type="button"
                  aria-pressed={peopleFilter === option.value}
                  onClick={() => {
                    setPeopleFilter(option.value);
                    try {
                      localStorage.setItem(PEOPLE_FILTER_STORAGE_KEY, option.value);
                    } catch {
                      // The filter still works for this session if storage is unavailable.
                    }
                  }}
                >
                  {language === "en" ? option.labelEn : option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={`map-layer-filter map-event-filter${eventFilterExpanded ? " is-expanded" : ""}`} role="group" aria-label={tr("Які події показувати на карті", "Which events to show on the map")}>
          <button
            className={`map-layer-filter__label${eventFilterExpanded ? " is-expanded" : ""}`}
            type="button"
            aria-expanded={eventFilterExpanded}
            aria-controls="map-event-filter-options"
            onClick={() => setEventFilterExpanded((expanded) => !expanded)}
          >
            {tr("Події", "Events")}
          </button>
          {eventFilterExpanded && (
            <div className="map-layer-filter__options" id="map-event-filter-options">
              {MAP_EVENT_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={eventFilter === option.value ? "is-active" : ""}
                  type="button"
                  aria-pressed={eventFilter === option.value}
                  onClick={() => {
                    setEventFilter(option.value);
                    try {
                      localStorage.setItem(EVENT_FILTER_STORAGE_KEY, option.value);
                    } catch {
                      // The filter still works for this session if storage is unavailable.
                    }
                  }}
                >
                  {language === "en" ? option.labelEn : option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={`map-layer-filter map-tag-filter${eventTagFilterExpanded ? " is-expanded" : ""}`} role="group" aria-label={tr("Фільтр подій за тегами", "Filter events by tags")}>
          <button
            className={`map-layer-filter__label${eventTagFilterExpanded ? " is-expanded" : ""}`}
            type="button"
            aria-expanded={eventTagFilterExpanded}
            aria-controls="map-tag-filter-options"
            onClick={() => setEventTagFilterExpanded((expanded) => !expanded)}
          >
            {tr("Теги", "Tags")}{eventTagFilter.length ? ` ${eventTagFilter.length}` : ""}
          </button>
          {eventTagFilterExpanded && (
            <div className="map-tag-filter__options" id="map-tag-filter-options">
              <button
                className={eventTagFilter.length === 0 ? "is-active" : ""}
                type="button"
                aria-pressed={eventTagFilter.length === 0}
                onClick={() => {
                  setEventTagFilter([]);
                  try { localStorage.setItem(EVENT_TAG_FILTER_STORAGE_KEY, "[]"); } catch { /* Session-only filter. */ }
                }}
              >
                {tr("Усі теги", "All tags")}
              </button>
              {EVENT_TAG_OPTIONS.map((tag) => (
                <button
                  key={tag.value}
                  className={eventTagFilter.includes(tag.value) ? "is-active" : ""}
                  type="button"
                  aria-pressed={eventTagFilter.includes(tag.value)}
                  onClick={() => setEventTagFilter((current) => {
                    const next = toggleEventTag(current, tag.value, Number.POSITIVE_INFINITY);
                    try { localStorage.setItem(EVENT_TAG_FILTER_STORAGE_KEY, JSON.stringify(next)); } catch { /* Session-only filter. */ }
                    return next;
                  })}
                >
                  {eventTagLabel(tag.value, language)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {serverError && <div className="map-server-toast">{serverError}</div>}
      {(locationError || actionMessage) && (
        <div className={`map-global-toast${actionMessage && !locationError ? " is-success" : ""}`}>
          {locationError || actionMessage}
        </div>
      )}
      <BottomNav />
    </main>
  );
}
