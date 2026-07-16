import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

const DEFAULT_CENTER = [24.7111, 48.9226];
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const MIN_ZOOM = 1;
const MAX_ZOOM = 21;

function hidePlaceLabels(map) {
  const layers = map.getStyle()?.layers || [];

  for (const layer of layers) {
    if (layer.type !== "symbol") continue;

    const id = String(layer.id || "").toLowerCase();
    const sourceLayer = String(layer["source-layer"] || "").toLowerCase();
    const key = `${id} ${sourceLayer}`;

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

    if (!isPlaceLabel) continue;

    try {
      map.setLayoutProperty(layer.id, "visibility", "none");
    } catch {
      // Ignore style-specific layers.
    }
  }
}

export default function EventLocationPicker({ value, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: value ? [value.longitude, value.latitude] : DEFAULT_CENTER,
      zoom: value ? 15 : 12,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => hidePlaceLabels(map));

    function setPoint(lngLat) {
      markerRef.current?.remove();
      const element = document.createElement("div");
      element.className = "event-location-marker";
      markerRef.current = new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat(lngLat)
        .addTo(map);
      onChange({ latitude: lngLat.lat, longitude: lngLat.lng });
    }

    map.on("click", (event) => setPoint(event.lngLat));
    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;

    const lngLat = { lng: value.longitude, lat: value.latitude };
    if (!markerRef.current) {
      const element = document.createElement("div");
      element.className = "event-location-marker";
      markerRef.current = new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
    }
  }, [value]);

  function useCurrentLocation() {
    setError("");
    if (!window.isSecureContext) {
      setError("Геолокація працює лише через HTTPS або localhost.");
      return;
    }
    if (!navigator.geolocation) {
      setError("Цей браузер не підтримує геолокацію.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        onChange(next);
        setLocating(false);
        mapRef.current?.flyTo({
          center: [next.longitude, next.latitude],
          zoom: Math.min(MAX_ZOOM, 16),
          duration: 700,
        });
      },
      (geoError) => {
        setLocating(false);
        if (geoError.code === 1) setError("Доступ до геолокації заборонено в браузері.");
        else if (geoError.code === 2) setError("Телефон не зміг визначити позицію.");
        else setError("Час очікування геолокації вичерпано.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="event-location-picker-wrap">
      <div ref={containerRef} className="event-location-picker" />
      <button className="event-location-use-me" type="button" onClick={useCurrentLocation} disabled={locating}>
        {locating ? "Визначення..." : "Використати мою позицію"}
      </button>
      {error && <p className="event-location-error" role="alert">{error}</p>}
    </div>
  );
}
