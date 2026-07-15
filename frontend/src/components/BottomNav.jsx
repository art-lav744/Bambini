import { NavLink } from "react-router-dom";

function Icon({ name }) {
  const common = {
    width: 23,
    height: 23,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (name === "profile") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
      </svg>
    );
  }

  if (name === "friends") {
    return (
      <svg {...common}>
        <path d="M9 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 11Z" />
        <path d="M3.8 19c.5-3.5 2.4-5.3 5.2-5.3 2.1 0 3.7 1 4.6 2.9" />
        <path d="M16.8 11.2a2.6 2.6 0 1 0 0-5.2" />
        <path d="M15.8 14.2c2.7.2 4.2 1.8 4.6 4.8" />
      </svg>
    );
  }

  if (name === "events") {
    return (
      <svg {...common}>
        <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
        <path d="m9.2 14 1.8 1.8 3.8-4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z" />
      <path d="M9 4v14M15 6v14" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

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
              <Icon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
