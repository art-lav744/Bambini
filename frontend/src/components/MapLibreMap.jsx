import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";
import AppIcon from "./AppIcon.jsx";
import { resolveMascot } from "../customization.js";
import { iconSvgMarkup } from "../icons.js";
import { getEventOrbitPatternOffsets, isWithinEventGeofence, limitEventOrbitUsers, prioritizeEventOrbitUsers } from "../mapMath.js";

const DEFAULT_CENTER = [24.7111, 48.9226];
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const MAP_VIEW_STORAGE_KEY = "bambini:map:view:v2";
const MIN_ZOOM = 1;
const MAX_ZOOM = 21;
const DEFAULT_ZOOM = 13;
const MAX_EVENT_ORBIT_USERS = 8;
const MIN_EVENT_VISIBLE_ZOOM = 8.5;
const EVENT_PIN_RADIUS_PX = 27;
const EVENT_USER_RADIUS_PX = 13;
const EVENT_ORBIT_OVERLAP_PX = 4;

function loadSavedMapView() {
  try {
    const saved = JSON.parse(localStorage.getItem(MAP_VIEW_STORAGE_KEY) || "null");
    const longitude = Number(saved?.longitude);
    const latitude = Number(saved?.latitude);
    const zoom = Number(saved?.zoom);
    if (
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(zoom)
    ) {
      return null;
    }

    return {
      center: [longitude, latitude],
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
    };
  } catch {
    return null;
  }
}

function saveMapView(map) {
  const center = map.getCenter();
  try {
    localStorage.setItem(
      MAP_VIEW_STORAGE_KEY,
      JSON.stringify({
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
      })
    );
  } catch {
    // Storage may be disabled in private browsing or restricted webviews.
  }
}

function normalizeLngLat(value) {
  const longitude = Number(value?.longitude ?? value?.lng);
  const latitude = Number(value?.latitude ?? value?.lat);

  if (
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90
  ) {
    return null;
  }

  return [longitude, latitude];
}

function safeSetPaint(map, layerId, property, value) {
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // Not every source style exposes every paint property.
  }
}

function safeSetLayout(map, layerId, property, value) {
  try {
    map.setLayoutProperty(layerId, property, value);
  } catch {
    // Ignore style layers that do not expose this layout property.
  }
}

function mapThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name) => styles.getPropertyValue(name).trim();

  return {
    water: read("--color-map-water"),
    roadMajor: read("--color-map-road-major"),
    road: read("--color-text-muted-map"),
    boundary: read("--color-map-boundary"),
    label: read("--color-text-soft-map"),
    labelHalo: read("--color-map-label-halo"),
  };
}

