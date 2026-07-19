import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import AppIcon from "../components/AppIcon.jsx";
import BottomNav from "../components/BottomNav.jsx";
import MascotPreview from "../components/MascotPreview.jsx";
import { DEFAULT_CUSTOMIZATION, normalizeCustomization } from "../customization.js";
import { LANGUAGE_OPTIONS, localizeApiMessage, useI18n } from "../i18n.js";
import { ensureCurrentUser, saveCurrentUser, signOut } from "../userSession.js";

function initials(name = "?") {
  return name.trim().slice(0, 2).toUpperCase();
}

const LOCATION_OPTIONS = [
  { value: "none", title: "Ніхто", titleEn: "Nobody", description: "Позиція не надсилається на сервер.", descriptionEn: "Your position is not sent to the server." },
  { value: "friends", title: "Друзі", titleEn: "Friends", description: "Позицію бачать прийняті друзі та учасники тієї самої події, коли ви обоє біля неї.", descriptionEn: "Accepted friends and participants of the same nearby event can see your position." },
  { value: "everyone", title: "Усі", titleEn: "Everyone", description: "Інші користувачі бачать приблизну актуальну позицію.", descriptionEn: "Other users can see your approximate current position." },
];

function currentVisibility(user) {
  if (!user) return "none";
  return user.location_visibility || (user.location_sharing_enabled ? "friends" : "none");
}

