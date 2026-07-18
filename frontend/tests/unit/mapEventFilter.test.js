import assert from "node:assert/strict";
import test from "node:test";
import { filterMapEvents, normalizeMapEventFilter } from "../../src/mapEventFilter.js";

const events = [
  { id: 1, host_user_id: 7, participant_user_ids: [] },
  { id: 2, host_user_id: 3, participant_user_ids: [7, 8] },
  { id: 3, host_user_id: 4, participant_user_ids: [5] },
];

test("map event filter supports none, participating events, and all visible events", () => {
  assert.deepEqual(filterMapEvents(events, "none", 7), []);
  assert.deepEqual(filterMapEvents(events, "mine", 7).map((event) => event.id), [1, 2]);
  assert.equal(filterMapEvents(events, "all", 7), events);
});

test("unknown map event filter values fall back to all", () => {
  assert.equal(normalizeMapEventFilter("unexpected"), "all");
});
