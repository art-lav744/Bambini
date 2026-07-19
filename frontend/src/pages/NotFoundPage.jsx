import { Link } from "react-router-dom";
import { useI18n } from "../i18n.js";

export default function NotFoundPage() {
  const { tr } = useI18n();
  return (
    <main className="form-page">
      <section className="card form-card">
        <div className="eyebrow">404</div>
        <h1>{tr("Сторінку не знайдено", "Page not found")}</h1>
        <p className="muted">{tr("Посилання застаріло або адресу введено з помилкою.", "The link is outdated or the address was entered incorrectly.")}</p>
        <Link className="button primary" to="/map">{tr("Повернутися на карту", "Return to map")}</Link>
      </section>
    </main>
  );
}
