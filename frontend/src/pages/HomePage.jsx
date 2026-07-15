import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <section className="hero">
      <div className="eyebrow">Командні активності надворі</div>
      <h1>Створіть маршрут, квест або спільну активність</h1>
      <p className="muted">
        Один учасник створює кімнату, інші приєднуються за кодом.
      </p>

      <div className="button-stack">
        <Link className="button primary" to="/create">
          Створити активність
        </Link>
        <Link className="button secondary" to="/join">
          Приєднатися за кодом
        </Link>
      </div>
    </section>
  );
}
