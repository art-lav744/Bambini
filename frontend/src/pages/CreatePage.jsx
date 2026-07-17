import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import EventLocationPicker from "../components/EventLocationPicker.jsx";
import EventTagPicker from "../components/EventTagPicker.jsx";
import { ensureCurrentUser } from "../userSession.js";
import { defaultEventEndTime, defaultEventStartTime, localDateTimeToUtc } from "../eventFormat.js";
import EventPinPreview, { EVENT_PINS } from "../components/EventPinPreview.jsx";

export default function CreatePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: [],
    visibility: "public",
    image_url: "",
    capacity: null,
    pin_type: "default",
    start_time: defaultEventStartTime(),
    end_time: defaultEventEndTime(),
  });
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    ensureCurrentUser().then(setUser).catch((err) => setError(err.message));
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleImageFile(file) {
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
    reader.onload = () => setForm((current) => ({ ...current, image_url: String(reader.result || "") }));
    reader.onerror = () => setError("Не вдалося прочитати зображення.");
    reader.readAsDataURL(file);
  }

  function setCapacity(value) {
    const numeric = Number(value);
    setForm((current) => ({ ...current, capacity: Number.isFinite(numeric) && numeric > 0 ? numeric : null }));
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
        start_time: localDateTimeToUtc(form.start_time),
        end_time: localDateTimeToUtc(form.end_time),
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

          <EventTagPicker
            value={form.tags}
            onChange={(tags) => setForm((current) => ({ ...current, tags }))}
          />

          <label>
            Час початку
            <input
              type="datetime-local"
              name="start_time"
              value={form.start_time}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Час завершення
            <input
              type="datetime-local"
              name="end_time"
              value={form.end_time}
              min={form.start_time}
              onChange={updateField}
              required
            />
          </label>

          <section className="event-form-section">
            <div className="event-form-section__heading">
              <strong>Кількість учасників</strong>
              <span>Необов’язково</span>
            </div>
            <label className="capacity-toggle">
              <input
                type="checkbox"
                checked={form.capacity !== null}
                onChange={(event) => setCapacity(event.target.checked ? 8 : "")}
              />
              Обмежити кількість місць
            </label>
            {form.capacity !== null && (
              <div className="capacity-control">
                <div className="capacity-control__value">{form.capacity} ос.</div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={form.capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  aria-label="Кількість учасників від 1 до 50"
                />
              </div>
            )}
          </section>

          <section className="event-form-section">
            <div className="event-form-section__heading">
              <strong>Зображення події</strong>
              <span>Необов’язково</span>
            </div>
            <label
              className={`event-upload-zone${isDragging ? " is-dragging" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleImageFile(event.dataTransfer.files[0]); }}
            >
              <input type="file" accept="image/*" onChange={(event) => handleImageFile(event.target.files[0])} />
              <span className="event-upload-zone__icon">＋</span>
              <strong>Перетягніть фото сюди</strong>
              <span>або натисніть, щоб вибрати файл до 2 МБ</span>
            </label>
            {form.image_url && (
              <div className="event-image-preview event-image-preview--editable">
                <img src={form.image_url} alt="Попередній перегляд події" />
                <button type="button" onClick={() => setForm((current) => ({ ...current, image_url: "" }))}>Видалити фото</button>
              </div>
            )}
          </section>

          <section className="event-form-section">
            <div className="event-form-section__heading">
              <strong>Позначка на карті</strong>
              <span>Оберіть стиль</span>
            </div>
            <div className="event-pin-grid" role="radiogroup" aria-label="Стиль позначки події">
              {EVENT_PINS.map((pin) => (
                <button key={pin.id} type="button" role="radio" aria-checked={form.pin_type === pin.id} className={`event-pin-option${form.pin_type === pin.id ? " is-active" : ""}`} onClick={() => setForm((current) => ({ ...current, pin_type: pin.id }))}>
                  <EventPinPreview type={pin.id} capacity={form.capacity} current={1} imageUrl={form.image_url} />
                  <span>{pin.label}</span>
                </button>
              ))}
            </div>
          </section>

          <fieldset className="event-privacy-field">
            <legend>Доступ до події</legend>
            <div className="event-privacy-options">
              <button
                type="button"
                className={`event-privacy-option${form.visibility === "public" ? " is-active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, visibility: "public" }))}
              >
                <strong>Публічна</strong>
                <span>Видима всім користувачам. Приєднатися може будь-хто.</span>
              </button>
              <button
                type="button"
                className={`event-privacy-option${form.visibility === "friends" ? " is-active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, visibility: "friends" }))}
              >
                <strong>Лише друзі</strong>
                <span>Видима друзям організатора. Приєднатися можуть лише друзі.</span>
              </button>
              <button
                type="button"
                className={`event-privacy-option${form.visibility === "private" ? " is-active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, visibility: "private" }))}
              >
                <strong>Приватна</strong>
                <span>Не показується у списках. Приєднання лише за кодом.</span>
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
