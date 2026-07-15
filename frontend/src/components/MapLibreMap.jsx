import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

const DEFAULT_CENTER = [24.7111, 48.9226];
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const MAP_VIEW_STORAGE_KEY = "bambini:map:view:v2";
const MIN_ZOOM = 1;
const MAX_ZOOM = 21;
const DEFAULT_ZOOM = 13;
const MARKER_COLLISION_DISTANCE = 62;

function loadSavedMapView() {
  try {
    const saved = JSON.parse(localStorage.getItem(MAP_VIEW_STORAGE_KEY) || "null");
    const longitude = Number(saved?.longitude);
    const latitude = Number(saved?.latitude);
    const zoom = Number(saved?.zoom);
    const bearing = Number(saved?.bearing ?? 0);
    const pitch = Number(saved?.pitch ?? 0);

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
      bearing: Number.isFinite(bearing) ? bearing : 0,
      pitch: Number.isFinite(pitch) ? Math.min(70, Math.max(0, pitch)) : 0,
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
        bearing: map.getBearing(),
        pitch: map.getPitch(),
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

function applyBleakStyle(map) {
  const layers = map.getStyle()?.layers || [];

  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    const sourceLayer = String(layer["source-layer"] || "").toLowerCase();
    const key = `${id} ${sourceLayer}`;

    // Keep the base OpenFreeMap dark style intact. Repainting every fill layer
    // after the style loads caused the whole map to visibly turn almost black
    // about a second after entering /map.
    if (layer.type === "fill") {
      if (key.includes("water")) {
        safeSetPaint(map, layer.id, "fill-color", "#101820");
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
        safeSetPaint(map, layer.id, "line-color", major ? "#e3e7ea" : "#9ca4ab");
        safeSetPaint(map, layer.id, "line-opacity", major ? 0.94 : 0.8);
      } else if (key.includes("boundary")) {
        safeSetPaint(map, layer.id, "line-color", "#555d65");
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

      safeSetPaint(map, layer.id, "text-color", "#b8c0c7");
      safeSetPaint(map, layer.id, "text-halo-color", "#0a0d10");
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

function applyMarkerVisualScale(entries, zoom) {
  const scale = markerScaleForZoom(zoom);
  for (const entry of entries) {
    entry.element?.style.setProperty("--map-marker-scale", scale.toFixed(3));
  }
}

function declutterMarkers(map, entries) {
  if (!map || entries.length < 2) {
    entries.forEach((entry) => entry.marker.setOffset([0, 0]));
    return;
  }

  entries.forEach((entry) => entry.marker.setOffset([0, 0]));

  const projected = entries
    .map((entry) => ({
      ...entry,
      point: map.project(entry.marker.getLngLat()),
    }))
    .sort((a, b) => {
      const priorityA = a.isCurrent ? 0 : a.kind === "user" ? 1 : 2;
      const priorityB = b.isCurrent ? 0 : b.kind === "user" ? 1 : 2;
      return priorityA - priorityB;
    });

  const groups = [];
  for (const item of projected) {
    let target = null;
    for (const group of groups) {
      const dx = item.point.x - group.center.x;
      const dy = item.point.y - group.center.y;
      if (Math.hypot(dx, dy) < MARKER_COLLISION_DISTANCE) {
        target = group;
        break;
      }
    }

    if (!target) {
      groups.push({ center: item.point, items: [item] });
      continue;
    }

    target.items.push(item);
    const count = target.items.length;
    target.center = {
      x: target.items.reduce((sum, current) => sum + current.point.x, 0) / count,
      y: target.items.reduce((sum, current) => sum + current.point.y, 0) / count,
    };
  }

  for (const group of groups) {
    if (group.items.length < 2) continue;

    const currentIndex = group.items.findIndex((item) => item.isCurrent);
    const centered = currentIndex >= 0
      ? group.items.splice(currentIndex, 1)[0]
      : group.items.shift();

    centered.marker.setOffset([0, 0]);

    const count = group.items.length;
    const radius = Math.min(56, 28 + count * 6);
    group.items.forEach((item, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(count, 1);
      item.marker.setOffset([
        Math.round(Math.cos(angle) * radius),
        Math.round(Math.sin(angle) * radius),
      ]);
    });
  }
}

function eventImageHtml(event) {
  if (!event.image_url) return "";
  return `<div class="map-selection-card__media"><img src="${escapeHtml(event.image_url)}" alt=""></div>`;
}


function createEventMarker(event) {
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

  element.innerHTML = `<span class="sport-pin sport-pin--${pinType}">${imageHtml}<span class="sport-pin__seams"></span>${capacityHtml}</span>`;

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
        <a class="map-selection-card__action" href="/room/${event.code}">Відкрити подію <span>→</span></a>
      </div>
    </article>`
  );

  const lngLat = normalizeLngLat(event);
  if (!lngLat) return null;

  const marker = new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat(lngLat)
    .setPopup(popup);

  return { marker, element, kind: "event", isCurrent: false };
}

function createCheckpointMarker(checkpoint) {
  const element = document.createElement("button");
  element.className = "checkpoint-marker";
  element.type = "button";
  element.setAttribute("aria-label", checkpoint.title);
  element.innerHTML = `<span>${checkpoint.order_index || "•"}</span>`;

  const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
    `<div class="map-popup"><strong>${escapeHtml(checkpoint.title)}</strong>${
      checkpoint.description ? `<p>${escapeHtml(checkpoint.description)}</p>` : ""
    }</div>`
  );

  const lngLat = normalizeLngLat(checkpoint);
  if (!lngLat) return null;

  return new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat(lngLat)
    .setPopup(popup);
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
  return [user.name, user.photo_url || "", user.presence || "", isCurrent].join("|");
}

export default function MapLibreMap({
  checkpoints = [],
  eventPins = [],
  canEdit = false,
  onCreateCheckpoint,
  enableLocation = true,
  currentUser = null,
  currentLocation = null,
  friendLocations = [],
  onLocationFound,
  className = "",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const checkpointMarkersRef = useRef([]);
  const eventMarkersRef = useRef([]);
  const selectionMarkerRef = useRef(null);
  const userMarkersRef = useRef(new Map());
  const layoutFrameRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationError, setLocationError] = useState("");

  const layoutMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const eventEntries = eventMarkersRef.current;
    const userEntries = Array.from(userMarkersRef.current.values());

    applyMarkerVisualScale([...eventEntries, ...userEntries], map.getZoom());

    // Event markers must stay exactly on their geographic coordinates while zooming.
    // Collision offsets are therefore applied only to people markers.
    eventEntries.forEach((entry) => entry.marker.setOffset([0, 0]));
    declutterMarkers(map, userEntries);
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
      zoom: savedView?.zoom ?? DEFAULT_ZOOM,
      bearing: savedView?.bearing ?? 0,
      pitch: savedView?.pitch ?? 0,
      attributionControl: true,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxPitch: 70,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }),
      "top-right"
    );

    map.on("load", () => {
      applyBleakStyle(map);
      map.resize();
      setMapReady(true);
    });

    const persistView = () => saveMapView(map);
    map.on("moveend", persistView);
    map.on("rotateend", persistView);
    map.on("pitchend", persistView);
    map.on("zoom", scheduleMarkerLayout);
    map.on("move", scheduleMarkerLayout);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      checkpointMarkersRef.current.forEach((marker) => marker.remove());
      eventMarkersRef.current.forEach((entry) => entry.marker.remove());
      userMarkersRef.current.forEach((entry) => entry.marker.remove());
      userMarkersRef.current.clear();
      selectionMarkerRef.current?.remove();
      saveMapView(map);
      resizeObserver.disconnect();
      map.off("moveend", persistView);
      map.off("rotateend", persistView);
      map.off("pitchend", persistView);
      map.off("zoom", scheduleMarkerLayout);
      map.off("move", scheduleMarkerLayout);
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
    if (!map || !mapReady) return;

    checkpointMarkersRef.current.forEach((marker) => marker.remove());
    checkpointMarkersRef.current = checkpoints
      .map((checkpoint) => createCheckpointMarker(checkpoint))
      .filter(Boolean);
    checkpointMarkersRef.current.forEach((marker) => marker.addTo(map));
  }, [checkpoints, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    eventMarkersRef.current.forEach((entry) => entry.marker.remove());

    eventMarkersRef.current = eventPins
      .map((event) => createEventMarker(event))
      .filter(Boolean);

    eventMarkersRef.current.forEach((entry) => entry.marker.addTo(map));
    scheduleMarkerLayout();

    // Якщо відкрита одна подія — перемістити карту на неї
    if (eventPins.length === 1) {
      const event = eventPins[0];

      if (
        Number.isFinite(Number(event.longitude)) &&
        Number.isFinite(Number(event.latitude))
      ) {
        map.flyTo({
          center: [Number(event.longitude), Number(event.latitude)],
          zoom: 16,
          duration: 800,
        });
      }
    }
  }, [eventPins, mapReady, scheduleMarkerLayout]);

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
        key: `friend:${friend.user_id}`,
        isCurrent: false,
        user: friend,
      });
    }

    const nextKeys = new Set(visibleUsers.map((item) => item.key));
    for (const [key, entry] of userMarkersRef.current.entries()) {
      if (!nextKeys.has(key)) {
        entry.marker.remove();
        userMarkersRef.current.delete(key);
      }
    }

    for (const item of visibleUsers) {
      const signature = userSignature(item.user, item.isCurrent);
      let entry = userMarkersRef.current.get(item.key);

      if (!entry || entry.signature !== signature) {
        entry?.marker.remove();
        const element = createUserMarkerElement(item.user, item.isCurrent);
        const displayName = item.isCurrent ? "Ви" : item.user.name;
        const statusText = item.isCurrent
          ? "Ваша поточна позиція"
          : item.user.presence === "online"
            ? "На карті зараз"
            : `Оновлено ${item.user.age_seconds || 0} с тому`;
        const avatarHtml = item.user.photo_url
          ? `<img src="${escapeHtml(item.user.photo_url)}" alt="">`
          : `<span>${escapeHtml(initials(item.user.name))}</span>`;
        const popup = new maplibregl.Popup({
          offset: 34,
          maxWidth: "320px",
          className: "bambini-map-popup",
        }).setHTML(
          `<article class="map-selection-card map-selection-card--person">
            <div class="map-person-card__avatar">${avatarHtml}</div>
            <div class="map-person-card__content">
              <div class="map-person-card__status"><span class="is-${escapeHtml(item.user.presence || "online")}"></span>${escapeHtml(statusText)}</div>
              <h3>${escapeHtml(displayName)}</h3>
              <p>${item.isCurrent ? "Це ви на карті" : "Користувач ділиться своєю актуальною геолокацією"}</p>
            </div>
          </article>`
        );
        const lngLat = normalizeLngLat(item.user);
        if (!lngLat) continue;

        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);
        entry = {
          marker,
          element,
          signature,
          kind: "user",
          isCurrent: item.isCurrent,
        };
        userMarkersRef.current.set(item.key, entry);
      } else {
        const lngLat = normalizeLngLat(item.user);
        if (lngLat) entry.marker.setLngLat(lngLat);
      }
    }

    scheduleMarkerLayout();
  }, [currentLocation, currentUser, friendLocations, mapReady, scheduleMarkerLayout]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !canEdit || !onCreateCheckpoint) return undefined;

    function handleMapClick(event) {
      selectionMarkerRef.current?.remove();
      const element = document.createElement("button");
      element.className = "checkpoint-marker checkpoint-marker--new";
      element.type = "button";
      element.innerHTML = "<span>+</span>";

      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat(event.lngLat)
        .addTo(map);
      selectionMarkerRef.current = marker;

      const title = window.prompt("Назва контрольної точки:");
      if (!title?.trim()) {
        marker.remove();
        selectionMarkerRef.current = null;
        return;
      }

      Promise.resolve(
        onCreateCheckpoint({
          title: title.trim(),
          description: "",
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
          order_index: checkpoints.length + 1,
        })
      ).finally(() => {
        marker.remove();
        selectionMarkerRef.current = null;
      });
    }

    map.on("click", handleMapClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", handleMapClick);
      map.getCanvas().style.cursor = "";
    };
  }, [canEdit, checkpoints.length, mapReady, onCreateCheckpoint]);

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
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="7" />
          </svg>
        </button>
      )}

      {locationError && <div className="map-toast">{locationError}</div>}
    </div>
  );
}
