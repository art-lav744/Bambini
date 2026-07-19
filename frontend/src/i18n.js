import { useCallback, useSyncExternalStore } from "react";

export const DEFAULT_LANGUAGE = "uk";
export const LANGUAGE_STORAGE_KEY = "bambini:language:v1";
export const LANGUAGE_OPTIONS = [
  { value: "uk", label: "Українська", shortLabel: "UA" },
  { value: "en", label: "English", shortLabel: "EN" },
];

const listeners = new Set();

function normalizeLanguage(value) {
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}

function readStoredLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

let currentLanguage = readStoredLanguage();

function applyDocumentLanguage(language) {
  if (typeof document !== "undefined") document.documentElement.lang = language;
}

applyDocumentLanguage(currentLanguage);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== LANGUAGE_STORAGE_KEY) return;
    const nextLanguage = normalizeLanguage(event.newValue);
    if (nextLanguage === currentLanguage) return;
    currentLanguage = nextLanguage;
    applyDocumentLanguage(currentLanguage);
    listeners.forEach((listener) => listener());
  });
}

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(value) {
  const nextLanguage = normalizeLanguage(value);
  if (nextLanguage === currentLanguage) return currentLanguage;
  currentLanguage = nextLanguage;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch {
      // The language still changes for this session when storage is unavailable.
    }
  }
  applyDocumentLanguage(currentLanguage);
  listeners.forEach((listener) => listener());
  return currentLanguage;
}

export function translate(ukrainian, english, language = currentLanguage) {
  return normalizeLanguage(language) === "en" ? english : ukrainian;
}

export function localeForLanguage(language = currentLanguage) {
  return normalizeLanguage(language) === "en" ? "en-GB" : "uk-UA";
}

export function useI18n() {
  const language = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getLanguage,
    () => DEFAULT_LANGUAGE,
  );

  const tr = useCallback((ukrainian, english) => translate(ukrainian, english, language), [language]);

  return {
    language,
    locale: localeForLanguage(language),
    setLanguage,
    tr,
  };
}

const EXACT_API_MESSAGES = new Map([
  ["Потрібно увійти в акаунт", "You need to sign in"],
  ["Підтвердьте email, щоб користуватися Bambini", "Verify your email to use Bambini"],
  ["Сервер не повернув сесію", "The server did not return a session"],
  ["Немає з’єднання з сервером. Перевірте мережу та адресу backend.", "Cannot connect to the server. Check your network and backend address."],
  ["Некоректний час події", "Invalid event time"],
  ["Користувача не знайдено", "User not found"],
  ["Подію не знайдено", "Event not found"],
  ["Неправильний email або пароль", "Incorrect email or password"],
  ["Email уже використовується", "This email is already in use"],
  ["Ім'я вже використовується", "This name is already in use"],
  ["Невірний код підтвердження", "Invalid verification code"],
  ["Термін дії коду минув", "The verification code has expired"],
  ["Зачекайте перед повторним надсиланням коду", "Wait before requesting another code"],
  ["Не вдалося створити унікальний код", "Could not create a unique code"],
  ["Надсилання email ще не налаштовано", "Email delivery is not configured yet"],
  ["Не вдалося надіслати код. Спробуйте ще раз пізніше", "Could not send the code. Try again later"],
  ["Для акаунта не вказано email", "No email is set for this account"],
  ["Сесія завершилася. Увійдіть знову", "Your session has expired. Sign in again"],
  ["Користувача сесії не знайдено", "Session user not found"],
  ["Не можна виконувати дію від імені іншого користувача", "You cannot perform this action as another user"],
  ["Забагато спроб. Спробуйте пізніше", "Too many attempts. Try again later"],
  ["visibility: public, friends або private", "visibility must be public, friends or private"],
  ["Ця подія недоступна для вашого акаунта", "This event is not available to your account"],
  ["Зображення потрібно завантажити файлом", "The image must be uploaded as a file"],
  ["Некоректний файл зображення", "Invalid image file"],
  ["Зображення має бути не більше 2 МБ", "The image must be no larger than 2 MB"],
  ["Email already використовується", "This email is already in use"],
  ["Невірний email або пароль", "Incorrect email or password"],
  ["Google Sign-In не налаштовано на сервері", "Google Sign-In is not configured on the server"],
  ["Google credential не пройшов перевірку", "Google credential verification failed"],
  ["Недійсний видавець Google token", "Invalid Google token issuer"],
  ["Google email не підтверджено", "Google email is not verified"],
  ["Google не повернув ідентифікатор акаунта", "Google did not return an account identifier"],
  ["Цей email уже пов’язаний з іншим Google акаунтом", "This email is already linked to another Google account"],
  ["Код прострочено. Надішліть новий код", "The code has expired. Request a new code"],
  ["Забагато невдалих спроб. Надішліть новий код", "Too many failed attempts. Request a new code"],
  ["Поширення геолокації вимкнено", "Location sharing is disabled"],
  ["visibility: none, friends або everyone", "visibility must be none, friends or everyone"],
  ["Код друга не знайдено", "Friend code not found"],
  ["Не можна додати себе", "You cannot add yourself"],
  ["Запит або дружба вже існує", "A request or friendship already exists"],
  ["Запит не знайдено", "Request not found"],
  ["Цей запит адресований іншому користувачу", "This request is addressed to another user"],
  ["Запит уже оброблено", "This request has already been handled"],
  ["Запит або дружбу не знайдено", "Request or friendship not found"],
  ["Недостатньо прав", "Insufficient permissions"],
  ["Один користувач може мати не більше 3 подій. Видаліть одну з подій, щоб створити нову.", "One user can have no more than 3 events. Delete an event before creating another."],
  ["Не вдалося створити подію", "Could not create the event"],
  ["Лише організатор може редагувати подію", "Only the host can edit the event"],
  ["Назва події є обов’язковою", "Event name is required"],
  ["Час початку є обов’язковим", "Start time is required"],
  ["Час завершення має бути пізніше часу початку", "End time must be later than start time"],
  ["Невідомий тип позначки події", "Unknown event pin type"],
  ["Потрібні обидві координати події", "Both event coordinates are required"],
  ["Не вдалося зберегти зміни події", "Could not save event changes"],
  ["Ця подія доступна лише друзям організатора", "This event is available only to the host's friends"],
  ["У події вже немає вільних місць", "There are no places left in this event"],
  ["Лише організатор може видаляти інших учасників", "Only the host can remove other participants"],
  ["Організатор не може вийти з власної події", "The host cannot leave their own event"],
  ["Учасника не знайдено в цій події", "Participant not found in this event"],
  ["Лише організатор може видалити подію", "Only the host can delete the event"],
  ["Не вдалося видалити пов’язані дані події", "Could not delete related event data"],
  ["Повідомлення не знайдено", "Notification not found"],
]);

