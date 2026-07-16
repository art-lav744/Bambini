import assert from "node:assert/strict";
import test from "node:test";
import { filterMapPeople, normalizeMapPeopleFilter } from "./mapPeopleFilter.js";

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
