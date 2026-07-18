const CONFIGURED_API_URL = (import.meta.env?.VITE_API_URL || "").trim();
const AUTH_TOKEN_KEY = "outdoor_auth_token";

function resolveApiUrl() {
  if (!CONFIGURED_API_URL) return "/api";
  try {
    const configured = new URL(CONFIGURED_API_URL, window.location.origin);
    const configuredIsLoopback = ["127.0.0.1", "localhost"].includes(configured.hostname);
    const pageIsLoopback = ["127.0.0.1", "localhost"].includes(window.location.hostname);
    if (configuredIsLoopback && !pageIsLoopback) return "/api";
  } catch {
    // Relative values are valid.
  }
  return CONFIGURED_API_URL;
}

const RAW_API_URL = resolveApiUrl();
const API_URL = RAW_API_URL.endsWith("/") ? RAW_API_URL.slice(0, -1) : RAW_API_URL;

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

function apiOrigin() {
  try {
    return new URL(API_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

function hydrateMediaUrls(value) {
  if (Array.isArray(value)) return value.map(hydrateMediaUrls);
  if (!value || typeof value !== "object") return value;
  const copy = { ...value };
  for (const [key, item] of Object.entries(copy)) {
    if ((key === "image_url" || key === "photo_url") && typeof item === "string" && item.startsWith("/media/")) {
      copy[key] = `${apiOrigin()}${item}`;
    } else if (item && typeof item === "object") {
      copy[key] = hydrateMediaUrls(item);
    }
  }
  return copy;
}

async function request(path, options = {}) {
  const token = getAuthToken();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Немає з’єднання з сервером. Перевірте мережу та адресу backend.",
      0
    );
  }

  if (!response.ok) {
    let message = `Помилка сервера (${response.status})`;
    try {
      const data = await response.json();
      message = typeof data.detail === "string" ? data.detail : message;
    } catch {
      // Keep fallback.
    }
    if (response.status === 401) {
      setAuthToken("");
      localStorage.removeItem("outdoor_user_id");
      window.dispatchEvent(new CustomEvent("bambini-auth-changed", { detail: { authenticated: false } }));
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return null;
  return hydrateMediaUrls(await response.json());
}

export const api = {
  health: () => request("/health"),
  createUser: (payload) => request("/users", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/login", { method: "POST", body: JSON.stringify(payload) }),
  googleLogin: (credential) => request("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  logout: () => request("/logout", { method: "POST" }),
  getMe: () => request("/users/me"),
  getUser: (userId) => request(`/users/${userId}`),
  updateUser: (userId, payload) => request(`/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getCustomization: (userId) => request(`/users/${userId}/customization`),
  updateCustomization: (userId, payload) => request(`/users/${userId}/customization`, { method: "PUT", body: JSON.stringify(payload) }),
  setLocationSharing: (userId, enabled) => request(`/users/${userId}/location-sharing`, { method: "PUT", body: JSON.stringify({ enabled }) }),
  setLocationVisibility: (userId, visibility) => request(`/users/${userId}/location-visibility`, { method: "PUT", body: JSON.stringify({ visibility }) }),
  updateLocation: (userId, payload) => request(`/users/${userId}/location`, { method: "PUT", body: JSON.stringify(payload) }),
  getFriends: (userId) => request(`/users/${userId}/friends`),
  getFriendLocations: (userId) => request(`/users/${userId}/friends/locations`),
  getVisibleLocations: (userId) => request(`/users/${userId}/visible-locations`),
  sendFriendRequest: (userId, friendCode) => request(`/users/${userId}/friends/request`, { method: "POST", body: JSON.stringify({ friend_code: friendCode }) }),
  acceptFriendRequest: (userId, friendshipId) => request(`/users/${userId}/friends/${friendshipId}/accept`, { method: "POST" }),
  deleteFriend: (userId, friendshipId) => request(`/users/${userId}/friends/${friendshipId}`, { method: "DELETE" }),
  createActivity: (payload) => request("/activities", { method: "POST", body: JSON.stringify(payload) }),
  getPublicActivities: () => request("/activities/public/list"),
  getVisibleActivities: () => request("/activities/visible/list"),
  getFriendActivities: (userId) => request(`/users/${userId}/friend-activities`),
  getActivity: (code) => request(`/activities/${code}`),
  updateActivity: (code, payload) => request(`/activities/${code}`, { method: "PATCH", body: JSON.stringify(payload) }),
  joinActivity: (code, userId) => request(`/activities/${code}/join`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
  leaveActivity: (code, userId) => request(`/activities/${code}/members/${userId}`, { method: "DELETE" }),
  removeActivityMember: (code, userId) => request(`/activities/${code}/members/${userId}`, { method: "DELETE" }),
  deleteActivity: (code) => request(`/activities/${code}`, { method: "DELETE" }),
  getUserActivities: (userId) => request(`/users/${userId}/activities`),
  getParticipants: (code) => request(`/activities/${code}/participants`),
  getNotifications: (userId) => request(`/users/${userId}/notifications`),
  markNotificationRead: (userId, notificationId) => request(`/users/${userId}/notifications/${notificationId}/read`, { method: "POST" }),
};
