import { NavLink } from "react-router-dom";
import AppIcon from "./AppIcon.jsx";

const items = [
  { to: "/profile", label: "Профіль", icon: "profile" },
  { to: "/map", label: "Карта", icon: "map" },
  { to: "/friends", label: "Друзі", icon: "friends" },
  { to: "/events", label: "Події", icon: "events" },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Основна навігація">
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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
