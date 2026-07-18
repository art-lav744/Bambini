export const MAP_PEOPLE_FILTER_OPTIONS = [
  { value: "none", label: "Нікого" },
  { value: "friends", label: "Друзі" },
  { value: "all", label: "Усі" },
];

export function normalizeMapPeopleFilter(value) {
  return MAP_PEOPLE_FILTER_OPTIONS.some((option) => option.value === value) ? value : "all";
}

export function filterMapPeople(locations, filter) {
  const safeLocations = Array.isArray(locations) ? locations : [];
  if (filter === "none") return [];
  if (filter === "friends") {
    return safeLocations.filter((location) => location.friendship_status === "accepted");
  }
  return safeLocations;
}

export function filterMapPeopleWithEventParticipants(locations, filter, events, currentUserId) {
  const safeLocations = Array.isArray(locations) ? locations : [];
  const filteredIds = new Set(filterMapPeople(safeLocations, filter).map((location) => Number(location.user_id)));
  const eventParticipantIds = new Set();
  const viewerId = Number(currentUserId);

  for (const event of Array.isArray(events) ? events : []) {
    const participantIds = (event.participant_user_ids || []).map(Number).filter(Number.isFinite);
    const viewerSharesEvent = Number(event.host_user_id) === viewerId || participantIds.includes(viewerId);
    if (event.visibility !== "public" && !viewerSharesEvent) continue;
    participantIds.forEach((participantId) => eventParticipantIds.add(participantId));
  }

  return safeLocations.filter((location) => {
    const userId = Number(location.user_id);
    return filteredIds.has(userId) || eventParticipantIds.has(userId);
  });
}
