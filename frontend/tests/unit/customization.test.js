import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCustomization,
  CUSTOMIZATION_GROUPS,
  DEFAULT_CUSTOMIZATION,
  normalizeCustomization,
  resolveMascot,
  THEMES,
} from "../../src/customization.js";

test("customization keeps supported choices and safely falls back for unknown values", () => {
  assert.deepEqual(
    normalizeCustomization({ orca_skin: "default", header_style: "space", bottom_style: "y2k", theme: "green" }),
    { orca_skin: "default", header_style: "space", bottom_style: "y2k", theme: "green" }
  );
  assert.deepEqual(
    normalizeCustomization({ orca_skin: "unknown", header_style: null, bottom_style: "missing", theme: "missing" }),
    DEFAULT_CUSTOMIZATION
  );
});

test("removed themes fall back to dark and neon is the last theme option", () => {
  assert.equal(normalizeCustomization({ theme: "light" }).theme, "dark");
  assert.equal(normalizeCustomization({ theme: "forest" }).theme, "dark");
  assert.equal(THEMES.at(-1).id, "neon");
  assert.ok(!THEMES.some((theme) => theme.id === "light" || theme.id === "forest"));
});

test("dolphin skin removes equipment and only renders the dolphin layer", () => {
  const customization = normalizeCustomization({
    orca_skin: "dolphin",
    header_style: "space",
    bottom_style: "cyberpunk",
    theme: "blue",
  });
  const mascot = resolveMascot(customization);

  assert.deepEqual(customization, {
    orca_skin: "dolphin",
    header_style: "none",
    bottom_style: "none",
    theme: "blue",
  });
  assert.deepEqual(mascot.layers.map((layer) => layer.asset), ["/visuals/skin-dolphin.png"]);
});

test("mascot resolver returns skin, outfit, and accessory in visual stacking order", () => {
  const mascot = resolveMascot({ orca_skin: "default", header_style: "space", bottom_style: "cyberpunk" });

  assert.equal(mascot.skin.asset, "/visuals/base-killer-whale.png");
  assert.deepEqual(
    mascot.layers.map((layer) => layer.asset),
    ["/visuals/base-killer-whale.png", "/visuals/outfit-cyberpunk.png", "/visuals/hat-space.png"]
  );
});

test("character customization uses aligned visual assets and includes the dolphin as a skin", () => {
  const [skins, headers, outfits] = CUSTOMIZATION_GROUPS;

  assert.equal(skins.label, "Скін");
  assert.equal(skins.options.find((option) => option.id === "default").asset, "/visuals/base-killer-whale.png");
  assert.equal(skins.options.find((option) => option.id === "dolphin").asset, "/visuals/skin-dolphin.png");
  assert.equal(headers.options.find((option) => option.id === "none").asset, null);
  assert.equal(outfits.options.find((option) => option.id === "none").asset, null);
  assert.ok(headers.options.filter((option) => option.asset).every((option) => option.asset.startsWith("/visuals/hat-")));
  assert.ok(outfits.options.filter((option) => option.asset).every((option) => option.asset.startsWith("/visuals/outfit-")));
  assert.ok(outfits.options.some((option) => option.id === "cyberpunk"));
});

test("applying customization updates root attributes used by the existing UI", () => {
  const root = { dataset: {} };
  const applied = applyCustomization(
    { orca_skin: "default", header_style: "hawaii", bottom_style: "space", theme: "sunset" },
    root
  );

  assert.deepEqual(applied, { orca_skin: "default", header_style: "hawaii", bottom_style: "space", theme: "sunset" });
  assert.deepEqual(root.dataset, {
    orcaSkin: "default",
    headerStyle: "hawaii",
    bottomStyle: "space",
    theme: "sunset",
  });
});
