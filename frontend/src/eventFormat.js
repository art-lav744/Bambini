export function formatEventDateTime(value) {
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

export function defaultEventStartTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
