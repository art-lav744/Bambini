import { api } from "./api.js";

const USER_ID_KEY = "outdoor_user_id";
const PROFILE_CODE_KEY = "outdoor_profile_code";
const AUTH_USERS_KEY = "outdoor_auth_users";

function readStoredUsers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeStoredUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function findAuthUserKeyById(userId, users = null) {
  const stored = users || readStoredUsers();
  return Object.keys(stored).find((key) => stored[key]?.user?.id === userId);
}

function findAuthUserKeyByGoogleId(googleId, users = null) {
  if (!googleId) return null;
  const stored = users || readStoredUsers();
  return Object.keys(stored).find((key) => stored[key]?.googleId === googleId);
}

function updateStoredUser(user) {
  if (!user?.id) return;
  const users = readStoredUsers();
  const key = findAuthUserKeyById(user.id, users);
  if (!key) return;
  users[key] = {
    ...users[key],
    user,
  };
  writeStoredUsers(users);
}

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

function getFallbackUser(name, email = null) {
  return {
    id: Date.now(),
    name,
    photo_url: null,
    friend_code: "LOCAL",
    profile_code: `LOCAL${Date.now().toString().slice(-8)}`,
    location_sharing_enabled: true,
    location_visibility: "friends",
    created_at: new Date().toISOString(),
    email,
  };
}

function createUserWithFallback(name) {
  return api.createUser({ name, photo_url: null }).catch(() => getFallbackUser(name));
}

export function saveCurrentUser(user) {
  const userId = user?.id ?? Number(localStorage.getItem(USER_ID_KEY));
  if (Number.isInteger(userId) && userId > 0) {
    localStorage.setItem(USER_ID_KEY, String(userId));
  }
  if (user?.profile_code) {
    localStorage.setItem(PROFILE_CODE_KEY, user.profile_code);
  }
  localStorage.setItem("player_name", user?.name || "Guest");
  updateStoredUser(user);
}

export async function connectExistingUser(profileCode) {
  const user = await api.connectUser(profileCode.trim().toUpperCase());
  saveCurrentUser(user);
  return user;
}

export async function ensureCurrentUser() {
  const storedId = Number(localStorage.getItem(USER_ID_KEY));

  if (Number.isInteger(storedId) && storedId > 0) {
    try {
      const user = await api.getUser(storedId);
      saveCurrentUser(user);
      return user;
    } catch {
      localStorage.removeItem(USER_ID_KEY);
    }
  }

  const storedProfileCode = localStorage.getItem(PROFILE_CODE_KEY);
  if (storedProfileCode) {
    try {
      return await connectExistingUser(storedProfileCode);
    } catch {
      localStorage.removeItem(PROFILE_CODE_KEY);
    }
  }

  const fallbackName = (localStorage.getItem("player_name") || "Guest").trim();
  const user = await createUserWithFallback(fallbackName.length >= 2 ? fallbackName : "Guest");

  saveCurrentUser(user);
  return user;
}

export async function registerWithEmail({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const users = readStoredUsers();

  if (users[normalizedEmail]) {
    throw new Error("Користувач із таким email вже існує.");
  }

  const user = await createUserWithFallback((name || "Guest").trim() || "Guest");
  users[normalizedEmail] = { email: normalizedEmail, password, user };
  writeStoredUsers(users);
  saveCurrentUser(user);
  return user;
}

export async function loginWithEmail({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const users = readStoredUsers();
  const stored = users[normalizedEmail];

  if (!stored || stored.password !== password) {
    throw new Error("Невірний email або пароль.");
  }

  saveCurrentUser(stored.user);
  return stored.user;
}

export async function loginWithGoogle(credential) {
  const payload = decodeJwtPayload(credential);
  const email = payload?.email || `google-${Date.now()}@local.test`;
  const name = payload?.name || payload?.given_name || "Google user";
  const normalizedEmail = normalizeEmail(email);
  const googleId = payload?.sub || null;
  const users = readStoredUsers();

  const googleUserKey = findAuthUserKeyByGoogleId(googleId, users);
  if (googleUserKey) {
    saveCurrentUser(users[googleUserKey].user);
    return users[googleUserKey].user;
  }

  if (googleId && users[normalizedEmail]) {
    users[normalizedEmail] = {
      ...users[normalizedEmail],
      googleId,
    };
    writeStoredUsers(users);
    saveCurrentUser(users[normalizedEmail].user);
    return users[normalizedEmail].user;
  }

  const user = await createUserWithFallback(name);
  users[normalizedEmail] = {
    email: normalizedEmail,
    password: "google-oauth",
    googleId,
    user,
  };
  writeStoredUsers(users);
  saveCurrentUser(user);
  return user;
}