export function localizeApiMessage(message, language = currentLanguage) {
  const source = String(message || "").trim();
  if (!source || normalizeLanguage(language) !== "en") return source;
  if (EXACT_API_MESSAGES.has(source)) return EXACT_API_MESSAGES.get(source);
  if (/^Помилка сервера \(\d+\)$/.test(source)) return source.replace("Помилка сервера", "Server error");
  if (source.includes("Підтвердьте email")) return "Verify your email to continue";
  if (source.includes("Не можна створити більше 3")) return "You can create no more than 3 events";
  const invalidCode = source.match(/^Невірний код\. Залишилося спроб: (\d+)$/);
  if (invalidCode) return `Invalid code. Attempts remaining: ${invalidCode[1]}`;
  const resendDelay = source.match(/^Новий код можна надіслати через (\d+) с$/);
  if (resendDelay) return `A new code can be sent in ${resendDelay[1]}s`;
  const capacity = source.match(/^Місткість не може бути меншою за поточну кількість учасників \((\d+)\)$/);
  if (capacity) return `Capacity cannot be lower than the current participant count (${capacity[1]})`;
  const lockedReward = source.match(/^«(.+)» відкривається за досягнення «(.+)»$/);
  if (lockedReward) return `“${lockedReward[1]}” is unlocked by the “${lockedReward[2]}” achievement`;
  return source;
}

const ACHIEVEMENT_TITLES_EN = {
  "first-alliance": "First Alliance",
  "blood-brother": "Sworn Ally",
  "alliance-lord": "Lord of Alliances",
  "ally-collector": "Ally Collector",
  "community-master": "Community Master",
  awakening: "Awakening",
  "call-of-adventure": "Call of Adventure",
  "fate-conqueror": "Conqueror of Fate",
  explorer: "Explorer",
  pilgrim: "Pilgrim",
  "continent-conqueror": "Conqueror of Continents",
  "living-legend": "Living Legend",
  "endless-traveler": "Endless Traveller",
  "spark-kindler": "Spark Kindler",
  "world-creator": "World Creator",
  "supreme-architect": "Supreme Architect",
  "heard-voice": "A Voice Heard",
  "followed-one": "The One They Follow",
  "legend-leader": "Leader of Legends",
  "era-standard-bearer": "Standard-Bearer of the Era",
  "glory-hunter": "Glory Hunter",
  "achievement-keeper": "Keeper of Achievements",
  "chosen-of-fate": "Chosen by Fate",
  "immortal-hero": "Immortal Hero",
};

function achievementDescriptionEn(achievement) {
  const count = Number(achievement?.target) || 0;
  if (achievement?.category === "friends") return `Add ${count} ${count === 1 ? "friend" : "friends"}`;
  if (achievement?.category === "joined-events") return `Join ${count} ${count === 1 ? "event" : "events"}`;
  if (achievement?.category === "created-events") return `Create ${count} ${count === 1 ? "event" : "events"}`;
  if (achievement?.category === "event-popularity") return `${count} ${count === 1 ? "person joins" : "people join"} one of your events`;
  if (achievement?.category === "achievements") return `Unlock ${count} achievements`;
  return achievement?.description || "Unlock this achievement";
}

export function localizeAchievement(achievement, language = currentLanguage) {
  if (!achievement || normalizeLanguage(language) !== "en") return achievement;
  return {
    ...achievement,
    title: ACHIEVEMENT_TITLES_EN[achievement.id] || achievement.title,
    description: achievementDescriptionEn(achievement),
  };
}
