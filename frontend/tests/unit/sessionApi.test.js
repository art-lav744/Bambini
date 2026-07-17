import assert from "node:assert/strict";
import test from "node:test";

const values = new Map();
const listeners = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.window = {
  location: { origin: "http://localhost:5173", hostname: "localhost" },
  addEventListener: (type, listener) => listeners.set(type, listener),
  removeEventListener: (type, listener) => {
    if (listeners.get(type) === listener) listeners.delete(type);
  },
  dispatchEvent: (event) => listeners.get(event.type)?.(event),
};

const requests = [];
globalThis.fetch = async (url, options) => {
  requests.push({ url, options });
  return {
    ok: true,
    status: 200,
    json: async () => ({ image_url: "/media/events/photo.png" }),
  };
};

const apiModule = await import("../../src/api.js");
const sessionModule = await import("../../src/userSession.js");

test("API requests include the bearer session and hydrate media URLs", async () => {
  apiModule.setAuthToken("session-token");
  const response = await apiModule.api.health();

  assert.equal(requests[0].url, "/api/health");
  assert.equal(requests[0].options.headers.Authorization, "Bearer session-token");
  assert.equal(response.image_url, "http://localhost:5173/media/events/photo.png");
});

test("session storage publishes login and logout state changes", () => {
  const states = [];
  const unsubscribe = sessionModule.subscribeToAuthChanges((authenticated) => states.push(authenticated));

  sessionModule.saveCurrentUser({ id: 7, name: "Ira" }, "new-token");
  assert.equal(sessionModule.hasStoredSession(), true);
  assert.equal(localStorage.getItem("outdoor_user_id"), "7");
  sessionModule.clearCurrentUser();

  assert.deepEqual(states, [true, false]);
  assert.equal(sessionModule.hasStoredSession(), false);
  unsubscribe();
});
