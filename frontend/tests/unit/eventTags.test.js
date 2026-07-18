import assert from "node:assert/strict";
import test from "node:test";
import { filterEventsByTags, normalizeEventTags, toggleEventTag } from "../../src/eventTags.js";

test("preset event tags are deduplicated and limited to five", () => {
  assert.deepEqual(
    normalizeEventTags(["sport", "sport", "music", "walk", "coffee", "family", "kids"]),
    ["sport", "music", "walk", "coffee", "family"]
  );
  assert.deepEqual(toggleEventTag(["sport", "music", "walk", "coffee", "family"], "kids"), ["sport", "music", "walk", "coffee", "family"]);
  assert.deepEqual(normalizeEventTags(["table-tennis", "pet-friendly-event"]), ["table-tennis", "pet-friendly-event"]);
});

test("event tag filter matches any selected tag and empty means all", () => {
  const events = [
    { id: 1, tags: ["sport", "football"] },
    { id: 2, tags: ["music"] },
    { id: 3, tags: [] },
  ];
  assert.equal(filterEventsByTags(events, []), events);
  assert.deepEqual(filterEventsByTags(events, ["football", "music"]).map((event) => event.id), [1, 2]);
});
