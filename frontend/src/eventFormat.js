export function formatEventDateTime(value, endValue = null) {
  if (!value) return "Час не вказано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Час не вказано";
  const formatter = new Intl.DateTimeFormat("uk-UA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endValue) return formatter.format(date);
  const end = new Date(endValue);
  return Number.isNaN(end.getTime()) ? formatter.format(date) : `${formatter.format(date)} — ${new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(end)}`;
}

function toLocalInput(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function eventDateTimeToLocal(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toLocalInput(date);
}

export function defaultEventStartTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(date);
}

export function defaultEventEndTime(startValue = defaultEventStartTime()) {
  const start = new Date(startValue);
  return toLocalInput(new Date(start.getTime() + 2 * 60 * 60 * 1000));
}

export function localDateTimeToUtc(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Некоректний час події");
  return date.toISOString();
}
