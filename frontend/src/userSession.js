import { api } from "./api.js";

const USER_ID_KEY = "outdoor_user_id";

function decodeJwtPayload(credential) {
  if (!credential) return {};

  const payloadPart = credential.split(".")[1];
  if (!payloadPart) return {};

  const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const decoded = new TextDecoder("utf-8").decode(bytes);

  try {
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

export function saveCurrentUser(user) {
  if (!user?.id) return;
  localStorage.setItem(USER_ID_KEY, String(user.id));
  localStorage.setItem("player_name", user.name || "Користувач");
}

export async function ensureCurrentUser() {
  const storedId = Number(localStorage.getItem(USER_ID_KEY));
  if (!Number.isInteger(storedId) || storedId <= 0) {
    throw new Error("Потрібно увійти в акаунт");
  }

  try {
    const user = await api.getUser(storedId);
    saveCurrentUser(user);
    return user;
  } catch (error) {
    localStorage.removeItem(USER_ID_KEY);
    throw error;
  }
}

export async function registerWithEmail({ name, email, password }) {
  const user = await api.createUser({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
  });
  saveCurrentUser(user);
  return user;
}

export async function loginWithEmail({ email, password }) {
  const user = await api.login({
    email: email.trim().toLowerCase(),
    password,
  });
  saveCurrentUser(user);
  return user;
}

export async function loginWithGoogle(credential) {
  const payload = decodeJwtPayload(credential);
  const email = (payload?.email || "").trim().toLowerCase();
  const name = payload?.name || payload?.given_name || "Користувач Google";

  if (!email) {
    throw new Error("Google не повернув email користувача");
  }

  try {
    const user = await api.createUser({ name, email, photo_url: payload?.picture || null });
    saveCurrentUser(user);
    return user;
  } catch (error) {
    throw new Error(
      "Акаунт із цим email уже існує. Увійдіть через email і пароль."
    );
  }
}
