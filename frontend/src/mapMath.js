export const EVENT_LOCATION_BASE_METERS = 40;
export const EVENT_LOCATION_MIN_EFFECTIVE_METERS = 75;
export const EVENT_LOCATION_MAX_ACCURACY_METERS = 100;

export function haversineMeters(lngLatA, lngLatB) {
  const earthRadius = 6371000;
  const lat1 = (lngLatA[1] * Math.PI) / 180;
  const lat2 = (lngLatB[1] * Math.PI) / 180;
  const dLat = ((lngLatB[1] - lngLatA[1]) * Math.PI) / 180;
  const dLng = ((lngLatB[0] - lngLatA[0]) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function coordinatesFrom(value) {
  const rawLongitude = value?.longitude ?? value?.lng;
  const rawLatitude = value?.latitude ?? value?.lat;
  if (rawLongitude == null || rawLatitude == null) return null;
  const longitude = Number(rawLongitude);
  const latitude = Number(rawLatitude);
  if (
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90
  ) return null;
  return [longitude, latitude];
}

export function distanceToEventMeters(event, userLocation) {
  const eventCoordinates = coordinatesFrom(event);
  const userCoordinates = coordinatesFrom(userLocation);
  if (!eventCoordinates || !userCoordinates) return null;
  return haversineMeters(userCoordinates, eventCoordinates);
}

export function eventsWithDistance(events, userLocation) {
  return (Array.isArray(events) ? events : [])
    .map((event, originalIndex) => ({
      event,
      originalIndex,
      distanceMeters: distanceToEventMeters(event, userLocation),
    }))
    .sort((left, right) => {
      const leftKnown = Number.isFinite(left.distanceMeters);
      const rightKnown = Number.isFinite(right.distanceMeters);
      if (leftKnown && rightKnown) return left.distanceMeters - right.distanceMeters || left.originalIndex - right.originalIndex;
      if (leftKnown) return -1;
      if (rightKnown) return 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ event, distanceMeters }) => ({ event, distanceMeters }));
}

export function formatEventDistance(distanceMeters) {
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance) || distance < 0) return "";
  if (distance < 1000) {
    const roundedMeters = distance < 100 ? Math.round(distance) : Math.round(distance / 10) * 10;
    return `${roundedMeters} м`;
  }
  const kilometers = distance / 1000;
  if (kilometers >= 10) return `${Math.round(kilometers)} км`;
  const roundedKilometers = Math.round(kilometers * 10) / 10;
  return `${String(roundedKilometers).replace(".", ",")} км`;
}

export function isWithinEventGeofence(eventCoords, userCoords, accuracy = 0) {
  const safeAccuracy = Math.min(Math.max(Number(accuracy) || 0, 0), EVENT_LOCATION_MAX_ACCURACY_METERS);
  const allowed = Math.max(EVENT_LOCATION_MIN_EFFECTIVE_METERS, EVENT_LOCATION_BASE_METERS + safeAccuracy);
  return haversineMeters(eventCoords, userCoords) <= allowed;
}

export function getEventOrbitPatternOffsets(count, radius) {
  if (count <= 0) return [];
  if (count === 1) return [[0, Math.round(-radius)]];
  if (count === 2) return [[Math.round(-radius), 0], [Math.round(radius), 0]];
  const startAngle = count === 4 ? -Math.PI / 4 : -Math.PI / 2;
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (Math.PI * 2 * index) / count;
    return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)];
  });
}

export function limitEventOrbitUsers(users, maxUsers = 8) {
  const safeMax = Math.max(1, Math.trunc(Number(maxUsers) || 8));
  if (users.length <= safeMax) return [...users];
  const visiblePeople = users.slice(0, safeMax - 1);
  return [
    ...visiblePeople,
    { isOverflow: true, overflowCount: users.length - visiblePeople.length },
  ];
}
