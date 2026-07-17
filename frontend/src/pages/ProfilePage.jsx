import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import { ensureCurrentUser, saveCurrentUser, signOut } from "../userSession.js";

function initials(name = "?") {
  return name.trim().slice(0, 2).toUpperCase();
}

const LOCATION_OPTIONS = [
  { value: "none", title: "Ніхто", description: "Позиція не надсилається на сервер." },
  { value: "friends", title: "Друзі", description: "Позицію бачать прийняті друзі та учасники тієї самої події, коли ви обоє біля неї." },
  { value: "everyone", title: "Усі", description: "Інші користувачі бачать приблизну актуальну позицію." },
];

function currentVisibility(user) {
  if (!user) return "none";
  return user.location_visibility || (user.location_sharing_enabled ? "friends" : "none");
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPayload, setPhotoPayload] = useState(undefined);
  const [message, setMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [error, setError] = useState("");
  const [savingVisibility, setSavingVisibility] = useState(false);
  const navigate = useNavigate();

  function applyProfile(profile) {
    setUser(profile);
    setName(profile.name);
    setPhotoUrl(profile.photo_url || "");
    setPhotoPayload(undefined);
    saveCurrentUser(profile);
  }

  useEffect(() => {
    ensureCurrentUser().then(applyProfile).catch((err) => setError(err.message));
  }, []);

  function selectPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Оберіть файл зображення.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Зображення має бути не більше 2 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setPhotoUrl(value);
      setPhotoPayload(value);
      setError("");
    };
    reader.onerror = () => setError("Не вдалося прочитати зображення.");
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
      setProfileMessage("Профіль збережено");
    } catch (err) {
      setError(err.message);
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
      setMessage(`Видимість геолокації: ${LOCATION_OPTIONS.find((item) => item.value === visibility)?.title || visibility}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVisibility(false);
    }
  }

  async function copyValue(value, fallbackMessage) {
    setProfileMessage("");
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Код скопійовано");
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
          <div className="profile-avatar profile-avatar--photo">
            {photoUrl ? <img src={photoUrl} alt={name || "Користувач"} referrerPolicy="no-referrer" /> : initials(name || user?.name)}
          </div>
          <div><div className="eyebrow">Профіль</div><h1>{user?.name || "Завантаження..."}</h1></div>
        </div>

        {user && (
          <>
            <button className="friend-code-card" type="button" onClick={() => copyValue(user.friend_code, `Код друга: ${user.friend_code}`)}>
              <span>Публічний код для додавання в друзі</span><strong>{user.friend_code}</strong><small>Його можна безпечно дати друзям</small>
            </button>

            <section className="settings-card location-visibility-card">
              <div className="location-visibility-card__heading"><strong>Хто бачить мою геолокацію</strong><span>Позиція оновлюється лише поки застосунок активний.</span></div>
              <div className="segmented-setting" role="radiogroup" aria-label="Видимість геолокації">
                {LOCATION_OPTIONS.map((option) => (
                  <button key={option.value} type="button" role="radio" aria-checked={visibility === option.value}
                    className={`segmented-setting__option${visibility === option.value ? " is-active" : ""}`}
                    onClick={() => changeLocationVisibility(option.value)} disabled={savingVisibility}>
                    <strong>{option.title}</strong><span>{option.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <form className="profile-form" onSubmit={saveProfile}>
              <label>Ім'я<input value={name} onChange={(event) => setName(event.target.value)} minLength="2" required /></label>
              <label>Фото профілю<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => selectPhoto(event.target.files?.[0])} /></label>
              {photoUrl && <button className="button secondary" type="button" onClick={() => { setPhotoUrl(""); setPhotoPayload(""); }}>Видалити фото</button>}
              <button className="button primary" type="submit">Зберегти профіль</button>
              {profileMessage && <p className="success-message profile-form__message">{profileMessage}</p>}
            </form>

            <div style={{ marginTop: 64, marginBottom: 18 }}>
              <button className="button secondary" type="button" onClick={handleSignOut} style={{ width: "100%", minHeight: 48 }}>Вийти</button>
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
