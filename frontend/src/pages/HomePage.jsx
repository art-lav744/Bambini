import { Link } from "react-router-dom";
import { useI18n } from "../i18n.js";

export default function HomePage() {
  const { tr } = useI18n();
  return (
    <section className="hero">
      <div className="eyebrow">{tr("Командні активності надворі", "Outdoor group activities")}</div>
      <h1>{tr("Створіть маршрут, квест або спільну активність", "Create a route, quest or shared activity")}</h1>
      <p className="muted">
        {tr("Один учасник створює кімнату, інші приєднуються за кодом.", "One participant creates a room and others join using its code.")}
      </p>

      <div className="button-stack">
        <Link className="button primary" to="/create">
          {tr("Створити активність", "Create activity")}
        </Link>
        <Link className="button secondary" to="/join">
          {tr("Приєднатися за кодом", "Join with code")}
        </Link>
      </div>
    </section>
  );
}
