export const MAP_EVENT_FILTER_OPTIONS = [
  { value: "none", label: "Немає", labelEn: "None" },
  { value: "mine", label: "Мої", labelEn: "Mine" },
  { value: "all", label: "Усі", labelEn: "All" },
];

export function normalizeMapEventFilter(value) {
  return MAP_EVENT_FILTER_OPTIONS.some((option) => option.value === value) ? value : "all";
}

export function filterMapEvents(events, filter, currentUserId) {
  const safeEvents = Array.isArray(events) ? events : [];
  if (filter === "none") return [];
  if (filter !== "mine") return safeEvents;

  const userId = Number(currentUserId);
  if (!Number.isFinite(userId)) return [];
  return safeEvents.filter((event) =>
    Number(event.host_user_id) === userId ||
    (event.participant_user_ids || []).some((participantId) => Number(participantId) === userId)
  );
}
