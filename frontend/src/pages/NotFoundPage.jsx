import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="form-page">
      <section className="card form-card">
        <div className="eyebrow">404</div>
        <h1>Сторінку не знайдено</h1>
        <p className="muted">Посилання застаріло або адресу введено з помилкою.</p>
        <Link className="button primary" to="/map">Повернутися на карту</Link>
      </section>
    </main>
  );
}
