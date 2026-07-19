import { ApiError, api, getAuthToken, setAuthToken } from "./api.js";
import { translate } from "./i18n.js";

const USER_ID_KEY = "outdoor_user_id";
const AUTH_EVENT = "bambini-auth-changed";
const EMAIL_VERIFICATION_KEY = "bambini_email_verification_required";
const PENDING_EMAIL_KEY = "bambini_pending_email";

function publishAuthChange(authenticated) {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { authenticated } }));
}

export function hasStoredSession() {
  return Boolean(getAuthToken()) && !hasPendingEmailVerification();
}

export function hasPendingEmailVerification() {
  return Boolean(getAuthToken()) && localStorage.getItem(EMAIL_VERIFICATION_KEY) === "true";
}

export function getPendingVerificationEmail() {
  return localStorage.getItem(PENDING_EMAIL_KEY) || "";
}

export function subscribeToAuthChanges(callback) {
  const listener = (event) => callback(Boolean(event.detail?.authenticated));
  window.addEventListener(AUTH_EVENT, listener);
  return () => window.removeEventListener(AUTH_EVENT, listener);
}

export function saveCurrentUser(user, token = null) {
  if (!user?.id) return;
  if (token) setAuthToken(token);
  localStorage.removeItem(EMAIL_VERIFICATION_KEY);
  localStorage.removeItem(PENDING_EMAIL_KEY);
  localStorage.setItem(USER_ID_KEY, String(user.id));
  localStorage.setItem("player_name", user.name || translate("Користувач", "User"));
  publishAuthChange(true);
}

export function savePendingEmailVerification(user, email, token = null) {
  if (!user?.id) return;
  if (token) setAuthToken(token);
  localStorage.setItem(EMAIL_VERIFICATION_KEY, "true");
  localStorage.setItem(PENDING_EMAIL_KEY, String(email || "").trim().toLowerCase());
  localStorage.setItem(USER_ID_KEY, String(user.id));
  localStorage.setItem("player_name", user.name || translate("Користувач", "User"));
  publishAuthChange(false);
}

export function clearCurrentUser() {
  setAuthToken("");
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem("player_name");
  localStorage.removeItem(EMAIL_VERIFICATION_KEY);
  localStorage.removeItem(PENDING_EMAIL_KEY);
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
  if (!getAuthToken()) throw new ApiError(translate("Потрібно увійти в акаунт", "You need to sign in"), 401);
  try {
    const user = await api.getMe();
    const verification = await api.getEmailVerificationStatus();
    if (verification.required) {
      savePendingEmailVerification(user, verification.email);
      throw new ApiError(translate("Підтвердьте email, щоб користуватися Bambini", "Verify your email to use Bambini"), 403);
    }
    saveCurrentUser(user);
    return user;
  } catch (error) {
    // Only an explicit authentication rejection invalidates the session.
    // Offline/5xx failures retain the token for automatic recovery.
    if (error instanceof ApiError && error.status === 401) clearCurrentUser();
    throw error;
  }
}

function saveAuthResponse(response, email = "") {
  if (!response?.token || !response?.user) throw new Error(translate("Сервер не повернув сесію", "The server did not return a session"));
  if (response.email_verification_required) {
    savePendingEmailVerification(response.user, email, response.token);
    return { user: response.user, verificationRequired: true };
  }
  saveCurrentUser(response.user, response.token);
  return { user: response.user, verificationRequired: false };
}

export async function registerWithEmail({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  return saveAuthResponse(
    await api.createUser({ name: name.trim(), email: normalizedEmail, password }),
    normalizedEmail,
  );
}

export async function loginWithEmail({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  return saveAuthResponse(await api.login({ email: normalizedEmail, password }), normalizedEmail);
}

export async function loginWithGoogle(credential) {
  return saveAuthResponse(await api.googleLogin(credential));
}

export async function verifyPendingEmail(code) {
  const user = await api.verifyEmail(String(code || "").replace(/\s+/g, ""));
  saveCurrentUser(user);
  return user;
}

export function resendPendingEmailVerification() {
  return api.resendEmailVerification();
}
