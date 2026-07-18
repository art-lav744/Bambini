import { iconPathMarkup } from "../icons.js";

export default function AppIcon({ name, className = "", label }) {
  return (
    <svg
      className={`app-icon${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      dangerouslySetInnerHTML={{ __html: iconPathMarkup(name) }}
    />
  );
}
