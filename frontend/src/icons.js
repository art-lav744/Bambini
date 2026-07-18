export const ICON_CONTENT = Object.freeze({
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 17h.01"/>',
  "arrow-left": '<path d="m14.5 5-7 7 7 7"/><path d="M8 12h9"/>',
  "arrow-right": '<path d="m9.5 5 7 7-7 7"/><path d="M16 12H7"/>',
  check: '<path d="m5 12 4.2 4.2L19 6.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  empty: '<circle cx="12" cy="12" r="9"/><path d="m5.6 18.4 12.8-12.8"/>',
  "external-link": '<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"/>',
  friends: '<path d="M9 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 11Z"/><path d="M3.8 19c.5-3.5 2.4-5.3 5.2-5.3 2.1 0 3.7 1 4.6 2.9"/><path d="M16.8 11.2a2.6 2.6 0 1 0 0-5.2"/><path d="M15.8 14.2c2.7.2 4.2 1.8 4.6 4.8"/>',
  events: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 9.5h16"/><path d="m9.2 14 1.8 1.8 3.8-4"/>',
  hash: '<path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9" r="1.5"/><path d="m5 18 4.5-4.5 3 3 2-2 4.5 3.5"/>',
  loader: '<path d="M20 12a8 8 0 1 1-2.35-5.65"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
  map: '<path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z"/><path d="M9 4v14M15 6v14"/><circle cx="12" cy="11" r="2.2"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 1.25-3.1 1.8 1.8 0 0 1 1.25-3.1H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="10" r=".7"/><circle cx="10" cy="6.8" r=".7"/><circle cx="14" cy="6.8" r=".7"/><circle cx="17" cy="10" r=".7"/>',
  pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/>',
  "rotate-phone": '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 18h4M4 9a8 8 0 0 1 4-5M4 9l-2-2M4 9l2-2"/>',
  "theme-blue": '<path d="M3 8c2.2 0 2.2-1.5 4.5-1.5S9.8 8 12 8s2.2-1.5 4.5-1.5S18.8 8 21 8M3 13c2.2 0 2.2-1.5 4.5-1.5S9.8 13 12 13s2.2-1.5 4.5-1.5S18.8 13 21 13M3 18c2.2 0 2.2-1.5 4.5-1.5S9.8 18 12 18s2.2-1.5 4.5-1.5S18.8 18 21 18"/>',
  "theme-dark": '<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/>',
  "theme-green": '<path d="M19 4C10 4 5 8.5 5 15c0 3 2 5 5 5 6.5 0 9-7 9-16Z"/><path d="M5 20c2.5-5 6-8.5 11-11"/>',
  "theme-neon": '<path d="m12 3 1.35 4.65L18 9l-4.65 1.35L12 15l-1.35-4.65L6 9l4.65-1.35L12 3Z"/><path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/>',
  "theme-red": '<path d="m12 3 8 9-8 9-8-9 8-9Z"/>',
  "theme-sunset": '<path d="M4 18h16M7 15a5 5 0 0 1 10 0M12 3v3M4.9 7.9 7 10M19.1 7.9 17 10M3 13h2M19 13h2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
});

export function iconPathMarkup(name) {
  return ICON_CONTENT[name] || ICON_CONTENT.alert;
}

export function iconSvgMarkup(name, className = "app-icon") {
  const safeClassName = String(className).replace(/[^a-zA-Z0-9 _-]/g, "");
  return `<svg class="${safeClassName}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPathMarkup(name)}</svg>`;
}
