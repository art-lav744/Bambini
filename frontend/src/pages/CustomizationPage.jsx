import { useEffect, useState } from "react";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import MascotPreview from "../components/MascotPreview.jsx";
import {
  applyCustomization,
  CUSTOMIZATION_GROUPS,
  DEFAULT_CUSTOMIZATION,
  normalizeCustomization,
  THEMES,
} from "../customization.js";
import { ensureCurrentUser } from "../userSession.js";

export default function CustomizationPage() {
  const [customization, setCustomization] = useState(DEFAULT_CUSTOMIZATION);
  const [activePage, setActivePage] = useState("character");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    ensureCurrentUser()
      .then(async (user) => {
        const saved = await api.getCustomization(user.id);
        if (!active) return;
        setUserId(user.id);
        setCustomization(applyCustomization(saved));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function selectOption(field, optionId) {
    if (!userId || saving || customization[field] === optionId) return;
    const previous = customization;
    const next = normalizeCustomization({ ...customization, [field]: optionId });
    setCustomization(applyCustomization(next));
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = await api.updateCustomization(userId, next);
      setCustomization(applyCustomization(saved));
      setMessage(field === "theme" ? "Тему збережено" : "Персонажа збережено");
    } catch (saveError) {
      setCustomization(applyCustomization(previous));
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function optionButton(group, option) {
    const selected = customization[group.id] === option.id;
    const lockedByDolphin = customization.orca_skin === "dolphin" && group.id !== "orca_skin";
    return (
      <button
        key={option.id}
        type="button"
        className={`customization-option${selected ? " is-active" : ""}${lockedByDolphin ? " is-locked" : ""}`}
        aria-pressed={selected}
        disabled={loading || saving || lockedByDolphin}
        title={lockedByDolphin ? "Для бази «Дельфін» шолом і костюм недоступні" : undefined}
        onClick={() => selectOption(group.id, option.id)}
      >
        <span className="customization-option__preview" aria-hidden="true">
          {option.asset ? <img src={option.asset} alt="" /> : <span className="customization-option__empty">∅</span>}
        </span>
        <span>{option.name}</span>
        <span className="customization-option__check">{selected ? "✓" : ""}</span>
      </button>
    );
  }

  return (
    <main className="main-tab-page customization-page">
      <div className="tab-page__content">
        <section className="customization-hero">
          <div>
            <span className="eyebrow">Персоналізація</span>
            <h1>Ваш стиль</h1>
            <p className="muted">Налаштуйте персонажа та тему Bambini.</p>
          </div>
          <MascotPreview customization={customization} />
        </section>

        <nav className="customization-tabs" aria-label="Розділи персоналізації">
          <button
            type="button"
            className={activePage === "character" ? "is-active" : ""}
            onClick={() => setActivePage("character")}
          >
            Персонаж
          </button>
          <button
            type="button"
            className={activePage === "theme" ? "is-active" : ""}
            onClick={() => setActivePage("theme")}
          >
            Тема
          </button>
        </nav>

        {activePage === "character" ? (
          <div className="customization-character" aria-busy={loading || saving}>
            {CUSTOMIZATION_GROUPS.map((group) => (
              <section key={group.id} className="customization-section">
                <div className="customization-section__heading">
                  <div>
                    <span className="eyebrow">{group.label}</span>
                    <h2>Оберіть варіант</h2>
                  </div>
                  {saving && <span className="customization-saving">Збереження…</span>}
                </div>
                <p className="muted">{group.description}</p>
                {customization.orca_skin === "dolphin" && group.id === "header_style" && (
                  <p className="customization-lock-note">Для бази «Дельфін» шолом і костюм автоматично вимкнені.</p>
                )}
                <div className="customization-grid">{group.options.map((option) => optionButton(group, option))}</div>
              </section>
            ))}
          </div>
        ) : (
          <section className="customization-section" aria-busy={loading || saving}>
            <div className="customization-section__heading">
              <div>
                <span className="eyebrow">Тема</span>
                <h2>Кольори застосунку</h2>
              </div>
              {saving && <span className="customization-saving">Збереження…</span>}
            </div>
            <p className="muted">Оберіть одну з тем у папці themes.</p>
            <div className="theme-grid">
              {THEMES.map((theme) => {
                const selected = customization.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-option theme-preview${selected ? " is-active" : ""}`}
                    data-theme={theme.id}
                    aria-pressed={selected}
                    disabled={loading || saving}
                    onClick={() => selectOption("theme", theme.id)}
                  >
                    <span className="theme-option__symbol" aria-hidden="true">{theme.symbol}</span>
                    <span>{theme.name}</span>
                    <span className="customization-option__check">{selected ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {message && <p className="success-message customization-message">{message}</p>}
        {error && <p className="error-message customization-message">{error}</p>}
      </div>
      <BottomNav />
    </main>
  );
}
