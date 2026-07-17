import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");

function firstRuleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
}

test("MapLibre marker roots remain absolutely positioned", () => {
  assert.match(firstRuleBody(".map-user-marker"), /position:\s*absolute/);
  assert.match(firstRuleBody(".event-map-marker"), /position:\s*absolute/);
});
