import assert from "node:assert/strict";
import test from "node:test";
import { getEventOrbitPatternOffsets, isWithinEventGeofence, limitEventOrbitUsers } from "./mapMath.js";

test("two attendees are placed on opposite sides", () => {
  assert.deepEqual(getEventOrbitPatternOffsets(2, 40), [[-40, 0], [40, 0]]);
});

test("triangle, square and five-point layouts contain the requested count", () => {
  assert.equal(getEventOrbitPatternOffsets(3, 40).length, 3);
  assert.equal(getEventOrbitPatternOffsets(4, 40).length, 4);
  assert.equal(getEventOrbitPatternOffsets(5, 40).length, 5);
});

test("mobile GPS accuracy expands the event geofence without becoming unbounded", () => {
  const event = [24.7111, 48.9226];
  const about63mNorth = [24.7111, 48.923166];
  assert.equal(isWithinEventGeofence(event, about63mNorth, 0), true);
  const farAway = [24.7111, 48.93];
  assert.equal(isWithinEventGeofence(event, farAway, 1000), false);
});

test("orbit displays at most eight slots and preserves the hidden count", () => {
  const users = Array.from({ length: 12 }, (_, index) => ({ userId: index + 1 }));
  const displayed = limitEventOrbitUsers(users, 8);
  assert.equal(displayed.length, 8);
  assert.deepEqual(displayed.at(-1), { isOverflow: true, overflowCount: 5 });
});
