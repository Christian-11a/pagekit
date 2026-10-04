import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Dialog({
  title,
  description,
  onClose,
  children,
  labelledBy,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const app = document.querySelector<HTMLElement>(".app-shell");
    if (app) {
      app.inert = true;
      app.setAttribute("aria-hidden", "true");
    }
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab" && panel.current) {
        const items = [
          ...panel.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]',
          ),
        ].filter((el) => !el.closest("[hidden]"));
        if (!items.length) {
          event.preventDefault();
          panel.current.focus();
          return;
        }
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      if (app) {
        app.inert = false;
        app.removeAttribute("aria-hidden");
      }
      old?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={description ? `${labelledBy}-description` : undefined}
        tabIndex={-1}
        ref={panel}
      >
        <div className="dialog-head">
          <div>
            <h2 id={labelledBy}>{title}</h2>
            {description && (
              <p id={`${labelledBy}-description`}>{description}</p>
            )}
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
