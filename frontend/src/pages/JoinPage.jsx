import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import AppIcon from "../components/AppIcon.jsx";
import { ensureCurrentUser } from "../userSession.js";

export default function JoinPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ensureCurrentUser().then(setUser).catch((err) => setError(err.message));
  }, []);

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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-page">
      <Link className="back-link" to="/events"><AppIcon name="arrow-left" /><span>Назад до подій</span></Link>
      <section className="card form-card">
        <div className="eyebrow">Вхід у подію</div>
        <h1>Приєднатися</h1>
        <p className="muted">
          Ви приєднаєтеся як <strong>{user?.name || "ваш профіль"}</strong>. Ім’я повторно вводити не потрібно.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Код події
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
            {loading ? "Приєднання..." : "Приєднатися"}
          </button>
        </form>
      </section>
    </main>
  );
}
