import assert from "node:assert/strict";
import test from "node:test";

import { CUSTOMIZATION_GROUPS, THEMES } from "../../src/customization.js";
import { eventTagLabel, EVENT_TAG_OPTIONS } from "../../src/eventTags.js";
import { formatEventDateTime } from "../../src/eventFormat.js";
import {
  getLanguage,
  localizeAchievement,
  localizeApiMessage,
  localeForLanguage,
  setLanguage,
  translate,
} from "../../src/i18n.js";
import { formatEventDistance } from "../../src/mapMath.js";

test("language selection defaults to Ukrainian and can switch to English", () => {
  setLanguage("uk");
  assert.equal(getLanguage(), "uk");
  assert.equal(translate("Події", "Events"), "Події");
  assert.equal(localeForLanguage(), "uk-UA");

  setLanguage("en");
  assert.equal(getLanguage(), "en");
  assert.equal(translate("Події", "Events"), "Events");
  assert.equal(localeForLanguage(), "en-GB");
  setLanguage("uk");
});

test("shared event and customization catalogs have English labels", () => {
  assert.equal(eventTagLabel("football", "en"), "Football");
  assert.equal(eventTagLabel("music-concert", "en"), "Concerts and live music");
  assert.ok(EVENT_TAG_OPTIONS.every((tag) => eventTagLabel(tag.value, "en")));
  assert.ok(CUSTOMIZATION_GROUPS.every((group) => group.labelEn && group.descriptionEn));
  assert.ok(CUSTOMIZATION_GROUPS.flatMap((group) => group.options).every((option) => option.nameEn));
  assert.ok(THEMES.every((theme) => theme.nameEn));
});

test("dates, distances, achievements and API errors are localized", () => {
  assert.match(formatEventDateTime("2026-07-19T12:30:00Z", null, "en"), /12:30|13:30|14:30|15:30/);
  assert.equal(formatEventDistance(1250, "en"), "1.3 km");
  assert.equal(localizeApiMessage("Код друга не знайдено", "en"), "Friend code not found");
  assert.equal(localizeApiMessage("Невірний код. Залишилося спроб: 3", "en"), "Invalid code. Attempts remaining: 3");
  assert.deepEqual(
    localizeAchievement({ id: "first-alliance", category: "friends", title: "Перший Союз", description: "Додати 1 друга", target: 1 }, "en"),
    { id: "first-alliance", category: "friends", title: "First Alliance", description: "Add 1 friend", target: 1 },
  );
});
