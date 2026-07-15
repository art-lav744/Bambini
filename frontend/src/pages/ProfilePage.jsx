import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import {
  connectExistingUser,
  ensureCurrentUser,
  saveCurrentUser,
} from "../userSession.js";

function initials(name = "?") {
  return name.trim().slice(0, 2).toUpperCase();
}

const LOCATION_OPTIONS = [
  {
    value: "none",
    title: "Ніхто",
    description: "Позиція не надсилається на сервер.",
  },
  {
    value: "friends",
    title: "Друзі",
    description: "Вашу актуальну позицію бачать лише прийняті друзі.",
  },
  {
    value: "everyone",
    title: "Усі",
    description: "Вашу актуальну позицію можуть бачити й користувачі не з друзів.",
  },
];

function currentVisibility(user) {
  if (!user) return "none";
  return user.location_visibility || (user.location_sharing_enabled ? "friends" : "none");
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [connectCode, setConnectCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const navigate = useNavigate();

  function applyProfile(profile) {
    setUser(profile);
    setName(profile.name);
    setPhotoUrl(profile.photo_url || "");
    saveCurrentUser(profile);
  }

  useEffect(() => {
    ensureCurrentUser()
      .then(applyProfile)
      .catch((err) => setError(err.message));
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;

    setError("");
    setMessage("");
    try {
      const updated = await api.updateUser(user.id, {
        name: name.trim(),
        photo_url: photoUrl.trim(),
      });
      applyProfile(updated);
      setMessage("Профіль збережено");
    } catch (err) {
      setError(err.message);
    }
  }

  async function connectProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setConnecting(true);
    try {
      const connected = await connectExistingUser(connectCode);
      applyProfile(connected);
      setConnectCode("");
      setMessage("Цей пристрій підключено до існуючого профілю");
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  async function changeLocationVisibility(visibility) {
    if (!user || savingVisibility || visibility === currentVisibility(user)) return;

    setError("");
    setMessage("");
    setSavingVisibility(true);
    try {
      const updated = await api.setLocationVisibility(user.id, visibility);
      applyProfile(updated);
      const option = LOCATION_OPTIONS.find((item) => item.value === visibility);
      setMessage(`Видимість геолокації: ${option?.title || visibility}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVisibility(false);
    }
  }

  async function copyValue(value, fallbackMessage) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Код скопійовано");
    } catch {
      setMessage(fallbackMessage);
    }
  }

  function handleSignOut() {
    localStorage.removeItem("outdoor_user_id");
    localStorage.removeItem("outdoor_profile_code");
    localStorage.removeItem("player_name");
    navigate("/login", { replace: true });
  }

  const visibility = currentVisibility(user);

  return (
    <main className="main-tab-page">
      <div className="tab-page__content">
        <div className="profile-hero">
          <div className="profile-avatar profile-avatar--photo">
            {photoUrl ? (
              <img src={photoUrl} alt={name || "User"} />
            ) : (
              initials(name || user?.name)
            )}
          </div>
          <div>
            <div className="eyebrow">Профіль</div>
            <h1>{user?.name || "Завантаження..."}</h1>
          </div>
        </div>

        {user && (
          <>
            <button
              className="friend-code-card"
              type="button"
              onClick={() => copyValue(user.friend_code, `Код друга: ${user.friend_code}`)}
            >
              <span>Публічний код для додавання в друзі</span>
              <strong>{user.friend_code}</strong>
              <small>Його можна безпечно дати друзям</small>
            </button>

            <button
              className="friend-code-card profile-sync-card"
              type="button"
              onClick={() => copyValue(user.profile_code, `Код профілю: ${user.profile_code}`)}
            >
              <span>Секретний код профілю</span>
              <strong>{user.profile_code}</strong>
              <small>Введіть його на іншому пристрої. Не передавайте стороннім.</small>
            </button>

            <form className="profile-form" onSubmit={saveProfile}>
              <label>
                Ім'я
                <input value={name} onChange={(event) => setName(event.target.value)} minLength="2" required />
              </label>
              <label>
                URL фото
                <input
                  value={photoUrl}
                  onChange={(event) => setPhotoUrl(event.target.value)}
                  placeholder="https://..."
                  inputMode="url"
                />
              </label>
              <button className="button primary" type="submit">Зберегти профіль</button>
            </form>

            <section className="profile-connect-card">
              <div className="eyebrow">Інший пристрій</div>
              <h2>Відкрити існуючий профіль</h2>
              <p className="muted">
                Введіть секретний код профілю з іншого телефона або комп’ютера.
              </p>
              <form className="friend-add-form" onSubmit={connectProfile}>
                <input
                  value={connectCode}
                  onChange={(event) => setConnectCode(event.target.value.toUpperCase())}
                  placeholder="Секретний код профілю"
                  minLength="12"
                  maxLength="16"
                  required
                />
                <button className="button primary" type="submit" disabled={connecting}>
                  {connecting ? "Підключення..." : "Підключити"}
                </button>
              </form>
            </section>

            <div style={{ marginTop: 64, marginBottom: 18 }}>
              <button className="button secondary" type="button" onClick={handleSignOut} style={{ width: "100%", minHeight: 48 }}>
                Вийти
              </button>
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
