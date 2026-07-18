import { useEffect, useState } from "react";
import { api } from "../api.js";
import {
  clearCurrentUser,
  getPendingVerificationEmail,
  hasPendingEmailVerification,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  resendPendingEmailVerification,
  verifyPendingEmail,
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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(() => hasPendingEmailVerification() ? "verify" : "login");
  const [form, setForm] = useState({ name: "", email: getPendingVerificationEmail(), password: "" });
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(() => hasPendingEmailVerification() ? 60 : 0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown > 0]);

  useEffect(() => {
    if (mode !== "verify" || !hasPendingEmailVerification()) return undefined;
    let active = true;
    api.getEmailVerificationStatus()
      .then((status) => {
        if (!active) return;
        setResendCooldown(status.resend_after_seconds || 0);
        if (status.email) setForm((current) => ({ ...current, email: status.email }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    let active = true;
    const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    if (!clientId) {
      setLoading(false);
      return () => { active = false; };
    }

    loadGoogleScript()
      .then(() => {
        if (!active) return;
        window.google?.accounts?.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              setLoading(true);
              const result = await loginWithGoogle(response.credential);
              if (result.verificationRequired) {
                setMode("verify");
                setResendCooldown(60);
              } else {
                onAuthenticated(result.user);
              }
            } catch (err) {
              setError(err.message || "Не вдалося увійти через Google.");
              setLoading(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: false,
        });
        const googleButton = document.getElementById("google-signin");
        if (googleButton) {
          window.google?.accounts?.id.renderButton(googleButton, {
            theme: "filled_black",
            size: "large",
            text: "signin_with",
            shape: "pill",
          });
        }
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
      const result =
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
      if (result.verificationRequired) {
        setMode("verify");
        setVerificationCode("");
        setResendCooldown(60);
        setMessage(`Ми надіслали код на ${form.email.trim().toLowerCase()}`);
      } else {
        onAuthenticated(result.user);
      }
    } catch (err) {
      setError(err.message || "Не вдалося завершити авторизацію.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerification(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const user = await verifyPendingEmail(verificationCode);
      onAuthenticated(user);
    } catch (err) {
      setError(err.message || "Не вдалося підтвердити email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const status = await resendPendingEmailVerification();
      setResendCooldown(status.resend_after_seconds || 60);
      setMessage("Новий код надіслано.");
    } catch (err) {
      setError(err.message || "Не вдалося надіслати новий код.");
    } finally {
      setSubmitting(false);
    }
  }

  function useAnotherAccount() {
    clearCurrentUser();
    setMode("login");
    setForm({ name: "", email: "", password: "" });
    setVerificationCode("");
    setResendCooldown(0);
    setMessage("");
    setError("");
  }

  return (
    <main className="main-tab-page">
      <div className="tab-page__content" style={{ maxWidth: 460 }}>
        <div className="profile-hero">
          <div>
            <div className="eyebrow">Bambini</div>
            <h1>{mode === "verify" ? "Підтвердьте email" : "Увійдіть, щоб продовжити"}</h1>
          </div>
        </div>

        <section className="card" style={{ marginTop: 24 }}>
          {mode === "verify" ? (
            <div className="email-verification">
              <p className="muted">
                Введіть шестизначний код, надісланий на <strong>{form.email || getPendingVerificationEmail()}</strong>.
              </p>
              <form className="form" onSubmit={handleVerification}>
                <label>
                  Код підтвердження
                  <input
                    className="email-verification__code"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength="6"
                    placeholder="000000"
                    autoFocus
                    required
                  />
                </label>
                <button className="button primary" type="submit" disabled={submitting || verificationCode.length !== 6}>
                  {submitting ? "Перевірка…" : "Підтвердити email"}
                </button>
              </form>
              <div className="email-verification__actions">
                <button className="button secondary" type="button" disabled={submitting || resendCooldown > 0} onClick={handleResend}>
                  {resendCooldown > 0 ? `Надіслати знову через ${resendCooldown} с` : "Надіслати код знову"}
                </button>
                <button className="button secondary" type="button" disabled={submitting} onClick={useAnotherAccount}>
                  Інший акаунт
                </button>
              </div>
            </div>
          ) : <>
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
                minLength="8"
                required
              />
            </label>
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? "Завантаження..." : mode === "register" ? "Створити акаунт" : "Увійти"}
            </button>
          </form>

          {(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim() && (
            <div id="google-signin" style={{ marginTop: 24, display: "flex", justifyContent: "center" }} />
          )}
          {loading && <p className="muted" style={{ marginTop: 16 }}>Підключення Google…</p>}
          </>}
          {message && <p className="success-message auth-message">{message}</p>}
          {error && <p className="error-message auth-message">{error}</p>}
        </section>
      </div>
    </main>
  );
}
