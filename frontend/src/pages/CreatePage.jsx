import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import EventLocationPicker from "../components/EventLocationPicker.jsx";
import { ensureCurrentUser } from "../userSession.js";

export default function CreatePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", is_public: true });
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ensureCurrentUser().then(setUser).catch((err) => setError(err.message));
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!user) {
      setError("Профіль ще завантажується.");
      return;
    }
    if (!location) {
      setError("Виберіть одну точку події на карті.");
      return;
    }

    setLoading(true);
    try {
      const activity = await api.createActivity({
        ...form,
        user_id: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      navigate(`/room/${activity.code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-page event-form-page">
      <Link className="back-link" to="/events">← Назад до подій</Link>
      <section className="card form-card event-create-card">
        <div className="eyebrow">Нова подія</div>
        <h1>Створити подію</h1>
        <p className="muted">
          Організатор: <strong>{user?.name || "завантаження…"}</strong>. Подія має одну точку на карті.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Назва події
            <input
              name="title"
              value={form.title}
              onChange={updateField}
              minLength="3"
              required
            />
          </label>

          <label>
            Опис
            <textarea
              name="description"
              value={form.description}
              onChange={updateField}
              rows="3"
            />
          </label>

          <fieldset className="event-privacy-field">
            <legend>Доступ до події</legend>
            <div className="event-privacy-options">
              <button
                type="button"
                className={`event-privacy-option${form.is_public ? " is-active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, is_public: true }))}
              >
                <strong>Публічна</strong>
                <span>Видима у списку публічних подій. Приєднатися може будь-який користувач.</span>
              </button>
              <button
                type="button"
                className={`event-privacy-option${!form.is_public ? " is-active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, is_public: false }))}
              >
                <strong>Приватна</strong>
                <span>Не показується у публічному списку. Приєднання лише за кодом.</span>
              </button>
            </div>
          </fieldset>

          <div className="event-location-field">
            <span className="event-location-field__label">Точка події</span>
            <p className="muted">Натисніть один раз на карту або використайте свою позицію.</p>
            <EventLocationPicker value={location} onChange={setLocation} />
            {location && (
              <small className="event-coordinates">
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </small>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          <button className="button primary" disabled={loading || !user}>
            {loading ? "Створення..." : "Створити подію"}
          </button>
        </form>
      </section>
    </main>
  );
}
