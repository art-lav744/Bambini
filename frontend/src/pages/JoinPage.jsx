import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import AppIcon from "../components/AppIcon.jsx";
import { localizeApiMessage, useI18n } from "../i18n.js";
import { ensureCurrentUser } from "../userSession.js";

export default function JoinPage() {
  const { language, tr } = useI18n();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ensureCurrentUser().then(setUser).catch((err) => setError(localizeApiMessage(err.message, language)));
  }, [language]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!user) return;

    setLoading(true);
    const normalizedCode = code.trim().toUpperCase();

    try {
      await api.joinActivity(normalizedCode, user.id);
      navigate(`/room/${normalizedCode}`);
    } catch (err) {
      setError(localizeApiMessage(err.message, language));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-page">
      <Link className="back-link" to="/events"><AppIcon name="arrow-left" /><span>{tr("Назад до подій", "Back to events")}</span></Link>
      <section className="card form-card">
        <div className="eyebrow">{tr("Вхід у подію", "Join an event")}</div>
        <h1>{tr("Приєднатися", "Join")}</h1>
        <p className="muted">
          {tr("Ви приєднаєтеся як", "You will join as")} <strong>{user?.name || tr("ваш профіль", "your profile")}</strong>. {tr("Ім’я повторно вводити не потрібно.", "You do not need to enter your name again.")}
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            {tr("Код події", "Event code")}
            <input
              className="room-code-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              minLength="6"
              maxLength="6"
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="button primary" disabled={loading || !user}>
            {loading ? tr("Приєднання...", "Joining...") : tr("Приєднатися", "Join")}
          </button>
        </form>
      </section>
    </main>
  );
}
