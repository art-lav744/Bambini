import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import AppIcon from "../components/AppIcon.jsx";
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
  const [achievementSummary, setAchievementSummary] = useState({ unlocked_count: 0, total_count: 0, achievements: [] });
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
        const achievements = await api.getAchievements(user.id);
        const saved = await api.getCustomization(user.id);
        if (!active) return;
        setUserId(user.id);
        setAchievementSummary(achievements);
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
    const requirement = achievementSummary.achievements.find(
      (achievement) => achievement.reward_field === group.id && achievement.reward_value === option.id
    );
    const lockedByAchievement = Boolean(requirement && !requirement.unlocked);
    const lockedByDolphin = customization.orca_skin === "dolphin" && ["header_style", "bottom_style"].includes(group.id);
    const locked = lockedByAchievement || lockedByDolphin;
    const progressValue = requirement ? requirement.progress : 1;
    const progressTarget = requirement ? requirement.target : 1;
    const progressPercent = Math.min(100, Math.round((progressValue / progressTarget) * 100));
    const remaining = requirement ? Math.max(0, progressTarget - progressValue) : 0;
    const lockTitle = lockedByDolphin
      ? "Для бази «Дельфін» шолом і костюм недоступні"
      : lockedByAchievement
        ? `${requirement.description}: досягнення «${requirement.title}»`
        : undefined;
    return (
      <button
        key={option.id}
        type="button"
        className={`customization-option${selected ? " is-active" : ""}${locked ? " is-locked" : ""}`}
        aria-pressed={selected}
        disabled={loading || saving || locked}
        title={lockTitle}
        onClick={() => selectOption(group.id, option.id)}
      >
        <span
          className={`customization-option__preview${option.background ? ` mascot-background--${option.id}` : ""}`}
          aria-hidden="true"
        >
          {option.asset
            ? <img src={option.asset} alt="" />
            : <AppIcon name={option.background ? "image" : "empty"} className="customization-option__empty" />}
        </span>
        <span className="customization-option__copy">
          <strong>{option.name}</strong>
          <small>{requirement ? requirement.description : "Доступно одразу"}</small>
          {requirement && (
            <>
              <span className="cosmetic-progress__meta">
                <span>{remaining ? `Залишилося: ${remaining}` : "Відкрито"}</span>
                <span>{progressValue}/{progressTarget}</span>
              </span>
              <span
                className="cosmetic-progress"
                role="progressbar"
                aria-label={`Прогрес для ${option.name}`}
                aria-valuemin="0"
                aria-valuemax={progressTarget}
                aria-valuenow={progressValue}
              >
                <span style={{ width: `${progressPercent}%` }} />
              </span>
            </>
          )}
        </span>
        <span className="customization-option__check">
          {lockedByAchievement ? <AppIcon name="lock" /> : selected ? <AppIcon name="check" /> : null}
        </span>
      </button>
    );
  }

  return (
    <main className="main-tab-page customization-page">
      <div className="tab-page__content">
        <Link className="back-link customization-back-link" to="/profile">
          <AppIcon name="arrow-left" />
          <span>Назад до профілю</span>
        </Link>
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
                    <span className="theme-option__symbol" aria-hidden="true"><AppIcon name={theme.icon} /></span>
                    <span>{theme.name}</span>
                    <span className="customization-option__check">{selected ? <AppIcon name="check" /> : null}</span>
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
