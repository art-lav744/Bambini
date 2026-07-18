import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src");
const TEXT_ICON_GLYPHS = /[←→↑↓↗↘✕×✓∅◐◑≈●◆☼✦♣◎]/u;

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(?:js|jsx)$/.test(name) ? [path] : [];
  });
}

test("frontend icons use SVG instead of font-dependent text glyphs", () => {
  const offenders = sourceFiles(SOURCE_ROOT)
    .filter((path) => TEXT_ICON_GLYPHS.test(readFileSync(path, "utf8")));
  assert.deepEqual(offenders, []);
});
