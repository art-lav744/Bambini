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
