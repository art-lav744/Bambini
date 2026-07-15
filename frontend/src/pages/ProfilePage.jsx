import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import BottomNav from "../components/BottomNav.jsx";
import { ensureCurrentUser, saveCurrentUser } from "../userSession.js";

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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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


            <section className="settings-card location-visibility-card">
              <div className="location-visibility-card__heading">
                <strong>Хто бачить мою геолокацію</strong>
                <span>Позиція на карті оновлюється, поки вебзастосунок активний.</span>
              </div>

              <div
                className="segmented-setting"
                role="radiogroup"
                aria-label="Видимість геолокації"
              >
                {LOCATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={visibility === option.value}
                    className={`segmented-setting__option${
                      visibility === option.value ? " is-active" : ""
                    }`}
                    onClick={() => changeLocationVisibility(option.value)}
                    disabled={savingVisibility}
                  >
                    <strong>{option.title}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </section>

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