export default function ProfilePage() {
  const { language, setLanguage, tr } = useI18n();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPayload, setPhotoPayload] = useState(undefined);
  const [message, setMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [error, setError] = useState("");
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [customization, setCustomization] = useState(DEFAULT_CUSTOMIZATION);
  const navigate = useNavigate();

  function applyProfile(profile) {
    setUser(profile);
    setName(profile.name);
    setPhotoUrl(profile.photo_url || "");
    setPhotoPayload(undefined);
    saveCurrentUser(profile);
  }

  useEffect(() => {
    let active = true;
    ensureCurrentUser()
      .then(async (profile) => {
        if (!active) return;
        applyProfile(profile);
        const saved = await api.getCustomization(profile.id);
        if (active) setCustomization(normalizeCustomization(saved));
      })
      .catch((err) => {
        if (active) setError(localizeApiMessage(err.message, language));
      });
    return () => {
      active = false;
    };
  }, [language]);

  function selectPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(tr("Оберіть файл зображення.", "Choose an image file."));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(tr("Зображення має бути не більше 2 МБ.", "The image must be no larger than 2 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setPhotoUrl(value);
      setPhotoPayload(value);
      setError("");
    };
    reader.onerror = () => setError(tr("Не вдалося прочитати зображення.", "Could not read the image."));
    reader.readAsDataURL(file);
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;
    setError("");
    setMessage("");
    setProfileMessage("");
    try {
      const payload = { name: name.trim() };
      if (photoPayload !== undefined) payload.photo_url = photoPayload;
      applyProfile(await api.updateUser(user.id, payload));
      setProfileMessage(tr("Профіль збережено", "Profile saved"));
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    }
  }

  async function changeLocationVisibility(visibility) {
    if (!user || savingVisibility || visibility === currentVisibility(user)) return;
    setError("");
    setMessage("");
    setProfileMessage("");
    setSavingVisibility(true);
    try {
      const updated = await api.setLocationVisibility(user.id, visibility);
      applyProfile(updated);
      const selected = LOCATION_OPTIONS.find((item) => item.value === visibility);
      setMessage(tr(`Видимість геолокації: ${selected?.title || visibility}`, `Location visibility: ${selected?.titleEn || visibility}`));
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setSavingVisibility(false);
    }
  }

  async function copyValue(value, fallbackMessage) {
    setProfileMessage("");
    try {
      await navigator.clipboard.writeText(value);
      setMessage(tr("Код скопійовано", "Code copied"));
    } catch {
      setMessage(fallbackMessage);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const visibility = currentVisibility(user);

  return (
    <main className="main-tab-page">
      <div className="tab-page__content">
        <div className="profile-hero">
          <div className="profile-identity">
            <div className="profile-avatar profile-avatar--photo">
              {photoUrl ? <img src={photoUrl} alt={name || tr("Користувач", "User")} referrerPolicy="no-referrer" /> : initials(name || user?.name)}
            </div>
            <div><div className="eyebrow">{tr("Профіль", "Profile")}</div><h1>{user?.name || tr("Завантаження...", "Loading...")}</h1></div>
          </div>
          <MascotPreview customization={customization} className="profile-mascot" />
        </div>

        <button className="event-action-card profile-style-button" type="button" onClick={() => navigate("/customization")}>
          <span className="event-action-card__symbol" aria-hidden="true"><AppIcon name="palette" /></span>
          <div><strong>{tr("Стиль", "Style")}</strong><span>{tr("Змінити персонажа та тему застосунку", "Change your mascot and app theme")}</span></div>
          <span className="profile-style-button__arrow" aria-hidden="true"><AppIcon name="arrow-right" /></span>
        </button>

        {user && (
          <>
            <button className="friend-code-card" type="button" onClick={() => copyValue(user.friend_code, tr(`Код друга: ${user.friend_code}`, `Friend code: ${user.friend_code}`))}>
              <span>{tr("Публічний код для додавання в друзі", "Public code for adding friends")}</span><strong>{user.friend_code}</strong><small>{tr("Його можна безпечно дати друзям", "You can safely share it with friends")}</small>
            </button>

            <section className="settings-card location-visibility-card">
              <div className="location-visibility-card__heading"><strong>{tr("Мова", "Language")}</strong><span>{tr("Мова інтерфейсу зберігається на цьому пристрої.", "The interface language is saved on this device.")}</span></div>
              <div className="segmented-setting language-setting" role="radiogroup" aria-label={tr("Мова інтерфейсу", "Interface language")}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <button key={option.value} type="button" role="radio" aria-checked={language === option.value}
                    className={`segmented-setting__option${language === option.value ? " is-active" : ""}`}
                    onClick={() => setLanguage(option.value)}>
                    <strong>{option.label}</strong><span>{option.shortLabel}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-card location-visibility-card">
              <div className="location-visibility-card__heading"><strong>{tr("Хто бачить мою геолокацію", "Who can see my location")}</strong><span>{tr("Позиція оновлюється лише поки застосунок активний.", "Your position updates only while the app is active.")}</span></div>
              <div className="segmented-setting" role="radiogroup" aria-label={tr("Видимість геолокації", "Location visibility")}>
                {LOCATION_OPTIONS.map((option) => (
                  <button key={option.value} type="button" role="radio" aria-checked={visibility === option.value}
                    className={`segmented-setting__option${visibility === option.value ? " is-active" : ""}`}
                    onClick={() => changeLocationVisibility(option.value)} disabled={savingVisibility}>
                    <strong>{language === "en" ? option.titleEn : option.title}</strong><span>{language === "en" ? option.descriptionEn : option.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <form className="profile-form" onSubmit={saveProfile}>
              <label>{tr("Ім'я", "Name")}<input value={name} onChange={(event) => setName(event.target.value)} minLength="2" required /></label>
              <label>{tr("Фото профілю", "Profile photo")}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => selectPhoto(event.target.files?.[0])} /></label>
              {photoUrl && <button className="button secondary" type="button" onClick={() => { setPhotoUrl(""); setPhotoPayload(""); }}>{tr("Видалити фото", "Remove photo")}</button>}
              <button className="button primary" type="submit">{tr("Зберегти профіль", "Save profile")}</button>
              {profileMessage && <p className="success-message profile-form__message">{profileMessage}</p>}
            </form>

            <div style={{ marginTop: 64, marginBottom: 18 }}>
              <button className="button secondary" type="button" onClick={handleSignOut} style={{ width: "100%", minHeight: 48 }}>{tr("Вийти", "Sign out")}</button>
            </div>
          </>
        )}
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
      <BottomNav />
    </main>
  );
}
