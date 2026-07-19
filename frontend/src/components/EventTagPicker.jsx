import { EVENT_TAG_OPTIONS, eventTagLabel, normalizeEventTags, toggleEventTag } from "../eventTags.js";
import { useI18n } from "../i18n.js";

export default function EventTagPicker({ value, onChange, max = 5 }) {
  const { language, tr } = useI18n();
  const selected = normalizeEventTags(value, max);
  const atLimit = selected.length >= max;

  return (
    <section className="event-tag-picker" aria-label={tr("Теги події", "Event tags")}>
      <div className="event-tag-picker__heading">
        <strong>{tr("Теги", "Tags")}</strong>
        <span>{selected.length}/{max}</span>
      </div>
      <div className="event-tag-picker__options">
        {EVENT_TAG_OPTIONS.map((tag) => {
          const active = selected.includes(tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              className={active ? "is-active" : ""}
              aria-pressed={active}
              disabled={!active && atLimit}
              onClick={() => onChange(toggleEventTag(selected, tag.value, max))}
            >
              {eventTagLabel(tag.value, language)}
            </button>
          );
        })}
      </div>
      <span className="field-hint">{tr(`Оберіть до ${max} тегів`, `Choose up to ${max} tags`)}</span>
    </section>
  );
}
