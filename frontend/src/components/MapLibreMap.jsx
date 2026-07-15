import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

const DEFAULT_CENTER = [24.7111, 48.9226];
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const MAP_VIEW_STORAGE_KEY = "bambini:map:view:v1";
const DEFAULT_ZOOM = 13;

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
      zoom: Math.min(22, Math.max(0, zoom)),
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

    if (layer.type === "background") {
      safeSetPaint(map, layer.id, "background-color", "#050607");
      continue;
    }

    if (layer.type === "fill") {
      if (key.includes("water")) {
        safeSetPaint(map, layer.id, "fill-color", "#0a1117");
        safeSetPaint(map, layer.id, "fill-opacity", 0.98);
      } else if (key.includes("building")) {
        safeSetPaint(map, layer.id, "fill-color", "#171a1e");
        safeSetPaint(map, layer.id, "fill-outline-color", "#252a30");
      } else if (
        key.includes("park") ||
        key.includes("landcover") ||
        key.includes("landuse") ||
        key.includes("wood") ||
        key.includes("grass")
      ) {
        safeSetPaint(map, layer.id, "fill-color", "#101315");
        safeSetPaint(map, layer.id, "fill-opacity", 0.9);
      } else {
        safeSetPaint(map, layer.id, "fill-color", "#0c0e10");
      }
      continue;
    }

    if (layer.type === "fill-extrusion") {
      safeSetPaint(map, layer.id, "fill-extrusion-color", "#171a1e");
      safeSetPaint(map, layer.id, "fill-extrusion-opacity", 0.75);
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
        safeSetPaint(map, layer.id, "line-color", major ? "#e2e6e9" : "#899199");
        safeSetPaint(map, layer.id, "line-opacity", major ? 0.96 : 0.82);
      } else if (key.includes("boundary")) {
        safeSetPaint(map, layer.id, "line-color", "#555d65");
      } else if (key.includes("water")) {
        safeSetPaint(map, layer.id, "line-color", "#26333d");
      }
      continue;
    }

    if (layer.type === "symbol") {
      // Keep the map visually clean: remove geographic place labels such as
      // countries, regions, cities, suburbs and neighbourhoods. Road/street
      // labels stay visible because they come from transportation-name layers.
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

      safeSetPaint(map, layer.id, "text-color", "#aeb5bb");
      safeSetPaint(map, layer.id, "text-halo-color", "#07090b");
      safeSetPaint(map, layer.id, "text-halo-width", 1.25);
      safeSetPaint(map, layer.id, "icon-opacity", 0.72);
      continue;
    }

    if (layer.type === "hillshade") {
      safeSetPaint(map, layer.id, "hillshade-shadow-color", "#000000");
      safeSetPaint(map, layer.id, "hillshade-highlight-color", "#2b3034");
      safeSetPaint(map, layer.id, "hillshade-accent-color", "#15191d");
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


function createEventMarker(event) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "event-map-marker";
  element.setAttribute("aria-label", event.title);
  element.innerHTML = `<span class="event-map-marker__dot"></span>`;

  const popup = new maplibregl.Popup({ offset: 22 }).setHTML(
    `<div class="map-popup"><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(
      event.description || `Код: ${event.code}`
    )}</p><small>${event.is_public ? "Public" : "Private"}</small><br><a class="map-popup__link" href="/room/${event.code}">Відкрити подію</a></div>`
  );

  const lngLat = normalizeLngLat(event);
  if (!lngLat) return null;

  return new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat(lngLat)
    .setPopup(popup);
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

  element.append(pulseOne, pulseTwo, avatar, label);
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
  const [mapReady, setMapReady] = useState(false);
  const [locationError, setLocationError] = useState("");

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

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      checkpointMarkersRef.current.forEach((marker) => marker.remove());
      eventMarkersRef.current.forEach((marker) => marker.remove());
      userMarkersRef.current.forEach((entry) => entry.marker.remove());
      userMarkersRef.current.clear();
      selectionMarkerRef.current?.remove();
      saveMapView(map);
      resizeObserver.disconnect();
      map.off("moveend", persistView);
      map.off("rotateend", persistView);
      map.off("pitchend", persistView);
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

    eventMarkersRef.current.forEach((marker) => marker.remove());

    eventMarkersRef.current = eventPins
      .map((event) => createEventMarker(event))
      .filter(Boolean);

    eventMarkersRef.current.forEach((marker) => marker.addTo(map));

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
  }, [eventPins, mapReady]);

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
        const popup = new maplibregl.Popup({ offset: 28 }).setHTML(
          `<div class="map-popup"><strong>${escapeHtml(
            item.isCurrent ? "Ви" : item.user.name
          )}</strong><p>${
            item.isCurrent
              ? "Ваша поточна позиція"
              : item.user.presence === "online"
              ? "На карті зараз"
              : `Оновлено ${item.user.age_seconds || 0} с тому`
          }</p></div>`
        );
        const lngLat = normalizeLngLat(item.user);
        if (!lngLat) continue;

        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);
        entry = { marker, signature };
        userMarkersRef.current.set(item.key, entry);
      } else {
        const lngLat = normalizeLngLat(item.user);
        if (lngLat) entry.marker.setLngLat(lngLat);
      }
    }
  }, [currentLocation, currentUser, friendLocations, mapReady]);

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
        zoom: Math.max(map.getZoom(), 15),
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
        map.flyTo({ center: [location.longitude, location.latitude], zoom: 15, duration: 900 });
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
