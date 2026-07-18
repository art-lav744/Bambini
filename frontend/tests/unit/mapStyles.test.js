import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const customizationPage = readFileSync(new URL("../../src/pages/CustomizationPage.jsx", import.meta.url), "utf8");

function firstRuleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
}

test("MapLibre marker roots remain absolutely positioned", () => {
  assert.match(firstRuleBody(".map-user-marker"), /position:\s*absolute/);
  assert.match(firstRuleBody(".event-map-marker"), /position:\s*absolute/);
});

test("Map popups stay above event and attendee markers", () => {
  assert.match(firstRuleBody(".bambini-map-popup"), /z-index:\s*20\s*!important/);
  assert.match(styles, /\.event-map-marker\s*\{[^}]*z-index:\s*2/s);
});

test("all supplied mascot backgrounds use optimized artwork", () => {
  const backgrounds = [
    "sunflowers", "sakura", "tropical-beach", "city", "shop",
    "skatepark", "space", "fountain", "garden", "color-splash",
    "digital-world", "pixel-world", "concert", "candy-land", "pirate-bay",
    "ice-castle", "volcano", "medieval-castle", "desert", "arcade",
  ];

  for (const background of backgrounds) {
    const asset = `background-${background}.webp`;
    assert.ok(existsSync(new URL(`../../public/visuals/${asset}`, import.meta.url)), `${asset} is missing`);
    assert.match(firstRuleBody(`.mascot-background--${background}`), new RegExp(`url\\(\"/visuals/${asset}\"\\)`));
  }
});

test("cosmetic cards contain requirements and progress without a separate achievement section", () => {
  assert.match(customizationPage, /requirement\.description/);
  assert.match(customizationPage, /Залишилося:/);
  assert.match(customizationPage, /\{requirement && \(/);
  assert.match(customizationPage, /className="cosmetic-progress"/);
  assert.doesNotMatch(customizationPage, /achievements-section/);
  assert.match(firstRuleBody(".cosmetic-progress"), /height:\s*5px/);
});
