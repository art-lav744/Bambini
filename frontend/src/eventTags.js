export const EVENT_TAG_OPTIONS = [
  { value: "sport", label: "Спорт" },
  { value: "football", label: "Футбол" },
  { value: "basketball", label: "Баскетбол" },
  { value: "volleyball", label: "Волейбол" },
  { value: "tennis", label: "Теніс" },
  { value: "running", label: "Біг" },
  { value: "cycling", label: "Велосипед" },
  { value: "walk", label: "Прогулянка" },
  { value: "picnic", label: "Пікнік" },
  { value: "hiking", label: "Туризм" },
  { value: "music", label: "Музика" },
  { value: "cinema", label: "Кіно" },
  { value: "board-games", label: "Настільні ігри" },
  { value: "party", label: "Вечірка" },
  { value: "coffee", label: "Кава" },
  { value: "family", label: "Сім’я" },
  { value: "kids", label: "Діти" },
  { value: "networking", label: "Знайомства" },
];

const EVENT_TAG_VALUES = new Set(EVENT_TAG_OPTIONS.map((tag) => tag.value));
const EVENT_TAG_LABELS = new Map(EVENT_TAG_OPTIONS.map((tag) => [tag.value, tag.label]));

export function normalizeEventTags(value, max = 5) {
  const result = [];
  const seen = new Set();
  for (const tag of Array.isArray(value) ? value : []) {
    if (!EVENT_TAG_VALUES.has(tag) || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= max) break;
  }
  return result;
}

export function toggleEventTag(value, tag, max = 5) {
  const selected = normalizeEventTags(value, max);
  if (selected.includes(tag)) return selected.filter((item) => item !== tag);
  if (!EVENT_TAG_VALUES.has(tag) || selected.length >= max) return selected;
  return [...selected, tag];
}

export function eventTagLabel(tag) {
  return EVENT_TAG_LABELS.get(tag) || tag;
}

export function filterEventsByTags(events, selectedTags) {
  const safeEvents = Array.isArray(events) ? events : [];
  const selected = new Set(normalizeEventTags(selectedTags, Number.POSITIVE_INFINITY));
  if (!selected.size) return safeEvents;
  return safeEvents.filter((event) => (event.tags || []).some((tag) => selected.has(tag)));
}
