import assert from "node:assert/strict";
import test from "node:test";
import { defaultEventEndTime, eventDateTimeToLocal, localDateTimeToUtc } from "../../src/eventFormat.js";

test("event date helpers convert local inputs to UTC and back", () => {
  const localValue = "2026-07-17T16:30";
  const utcValue = localDateTimeToUtc(localValue);
  assert.equal(utcValue, new Date(localValue).toISOString());
  assert.equal(eventDateTimeToLocal(utcValue), localValue);
});

test("default event end time is two hours after its start", () => {
  const start = "2026-07-17T16:30";
  const end = defaultEventEndTime(start);
  assert.equal(new Date(end).getTime() - new Date(start).getTime(), 2 * 60 * 60 * 1000);
  assert.throws(() => localDateTimeToUtc("not-a-date"), /Некоректний/);
});
