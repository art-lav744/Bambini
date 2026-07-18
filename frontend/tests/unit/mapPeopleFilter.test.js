import assert from "node:assert/strict";
import test from "node:test";
import { filterMapPeople, filterMapPeopleWithEventParticipants, normalizeMapPeopleFilter } from "../../src/mapPeopleFilter.js";

const locations = [
  { user_id: 1, friendship_status: "accepted" },
  { user_id: 2, friendship_status: "pending" },
  { user_id: 3, friendship_status: null },
];

test("map people filter supports none, accepted friends, and all visible users", () => {
  assert.deepEqual(filterMapPeople(locations, "none"), []);
  assert.deepEqual(filterMapPeople(locations, "friends").map((item) => item.user_id), [1]);
  assert.equal(filterMapPeople(locations, "all"), locations);
});

test("unknown map people filter values fall back to all", () => {
  assert.equal(normalizeMapPeopleFilter("unexpected"), "all");
});

test("public and shared-event attendees bypass the general people filter", () => {
  const publicEvent = { visibility: "public", host_user_id: 8, participant_user_ids: [2] };
  const sharedPrivateEvent = { visibility: "private", host_user_id: 7, participant_user_ids: [7, 3] };
  const unrelatedPrivateEvent = { visibility: "private", host_user_id: 9, participant_user_ids: [1] };
  const visible = filterMapPeopleWithEventParticipants(
    locations,
    "none",
    [publicEvent, sharedPrivateEvent, unrelatedPrivateEvent],
    7
  );

  assert.deepEqual(visible.map((item) => item.user_id), [2, 3]);
});
