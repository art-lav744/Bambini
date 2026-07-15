import { useEffect, useState } from "react";
import {
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
} from "../userSession.js";

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[src*="accounts.google.com"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function LoginPage({ onAuthenticated }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    loadGoogleScript()
      .then(() => {
        if (!active) return;
        window.google?.accounts?.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
          callback: async (response) => {
            try {
              setLoading(true);
              const user = await loginWithGoogle(response.credential);
              onAuthenticated(user);
            } catch (err) {
              setError(err.message || "Не вдалося увійти через Google.");
              setLoading(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: false,
        });
        window.google?.accounts?.id.renderButton(document.getElementById("google-signin"), {
          theme: "filled_black",
          size: "large",
          text: "signin_with",
          shape: "pill",
        });
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Не вдалося завантажити Google Sign-In. Перевірте VITE_GOOGLE_CLIENT_ID.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [onAuthenticated]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const user =
        mode === "register"
          ? await registerWithEmail({
              name: form.name.trim(),
              email: form.email.trim(),
              password: form.password,
            })
          : await loginWithEmail({
              email: form.email.trim(),
              password: form.password,
            });
      onAuthenticated(user);
    } catch (err) {
      setError(err.message || "Не вдалося завершити авторизацію.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="main-tab-page">
      <div className="tab-page__content" style={{ maxWidth: 460 }}>
        <div className="profile-hero">
          <div>
            <div className="eyebrow">Outdoor Together</div>
            <h1>Увійдіть, щоб продовжити</h1>
          </div>
        </div>

        <section className="card" style={{ marginTop: 24 }}>
          <div className="auth-mode-switch" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={`button secondary ${mode === "login" ? "is-active" : ""}`}
              style={{ flex: 1 }}
              onClick={() => setMode("login")}
            >
              Увійти
            </button>
            <button
              type="button"
              className={`button secondary ${mode === "register" ? "is-active" : ""}`}
              style={{ flex: 1 }}
              onClick={() => setMode("register")}
            >
              Реєстрація
            </button>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                Ім'я
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  minLength="2"
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                minLength="6"
                required
              />
            </label>
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? "Завантаження..." : mode === "register" ? "Створити акаунт" : "Увійти"}
            </button>
          </form>

          <div id="google-signin" style={{ marginTop: 24, display: "flex", justifyContent: "center" }} />
          {loading && <p className="muted" style={{ marginTop: 16 }}>Підключення Google…</p>}
          {error && <p className="error">{error}</p>}
        </section>
      </div>
    </main>
  );
}
