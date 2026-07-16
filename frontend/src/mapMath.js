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
