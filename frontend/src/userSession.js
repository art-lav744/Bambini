import { ApiError, api, getAuthToken, setAuthToken } from "./api.js";

const USER_ID_KEY = "outdoor_user_id";
const AUTH_EVENT = "bambini-auth-changed";

function publishAuthChange(authenticated) {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { authenticated } }));
}

export function hasStoredSession() {
  return Boolean(getAuthToken());
}

export function subscribeToAuthChanges(callback) {
  const listener = (event) => callback(Boolean(event.detail?.authenticated));
  window.addEventListener(AUTH_EVENT, listener);
  return () => window.removeEventListener(AUTH_EVENT, listener);
}

export function saveCurrentUser(user, token = null) {
  if (!user?.id) return;
  if (token) setAuthToken(token);
  localStorage.setItem(USER_ID_KEY, String(user.id));
  localStorage.setItem("player_name", user.name || "Користувач");
  publishAuthChange(true);
}

export function clearCurrentUser() {
  setAuthToken("");
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem("player_name");
  publishAuthChange(false);
}

export async function signOut() {
  try {
    if (getAuthToken()) await api.logout();
  } catch {
    // Local logout must still succeed if the server is offline.
  } finally {
    clearCurrentUser();
  }
}

export async function ensureCurrentUser() {
  if (!getAuthToken()) throw new ApiError("Потрібно увійти в акаунт", 401);
  try {
    const user = await api.getMe();
    saveCurrentUser(user);
    return user;
  } catch (error) {
    // Only an explicit authentication rejection invalidates the session.
    // Offline/5xx failures retain the token for automatic recovery.
    if (error instanceof ApiError && error.status === 401) clearCurrentUser();
    throw error;
  }
}

function saveAuthResponse(response) {
  if (!response?.token || !response?.user) throw new Error("Сервер не повернув сесію");
  saveCurrentUser(response.user, response.token);
  return response.user;
}

export async function registerWithEmail({ name, email, password }) {
  return saveAuthResponse(await api.createUser({ name: name.trim(), email: email.trim().toLowerCase(), password }));
}

export async function loginWithEmail({ email, password }) {
  return saveAuthResponse(await api.login({ email: email.trim().toLowerCase(), password }));
}

export async function loginWithGoogle(credential) {
  return saveAuthResponse(await api.googleLogin(credential));
}