function applyMapThemeStyle(map) {
  const layers = map.getStyle()?.layers || [];
  const colors = mapThemeColors();

  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    const sourceLayer = String(layer["source-layer"] || "").toLowerCase();
    const key = `${id} ${sourceLayer}`;

    // Keep the base OpenFreeMap style intact. Repainting every fill layer
    // after the style loads caused the whole map to visibly turn almost black
    // about a second after entering /map.
    if (layer.type === "fill") {
      if (key.includes("water")) {
        safeSetPaint(map, layer.id, "fill-color", colors.water);
        safeSetPaint(map, layer.id, "fill-opacity", 0.96);
      } else if (
        key.includes("park") ||
        key.includes("landcover") ||
        key.includes("landuse") ||
        key.includes("wood") ||
        key.includes("grass")
      ) {
        safeSetPaint(map, layer.id, "fill-opacity", 0.72);
      }
      continue;
    }

    if (layer.type === "line") {
      const isRoad =
        key.includes("road") ||
        key.includes("street") ||
        key.includes("highway") ||
        key.includes("motorway") ||
        key.includes("transportation");

      if (isRoad) {
        const major =
          key.includes("motorway") ||
          key.includes("trunk") ||
          key.includes("primary");
        safeSetPaint(map, layer.id, "line-color", major ? colors.roadMajor : colors.road);
        safeSetPaint(map, layer.id, "line-opacity", major ? 0.94 : 0.8);
      } else if (key.includes("boundary")) {
        safeSetPaint(map, layer.id, "line-color", colors.boundary);
      }
      continue;
    }

    if (layer.type === "symbol") {
      // Remove broad geographic labels while keeping road/street labels.
      const isPlaceLabel =
        sourceLayer === "place" ||
        sourceLayer.includes("place") ||
        key.includes("place_") ||
        key.includes("place-") ||
        key.includes("country") ||
        key.includes("state") ||
        key.includes("province") ||
        key.includes("region") ||
        key.includes("admin1") ||
        key.includes("city_label") ||
        key.includes("city-label") ||
        key.includes("town_label") ||
        key.includes("town-label") ||
        key.includes("village_label") ||
        key.includes("village-label") ||
        key.includes("suburb") ||
        key.includes("neighbourhood") ||
        key.includes("neighborhood") ||
        key.includes("locality") ||
        key.includes("district_label") ||
        key.includes("district-label");

      if (isPlaceLabel) {
        safeSetLayout(map, layer.id, "visibility", "none");
        continue;
      }

      safeSetPaint(map, layer.id, "text-color", colors.label);
      safeSetPaint(map, layer.id, "text-halo-color", colors.labelHalo);
      safeSetPaint(map, layer.id, "text-halo-width", 1.1);
    }
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name = "?") {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function mascotPreviewHtml(customization) {
  const { skin, header, bottom, background, layers } = resolveMascot(customization);
  const label = `Сконструйований образ: ${skin.name}, ${header.name}, ${bottom.name}, фон ${background.name}`;
  const images = layers.map((layer) =>
    `<img class="map-person-card__mascot-layer" src="${escapeHtml(layer.asset)}" alt="">`
  ).join("");
  return `<div class="map-person-card__mascot mascot-background--${escapeHtml(background.id)}" role="img" aria-label="${escapeHtml(label)}">${images}</div>`;
}

function decoratePopupCloseButton(popup) {
  const closeButton = popup.getElement()?.querySelector(".maplibregl-popup-close-button");
  if (closeButton) closeButton.innerHTML = iconSvgMarkup("close");
}

function formatEventDateTime(value) {
  if (!value) return "Час не вказано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Час не вказано";
  return new Intl.DateTimeFormat("uk-UA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function eventVisibilityLabel(visibility) {
  if (visibility === "friends") return "Лише друзі";
  if (visibility === "private") return "Приватна";
  return "Публічна";
}

function markerScaleForZoom(zoom) {
  if (zoom <= MIN_ZOOM) return 0.62;
  if (zoom >= 14) return 1;
  return 0.62 + ((zoom - MIN_ZOOM) / (14 - MIN_ZOOM)) * 0.38;
}

function eventMarkerScaleForZoom(zoom) {
  if (zoom < MIN_EVENT_VISIBLE_ZOOM) return 0;
  if (zoom >= 15) return 1;

  const progress =
    (zoom - MIN_EVENT_VISIBLE_ZOOM) / (15 - MIN_EVENT_VISIBLE_ZOOM);
  return 0.48 + progress * 0.52;
}

function eventOrbitRadiusForZoom(zoom) {
  const eventScale = eventMarkerScaleForZoom(zoom);
  const userScale = markerScaleForZoom(zoom);

  return Math.max(18,
    EVENT_PIN_RADIUS_PX * eventScale +
    EVENT_USER_RADIUS_PX * userScale -
    EVENT_ORBIT_OVERLAP_PX
  );
}

function applyMarkerVisualScale(entries, zoom) {
  const scale = markerScaleForZoom(zoom);
  for (const entry of entries) {
    entry.element?.style.setProperty("--map-marker-scale", scale.toFixed(3));
  }
}

function applyEventMarkerVisibility(eventEntries, zoom) {
  const visible = zoom >= MIN_EVENT_VISIBLE_ZOOM;
  const scale = eventMarkerScaleForZoom(zoom);

  for (const entry of eventEntries) {
    entry.isVisible = visible;
    entry.element.classList.toggle("is-zoom-hidden", !visible);
    entry.element.setAttribute("aria-hidden", String(!visible));
    entry.element.style.pointerEvents = visible ? "auto" : "none";
    entry.element.style.setProperty(
      "--map-marker-scale",
      visible ? scale.toFixed(3) : "0"
    );
  }
}

function eventMarkerKey(event) {
  return String(event.code || event.id || `${event.longitude},${event.latitude}`);
}

function eventSignature(event) {
  return [
    event.title,
    event.latitude,
    event.longitude,
    event.pin_type,
    event.participant_count,
    event.capacity,
    event.image_url,
    event.visibility,
    event.start_time,
    event.description,
    (event.participant_user_ids || []).join(","),
  ].join("|");
}

function createEventAttendeeBadge(entry) {
  const badge = document.createElement("span");
  badge.className = [
    "event-map-marker__attendee",
    entry.isCurrent ? "is-current" : "",
  ].filter(Boolean).join(" ");
  badge.title = entry.isOverflow
    ? `Ще ${entry.overflowCount} учасників`
    : entry.isCurrent
      ? "Ви"
      : entry.user?.name || "Учасник";

  if (entry.isOverflow) {
    badge.classList.add("is-overflow");
    badge.textContent = `+${entry.overflowCount}`;
  } else if (entry.user?.photo_url) {
    const image = document.createElement("img");
    image.src = entry.user.photo_url;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.onerror = () => {
      image.remove();
      badge.textContent = initials(entry.user?.name);
    };
    badge.appendChild(image);
  } else {
    badge.textContent = initials(entry.user?.name);
  }

  return badge;
}

function syncEventOrbit(eventEntry, matchingUsers, offsets, userScale) {
  const orbitElement = eventEntry.orbitElement;
  if (!orbitElement) return;

  const signature = matchingUsers
    .map((entry) => entry.isOverflow
      ? `overflow:${entry.overflowCount}`
      : `${entry.userId}:${entry.user?.photo_url || ""}:${entry.user?.name || ""}:${entry.isCurrent}`)
    .join("|");

  if (eventEntry.orbitSignature !== signature) {
    orbitElement.replaceChildren(...matchingUsers.map(createEventAttendeeBadge));
    eventEntry.orbitSignature = signature;
  }

  orbitElement.hidden = matchingUsers.length === 0;
  Array.from(orbitElement.children).forEach((badge, index) => {
    const [x, y] = offsets[index] || [0, 0];
    badge.style.setProperty("--event-attendee-x", `${x}px`);
    badge.style.setProperty("--event-attendee-y", `${y}px`);
    badge.style.setProperty("--event-attendee-scale", userScale.toFixed(3));
  });
}

function layoutEventUserGroups(eventEntries, userEntries, zoom) {
  const usersHiddenByAnEvent = new Set();
  const orbitRadius = eventOrbitRadiusForZoom(zoom);
  const userScale = markerScaleForZoom(zoom);

  for (const eventEntry of eventEntries) {
    if (eventEntry.isVisible === false) {
      syncEventOrbit(eventEntry, [], [], userScale);
      continue;
    }

    const eventLngLat = eventEntry.marker.getLngLat();
    const eventCoords = [eventLngLat.lng, eventLngLat.lat];
    const participantIds = new Set(
      (eventEntry.event?.participant_user_ids || []).map(Number).filter(Number.isFinite)
    );

    const usersAtEvent = prioritizeEventOrbitUsers(
      userEntries.filter((entry) => {
        if (!Number.isFinite(entry.userId) || !participantIds.has(entry.userId) || !entry.realLngLat) return false;
        return isWithinEventGeofence(eventCoords, entry.realLngLat, entry.user?.accuracy);
      })
    );

    const visibleBadges = limitEventOrbitUsers(usersAtEvent, MAX_EVENT_ORBIT_USERS);
    syncEventOrbit(
      eventEntry,
      visibleBadges,
      getEventOrbitPatternOffsets(visibleBadges.length, orbitRadius),
      userScale
    );
    usersAtEvent.forEach((entry) => {
      entry.element?.classList.add("is-event-member-hidden");
      usersHiddenByAnEvent.add(entry);
    });
  }

  return usersHiddenByAnEvent;
}

function eventImageHtml(event) {
  if (!event.image_url) return "";
  return `<div class="map-selection-card__media"><img src="${escapeHtml(event.image_url)}" alt=""></div>`;
}


function createEventMarker(event, onOpenEvent, onJoinEvent, canJoinNearby) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "event-map-marker";
  element.setAttribute("aria-label", event.title);

  const supportedPinTypes = [
    "default",
    "football",
    "basketball",
    "volleyball",
    "tennis",
    "pingpong",
    "ticket",
    "eightball",
    "beer",
    "popcorn",
  ];
  const pinType = supportedPinTypes.includes(event.pin_type) ? event.pin_type : "default";
  const imageHtml = pinType === "default" && event.image_url
    ? `<img class="sport-pin__image" src="${escapeHtml(event.image_url)}" alt="">`
    : "";
  const capacityHtml = event.capacity
    ? `<span class="sport-pin__capacity">${escapeHtml(`${event.participant_count || 0}/${event.capacity}`)}</span>`
    : "";

  element.innerHTML = `<span class="event-map-marker__visual"><span class="sport-pin sport-pin--${pinType}">${imageHtml}<span class="sport-pin__seams"></span>${capacityHtml}</span></span><span class="event-map-marker__orbit" aria-hidden="true" hidden></span>`;

  const popup = new maplibregl.Popup({
    offset: 24,
    maxWidth: "340px",
    className: "bambini-map-popup",
  }).setHTML(
    `<article class="map-selection-card map-selection-card--event">
      ${eventImageHtml(event)}
      <div class="map-selection-card__body">
        <div class="map-selection-card__badges">
          <span>${escapeHtml(eventVisibilityLabel(event.visibility))}</span>
          <span>${escapeHtml(formatEventDateTime(event.start_time))}</span>
          ${event.capacity ? `<span>${event.participant_count || 0}/${event.capacity} учасників</span>` : ""}
        </div>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.description || "Без опису")}</p>
        <button class="map-selection-card__action" type="button" data-open-event="${escapeHtml(event.code)}">Відкрити подію ${iconSvgMarkup("arrow-right")}</button>
        ${canJoinNearby ? `<button class="map-selection-card__action" type="button" data-join-event="${escapeHtml(event.code)}">Приєднатися поруч ${iconSvgMarkup("plus")}</button>` : ""}
      </div>
    </article>`
  );

  const lngLat = normalizeLngLat(event);
  if (!lngLat) return null;

  const handlePopupOpen = () => {
    decoratePopupCloseButton(popup);
    const action = popup.getElement()?.querySelector("[data-open-event]");
    if (action) {
      action.onclick = () => onOpenEvent?.(event.code);
    }
    const joinAction = popup.getElement()?.querySelector("[data-join-event]");
    if (joinAction) {
      joinAction.onclick = async () => {
        joinAction.disabled = true;
        joinAction.textContent = "Приєднання...";
        try {
          await onJoinEvent?.(event);
          joinAction.textContent = "Приєднано";
        } catch (error) {
          joinAction.disabled = false;
          joinAction.textContent = error?.message || "Не вдалося приєднатися";
        }
      };
    }
  };
  popup.on("open", handlePopupOpen);
  const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(lngLat).setPopup(popup);

  return {
    marker,
    element,
    orbitElement: element.querySelector(".event-map-marker__orbit"),
    event,
    kind: "event",
    isCurrent: false,
    cleanupPopup: () => popup.off("open", handlePopupOpen),
  };
}

function createUserMarkerElement(user, isCurrent) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = [
    "map-user-marker",
    isCurrent ? "is-current" : "is-friend",
    user.presence ? `is-${user.presence}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  element.setAttribute("aria-label", isCurrent ? "Моя позиція" : user.name);

  const avatar = document.createElement("span");
  avatar.className = "map-user-marker__avatar";

  if (user.photo_url) {
    const image = document.createElement("img");
    image.src = user.photo_url;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.onerror = () => {
      image.remove();
      avatar.textContent = initials(user.name);
    };
    avatar.appendChild(image);
  } else {
    avatar.textContent = initials(user.name);
  }

  const pulseOne = document.createElement("span");
  pulseOne.className = "map-user-marker__pulse pulse-one";
  const pulseTwo = document.createElement("span");
  pulseTwo.className = "map-user-marker__pulse pulse-two";
  const label = document.createElement("span");
  label.className = "map-user-marker__label";
  label.textContent = isCurrent ? "Ви" : user.name;

  const visual = document.createElement("span");
  visual.className = "map-user-marker__visual";
  visual.append(pulseOne, pulseTwo, avatar, label);
  element.appendChild(visual);
  return element;
}

function userSignature(user, isCurrent) {
  return [
    user.name,
    user.photo_url || "",
    user.presence || "",
    user.age_seconds || 0,
    user.updated_at || "",
    user.friend_code || "",
    user.friendship_status || "",
    user.orca_skin || "",
    user.header_style || "",
    user.bottom_style || "",
    user.background_style || "",
    isCurrent,
  ].join("|");
}

export default function MapLibreMap({
  eventPins = [],
  enableLocation = true,
  currentUser = null,
  currentLocation = null,
  friendLocations = [],
  onLocationFound,
  onJoinEvent,
  onAddFriend,
  autoCenterOnUser = false,
  className = "",
}) {
  const navigate = useNavigate();
  const openEvent = useCallback((code) => navigate(`/room/${code}`), [navigate]);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const eventMarkersRef = useRef([]);
  const eventMarkersByKeyRef = useRef(new Map());
  const userMarkersRef = useRef(new Map());
  const layoutFrameRef = useRef(null);
  const hasAutoCenteredOnUserRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [locationError, setLocationError] = useState("");

  const layoutMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();
    const eventEntries = eventMarkersRef.current;
    const userEntries = Array.from(userMarkersRef.current.values());

    applyEventMarkerVisibility(eventEntries, zoom);
    applyMarkerVisualScale(userEntries, zoom);

    // Nearby participants are represented by compact avatars anchored to the
    // event marker. Their real map markers return at their GPS coordinates as
    // soon as they leave the event geofence.
    userEntries.forEach((entry) => {
      entry.element?.classList.remove("is-event-member-hidden");
    });
    layoutEventUserGroups(eventEntries, userEntries, zoom);
  }, []);

  const scheduleMarkerLayout = useCallback(() => {
    if (layoutFrameRef.current !== null) {
      cancelAnimationFrame(layoutFrameRef.current);
    }
    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = null;
      layoutMarkers();
    });
  }, [layoutMarkers]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const savedView = loadSavedMapView();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center:
        eventPins.length === 1
          ? [
              Number(eventPins[0].longitude),
              Number(eventPins[0].latitude),
            ]
          : savedView?.center || DEFAULT_CENTER,
      zoom: eventPins.length === 1 ? Math.max(15, savedView?.zoom ?? DEFAULT_ZOOM) : (savedView?.zoom ?? DEFAULT_ZOOM),
      bearing: 0,
      pitch: 0,
      attributionControl: true,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxPitch: 0,
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
    });

    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    const applyCurrentTheme = () => applyMapThemeStyle(map);
    map.on("load", () => {
      applyCurrentTheme();
      map.resize();
      setMapReady(true);
    });

    const themeObserver = new MutationObserver(() => {
      if (map.isStyleLoaded()) applyCurrentTheme();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const persistView = () => saveMapView(map);
    map.on("moveend", persistView);
    map.on("zoom", scheduleMarkerLayout);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      eventMarkersRef.current.forEach((entry) => {
        entry.destroy?.();
        entry.marker.remove();
      });
      eventMarkersByKeyRef.current.clear();
      userMarkersRef.current.forEach((entry) => {
        entry.destroy?.();
        entry.marker.remove();
      });
      userMarkersRef.current.clear();
      saveMapView(map);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      map.off("moveend", persistView);
      map.off("zoom", scheduleMarkerLayout);
      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [scheduleMarkerLayout]);

  useEffect(() => {
    const map = mapRef.current;
    const currentLngLat = normalizeLngLat(currentLocation);
    if (!autoCenterOnUser || !map || !mapReady || !currentLngLat || hasAutoCenteredOnUserRef.current) return;
    hasAutoCenteredOnUserRef.current = true;
    map.flyTo({
      center: currentLngLat,
      zoom: Math.min(MAX_ZOOM, Math.max(map.getZoom(), 15)),
      duration: 900,
    });
  }, [autoCenterOnUser, currentLocation, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const nextEvents = new Map();
    const currentCoords = normalizeLngLat(currentLocation);
    const currentUserId = Number(currentUser?.id);
    for (const event of eventPins) {
      const key = eventMarkerKey(event);
      const eventCoords = normalizeLngLat(event);
      const isParticipant = (event.participant_user_ids || []).map(Number).includes(currentUserId);
      const canJoinNearby = Boolean(
        onJoinEvent &&
        event.visibility === "public" &&
        !isParticipant &&
        eventCoords &&
        currentCoords &&
        isWithinEventGeofence(eventCoords, currentCoords, currentLocation?.accuracy)
      );
      nextEvents.set(key, {
        event,
        canJoinNearby,
        signature: `${eventSignature(event)}|nearby:${canJoinNearby}`,
      });
    }

    for (const [key, entry] of eventMarkersByKeyRef.current.entries()) {
      if (!nextEvents.has(key)) {
        entry.destroy?.();
        entry.marker.remove();
        eventMarkersByKeyRef.current.delete(key);
      }
    }

    for (const [key, { event, signature, canJoinNearby }] of nextEvents.entries()) {
      let entry = eventMarkersByKeyRef.current.get(key);

      if (!entry || entry.signature !== signature) {
        entry?.destroy?.();
        entry?.marker.remove();
        const created = createEventMarker(event, openEvent, onJoinEvent, canJoinNearby);
        if (!created) continue;

        created.marker.addTo(map);
        created.destroy = () => {
          created.cleanupPopup?.();
        };
        created.signature = signature;
        created.key = key;
        entry = created;
        eventMarkersByKeyRef.current.set(key, entry);
      }
    }

    eventMarkersRef.current = Array.from(eventMarkersByKeyRef.current.values());
    scheduleMarkerLayout();
  }, [currentLocation, currentUser, eventPins, mapReady, onJoinEvent, openEvent, scheduleMarkerLayout]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const visibleUsers = [];
    if (currentUser && currentLocation) {
      visibleUsers.push({
        key: `me:${currentUser.id}`,
        isCurrent: true,
        user: {
          ...currentUser,
          ...currentLocation,
          presence: "online",
        },
      });
    }

    for (const friend of friendLocations) {
      visibleUsers.push({
        key: `user:${friend.user_id}`,
        isCurrent: false,
        user: friend,
      });
    }

    const nextKeys = new Set(visibleUsers.map((item) => item.key));
    for (const [key, entry] of userMarkersRef.current.entries()) {
      if (!nextKeys.has(key)) {
        entry.destroy?.();
        entry.marker.remove();
        userMarkersRef.current.delete(key);
      }
    }

    for (const item of visibleUsers) {
      const signature = userSignature(item.user, item.isCurrent);
      let entry = userMarkersRef.current.get(item.key);

      if (!entry || entry.signature !== signature) {
        entry?.destroy?.();
        entry?.marker.remove();
        const element = createUserMarkerElement(item.user, item.isCurrent);
        const displayName = item.isCurrent ? "Ви" : item.user.name;
        const statusText = item.isCurrent
          ? "Ваша поточна позиція"
          : item.user.presence === "online"
            ? "На карті зараз"
            : `Оновлено ${item.user.age_seconds || 0} с тому`;
        const mascotHtml = mascotPreviewHtml(item.user);
        const friendActionHtml = item.isCurrent
          ? ""
          : item.user.friendship_status === "accepted"
            ? `<span class="map-person-card__relationship">У друзях</span>`
            : item.user.friendship_status === "pending"
              ? `<button class="map-selection-card__action" type="button" disabled>Запит уже надіслано</button>`
              : onAddFriend && item.user.friend_code
                ? `<button class="map-selection-card__action" type="button" data-add-friend>Додати в друзі ${iconSvgMarkup("plus")}</button>`
                : "";
        const popup = new maplibregl.Popup({
          offset: 34,
          maxWidth: "320px",
          className: "bambini-map-popup",
        }).setHTML(
          `<article class="map-selection-card map-selection-card--person">
            ${mascotHtml}
            <div class="map-person-card__content">
              <div class="map-person-card__status"><span class="is-${escapeHtml(item.user.presence || "online")}"></span>${escapeHtml(statusText)}</div>
              <h3>${escapeHtml(displayName)}</h3>
              <p>${item.isCurrent ? "Це ви на карті" : "Користувач ділиться своєю актуальною геолокацією"}</p>
              ${friendActionHtml}
            </div>
          </article>`
        );
        const handlePopupOpen = () => {
          decoratePopupCloseButton(popup);
          const action = popup.getElement()?.querySelector("[data-add-friend]");
          if (!action) return;
          action.onclick = async () => {
            action.disabled = true;
            action.textContent = "Надсилання...";
            try {
              await onAddFriend?.(item.user);
              action.textContent = "Запит надіслано";
            } catch (error) {
              action.disabled = false;
              action.textContent = error?.message || "Не вдалося додати";
            }
          };
        };
        popup.on("open", handlePopupOpen);
        const lngLat = normalizeLngLat(item.user);
        if (!lngLat) continue;

        const marker = new maplibregl.Marker({
          element,
          anchor: "center",
          subpixelPositioning: true,
        })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);
        entry = {
          marker,
          element,
          signature,
          kind: "user",
          isCurrent: item.isCurrent,
          userId: Number(item.isCurrent ? currentUser?.id : item.user.user_id),
          user: item.user,
          realLngLat: lngLat,
          destroy: () => popup.off("open", handlePopupOpen),
        };
        userMarkersRef.current.set(item.key, entry);
      } else {
        const lngLat = normalizeLngLat(item.user);
        if (lngLat) {
          entry.realLngLat = lngLat;
          entry.marker.setLngLat(lngLat);
        }
        entry.userId = Number(item.isCurrent ? currentUser?.id : item.user.user_id);
        entry.user = item.user;
      }
    }

    scheduleMarkerLayout();
  }, [currentLocation, currentUser, friendLocations, mapReady, onAddFriend, scheduleMarkerLayout]);

  function locateUser() {
    setLocationError("");
    const map = mapRef.current;
    if (!map) return;

    const currentLngLat = normalizeLngLat(currentLocation);
    if (currentLngLat) {
      map.flyTo({
        center: currentLngLat,
        zoom: Math.min(MAX_ZOOM, Math.max(map.getZoom(), 15)),
        duration: 900,
      });
      return;
    }

    // On a LAN HTTP URL the browser blocks Geolocation. The status card in
    // MapPage already explains that HTTPS is required, so do not show a second
    // duplicate error toast when the locate button is pressed.
    if (!window.isSecureContext) return;

    if (!navigator.geolocation) {
      setLocationError("Геолокація не підтримується цим браузером.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          accuracy: position.coords.accuracy,
          updated_at: new Date().toISOString(),
        };
        onLocationFound?.(location, true);
        map.flyTo({ center: [location.longitude, location.latitude], zoom: Math.min(MAX_ZOOM, 15), duration: 900 });
      },
      () => setLocationError("Не вдалося отримати геолокацію. Перевірте дозвіл браузера."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className={`maplibre-shell ${className}`}>
      <div ref={containerRef} className="maplibre-map" />

      {enableLocation && (
        <button
          className="map-fab map-fab--location"
          type="button"
          onClick={locateUser}
          aria-label="Показати мою геолокацію"
          title="Моя геолокація"
        >
          <AppIcon name="locate" />
        </button>
      )}

      {locationError && <div className="map-toast">{locationError}</div>}
    </div>
  );
}
