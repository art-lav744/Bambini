import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import AppIcon from "../components/AppIcon.jsx";
import EventLocationPicker from "../components/EventLocationPicker.jsx";
import EventTagPicker from "../components/EventTagPicker.jsx";
import { ensureCurrentUser } from "../userSession.js";
import { defaultEventEndTime, defaultEventStartTime, localDateTimeToUtc } from "../eventFormat.js";
import EventPinPreview, { EVENT_PINS } from "../components/EventPinPreview.jsx";
import { localizeApiMessage, useI18n } from "../i18n.js";

export default function CreatePage() {
  const { language, tr } = useI18n();
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
    ensureCurrentUser().then(setUser).catch((err) => setError(localizeApiMessage(err.message, language)));
  }, [language]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleImageFile(file) {
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
    reader.onload = () => setForm((current) => ({ ...current, image_url: String(reader.result || "") }));
    reader.onerror = () => setError(tr("Не вдалося прочитати зображення.", "Could not read the image."));
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
      setError(tr("Профіль ще завантажується.", "Your profile is still loading."));
      return;
    }
    if (!location) {
      setError(tr("Виберіть одну точку події на карті.", "Choose one event location on the map."));
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
      setError(localizeApiMessage(err.message, language));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-page event-form-page">
      <Link className="back-link" to="/events"><AppIcon name="arrow-left" /><span>{tr("Назад до подій", "Back to events")}</span></Link>
      <section className="card form-card event-create-card">
        <div className="eyebrow">{tr("Нова подія", "New event")}</div>
        <h1>{tr("Створити подію", "Create event")}</h1>
        <p className="muted">
          {tr("Організатор:", "Host:")} <strong>{user?.name || tr("завантаження…", "loading…")}</strong>. {tr("Подія має одну точку на карті.", "The event has one location on the map.")}
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            {tr("Назва події", "Event name")}
            <input
              name="title"
              value={form.title}
              onChange={updateField}
              minLength="3"
              required
            />
          </label>

          <label>
            {tr("Опис", "Description")}
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
            {tr("Час початку", "Start time")}
            <input
              type="datetime-local"
              name="start_time"
              value={form.start_time}
              onChange={updateField}
              required
            />
          </label>

          <label>
            {tr("Час завершення", "End time")}
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
              <strong>{tr("Кількість учасників", "Number of participants")}</strong>
              <span>{tr("Необов’язково", "Optional")}</span>
            </div>
            <label className="capacity-toggle">
              <input
                type="checkbox"
                checked={form.capacity !== null}
                onChange={(event) => setCapacity(event.target.checked ? 8 : "")}
              />
              {tr("Обмежити кількість місць", "Limit available places")}
            </label>
            {form.capacity !== null && (
              <div className="capacity-control">
                <div className="capacity-control__value">{form.capacity} {tr("ос.", "people")}</div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={form.capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  aria-label={tr("Кількість учасників від 1 до 50", "Number of participants from 1 to 50")}
                />
              </div>
            )}
          </section>

          <section className="event-form-section">
            <div className="event-form-section__heading">
              <strong>{tr("Зображення події", "Event image")}</strong>
              <span>{tr("Необов’язково", "Optional")}</span>
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
              <strong>{tr("Перетягніть фото сюди", "Drag a photo here")}</strong>
              <span>{tr("або натисніть, щоб вибрати файл до 2 МБ", "or click to choose a file up to 2 MB")}</span>
            </label>
            {form.image_url && (
              <div className="event-image-preview event-image-preview--editable">
                <img src={form.image_url} alt={tr("Попередній перегляд події", "Event preview")} />
                <button type="button" onClick={() => setForm((current) => ({ ...current, image_url: "" }))}>{tr("Видалити фото", "Remove photo")}</button>
              </div>
            )}
          </section>

          <section className="event-form-section">
            <div className="event-form-section__heading">
              <strong>{tr("Позначка на карті", "Map pin")}</strong>
              <span>{tr("Оберіть стиль", "Choose a style")}</span>
            </div>
            <div className="event-pin-grid" role="radiogroup" aria-label={tr("Стиль позначки події", "Event pin style")}>
              {EVENT_PINS.map((pin) => (
                <button key={pin.id} type="button" role="radio" aria-checked={form.pin_type === pin.id} className={`event-pin-option${form.pin_type === pin.id ? " is-active" : ""}`} onClick={() => setForm((current) => ({ ...current, pin_type: pin.id }))}>
                  <EventPinPreview type={pin.id} capacity={form.capacity} current={1} imageUrl={form.image_url} />
                  <span>{language === "en" ? pin.labelEn : pin.label}</span>
                </button>
              ))}
            </div>
          </section>

          <fieldset className="event-privacy-field">
            <legend>{tr("Доступ до події", "Event access")}</legend>
            <div className="event-privacy-options">
              <button
                type="button"
                className={`event-privacy-option${form.visibility === "public" ? " is-active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, visibility: "public" }))}
              >
                <strong>{tr("Публічна", "Public")}</strong>
                <span>{tr("Видима всім користувачам. Приєднатися може будь-хто.", "Visible to all users. Anyone can join.")}</span>
              </button>
              <button
                type="button"
                className={`event-privacy-option${form.visibility === "friends" ? " is-active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, visibility: "friends" }))}
              >
                <strong>{tr("Лише друзі", "Friends only")}</strong>
                <span>{tr("Видима друзям організатора. Приєднатися можуть лише друзі.", "Visible to the host's friends. Only friends can join.")}</span>
              </button>
              <button
                type="button"
                className={`event-privacy-option${form.visibility === "private" ? " is-active" : ""}`}
                onClick={() => setForm((current) => ({ ...current, visibility: "private" }))}
              >
                <strong>{tr("Приватна", "Private")}</strong>
                <span>{tr("Не показується у списках. Приєднання лише за кодом.", "Hidden from lists. Join using the event code only.")}</span>
              </button>
            </div>
          </fieldset>

          <div className="event-location-field">
            <span className="event-location-field__label">{tr("Точка події", "Event location")}</span>
            <p className="muted">{tr("Натисніть один раз на карту або використайте свою позицію.", "Click once on the map or use your current position.")}</p>
            <EventLocationPicker value={location} onChange={setLocation} />
            {location && (
              <small className="event-coordinates">
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </small>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          <button className="button primary" disabled={loading || !user}>
            {loading ? tr("Створення...", "Creating...") : tr("Створити подію", "Create event")}
          </button>
        </form>
      </section>
    </main>
  );
}
