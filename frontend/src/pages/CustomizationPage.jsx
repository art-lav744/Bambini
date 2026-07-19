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
import { localizeAchievement, localizeApiMessage, useI18n } from "../i18n.js";

export default function CustomizationPage() {
  const { language, tr } = useI18n();
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
        if (active) setError(localizeApiMessage(loadError.message, language));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language]);

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
      setMessage(field === "theme" ? tr("Тему збережено", "Theme saved") : tr("Персонажа збережено", "Mascot saved"));
    } catch (saveError) {
      setCustomization(applyCustomization(previous));
      setError(localizeApiMessage(saveError.message, language));
    } finally {
      setSaving(false);
    }
  }

  function optionButton(group, option) {
    const selected = customization[group.id] === option.id;
    const rawRequirement = achievementSummary.achievements.find(
      (achievement) => achievement.reward_field === group.id && achievement.reward_value === option.id
    );
    const requirement = localizeAchievement(rawRequirement, language);
    const lockedByAchievement = Boolean(requirement && !requirement.unlocked);
    const lockedByDolphin = customization.orca_skin === "dolphin" && ["header_style", "bottom_style"].includes(group.id);
    const locked = lockedByAchievement || lockedByDolphin;
    const progressValue = requirement ? requirement.progress : 1;
    const progressTarget = requirement ? requirement.target : 1;
    const progressPercent = Math.min(100, Math.round((progressValue / progressTarget) * 100));
    const remaining = requirement ? Math.max(0, progressTarget - progressValue) : 0;
    const lockTitle = lockedByDolphin
      ? tr("Для бази «Дельфін» шолом і костюм недоступні", "Helmets and suits are unavailable for the Dolphin base")
      : lockedByAchievement
        ? tr(`${requirement.description}: досягнення «${requirement.title}»`, `${requirement.description}: achievement “${requirement.title}”`)
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
          <strong>{language === "en" ? option.nameEn || option.name : option.name}</strong>
          <small>{requirement ? requirement.description : tr("Доступно одразу", "Available immediately")}</small>
          {requirement && (
            <>
              <span className="cosmetic-progress__meta">
                <span>{remaining ? tr(`Залишилося: ${remaining}`, `${remaining} remaining`) : tr("Відкрито", "Unlocked")}</span>
                <span>{progressValue}/{progressTarget}</span>
              </span>
              <span
                className="cosmetic-progress"
                role="progressbar"
                aria-label={tr(`Прогрес для ${option.name}`, `Progress for ${option.nameEn || option.name}`)}
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
          <span>{tr("Назад до профілю", "Back to profile")}</span>
        </Link>
        <section className="customization-hero">
          <div>
            <span className="eyebrow">{tr("Персоналізація", "Customization")}</span>
            <h1>{tr("Ваш стиль", "Your style")}</h1>
            <p className="muted">{tr("Налаштуйте персонажа та тему Bambini.", "Customize your Bambini mascot and theme.")}</p>
          </div>
          <MascotPreview customization={customization} />
        </section>

        <nav className="customization-tabs" aria-label={tr("Розділи персоналізації", "Customization sections")}>
          <button
            type="button"
            className={activePage === "character" ? "is-active" : ""}
            onClick={() => setActivePage("character")}
          >
            {tr("Персонаж", "Mascot")}
          </button>
          <button
            type="button"
            className={activePage === "theme" ? "is-active" : ""}
            onClick={() => setActivePage("theme")}
          >
            {tr("Тема", "Theme")}
          </button>
        </nav>

        {activePage === "character" ? (
          <div className="customization-character" aria-busy={loading || saving}>
            {CUSTOMIZATION_GROUPS.map((group) => (
              <section key={group.id} className="customization-section">
                <div className="customization-section__heading">
                  <div>
                    <span className="eyebrow">{language === "en" ? group.labelEn : group.label}</span>
                    <h2>{tr("Оберіть варіант", "Choose an option")}</h2>
                  </div>
                  {saving && <span className="customization-saving">{tr("Збереження…", "Saving…")}</span>}
                </div>
                <p className="muted">{language === "en" ? group.descriptionEn : group.description}</p>
                {customization.orca_skin === "dolphin" && group.id === "header_style" && (
                  <p className="customization-lock-note">{tr("Для бази «Дельфін» шолом і костюм автоматично вимкнені.", "Helmets and suits are automatically disabled for the Dolphin base.")}</p>
                )}
                <div className="customization-grid">{group.options.map((option) => optionButton(group, option))}</div>
              </section>
            ))}
          </div>
        ) : (
          <section className="customization-section" aria-busy={loading || saving}>
            <div className="customization-section__heading">
              <div>
                <span className="eyebrow">{tr("Тема", "Theme")}</span>
                <h2>{tr("Кольори застосунку", "App colours")}</h2>
              </div>
              {saving && <span className="customization-saving">{tr("Збереження…", "Saving…")}</span>}
            </div>
            <p className="muted">{tr("Оберіть одну з тем у папці themes.", "Choose one of the available themes.")}</p>
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
                    <span>{language === "en" ? theme.nameEn : theme.name}</span>
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
