import { EVENT_TAG_OPTIONS, normalizeEventTags, toggleEventTag } from "../eventTags.js";

export default function EventTagPicker({ value, onChange, max = 5 }) {
  const selected = normalizeEventTags(value, max);
  const atLimit = selected.length >= max;

  return (
    <section className="event-tag-picker" aria-label="Теги події">
      <div className="event-tag-picker__heading">
        <strong>Теги</strong>
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
              {tag.label}
            </button>
          );
        })}
      </div>
      <span className="field-hint">Оберіть до {max} тегів</span>
    </section>
  );
}
