import { useEffect, useRef } from "react";
import AppIcon from "./AppIcon.jsx";
import { useI18n } from "../i18n.js";

export default function ConfirmDialog({ open, title, message, confirmLabel, onCancel, onConfirm }) {
  const { tr } = useI18n();
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="app-confirm-backdrop" role="presentation">
      <section className="app-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-message">
        <div className="app-confirm-dialog__mark"><AppIcon name="alert" /></div>
        <h2 id="app-confirm-title">{title}</h2>
        <p id="app-confirm-message">{message}</p>
        <div className="app-confirm-dialog__actions">
          <button ref={cancelButtonRef} className="button secondary" type="button" onClick={onCancel}>{tr("Скасувати", "Cancel")}</button>
          <button className="button app-confirm-dialog__danger" type="button" onClick={onConfirm}>{confirmLabel || tr("Підтвердити", "Confirm")}</button>
        </div>
      </section>
    </div>
  );
}
