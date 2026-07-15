const RAW_API_URL = import.meta.env.VITE_API_URL || "/api";
const API_URL = RAW_API_URL.endsWith("/") ? RAW_API_URL.slice(0, -1) : RAW_API_URL;

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
  } catch {
    throw new Error(
      "Немає з’єднання з сервером. Відкрийте застосунок через спільну адресу сервера, а не localhost/127.0.0.1 на телефоні."
    );
  }

  if (!response.ok) {
    let message = `Помилка сервера (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  health() {
    return request("/health");
  },
  createUser(payload) {
    return request("/users", { method: "POST", body: JSON.stringify(payload) });
  },
  connectUser(profileCode) {
    return request("/users/connect", {
      method: "POST",
      body: JSON.stringify({ profile_code: profileCode }),
    });
  },
  getUser(userId) {
    return request(`/users/${userId}`);
  },
  updateUser(userId, payload) {
    return request(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  setLocationSharing(userId, enabled) {
    return request(`/users/${userId}/location-sharing`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  },
  setLocationVisibility(userId, visibility) {
    return request(`/users/${userId}/location-visibility`, {
      method: "PUT",
      body: JSON.stringify({ visibility }),
    });
  },
  updateLocation(userId, payload) {
    return request(`/users/${userId}/location`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  getFriends(userId) {
    return request(`/users/${userId}/friends`);
  },
  getFriendLocations(userId) {
    return request(`/users/${userId}/friends/locations`);
  },
  getVisibleLocations(userId) {
    return request(`/users/${userId}/visible-locations`);
  },
  sendFriendRequest(userId, friendCode) {
    return request(`/users/${userId}/friends/request`, {
      method: "POST",
      body: JSON.stringify({ friend_code: friendCode }),
    });
  },
  acceptFriendRequest(userId, friendshipId) {
    return request(`/users/${userId}/friends/${friendshipId}/accept`, {
      method: "POST",
    });
  },

  createActivity(payload) {
    return request("/activities", { method: "POST", body: JSON.stringify(payload) });
  },
  getPublicActivities() {
    return request("/activities/public/list");
  },
  getActivity(code) {
    return request(`/activities/${code}`);
  },
  joinActivity(code, userId) {
    return request(`/activities/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },
  getUserActivities(userId) {
    return request(`/users/${userId}/activities`);
  },
  getParticipants(code) {
    return request(`/activities/${code}/participants`);
  },
  getCheckpoints(code) {
    return request(`/activities/${code}/checkpoints`);
  },
  createCheckpoint(code, payload) {
    return request(`/activities/${code}/checkpoints`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
