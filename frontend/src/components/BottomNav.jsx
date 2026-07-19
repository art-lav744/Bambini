import { NavLink } from "react-router-dom";
import AppIcon from "./AppIcon.jsx";
import { useI18n } from "../i18n.js";

const items = [
  { to: "/profile", label: "Профіль", labelEn: "Profile", icon: "profile" },
  { to: "/map", label: "Карта", labelEn: "Map", icon: "map" },
  { to: "/friends", label: "Друзі", labelEn: "Friends", icon: "friends" },
  { to: "/events", label: "Події", labelEn: "Events", icon: "events" },
];

export default function BottomNav() {
  const { language, tr } = useI18n();
  return (
    <nav className="bottom-nav" aria-label={tr("Основна навігація", "Main navigation")}>
      <div className="bottom-nav__inner">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `bottom-nav__item${isActive ? " is-active" : ""}`
            }
          >
            <span className="bottom-nav__icon">
              <AppIcon name={item.icon} />
            </span>
            <span>{language === "en" ? item.labelEn : item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
