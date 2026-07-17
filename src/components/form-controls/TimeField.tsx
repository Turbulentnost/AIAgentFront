import { ChevronDown, Clock3 } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import styles from "./TimeField.module.css";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));

export type TimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** @deprecated use controlClassName */
  selectClassName?: string;
  controlClassName?: string;
  minuteStep?: number;
  ariaLabel?: string;
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

function parseTimeValue(value: string): { hours: string; minutes: string } {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hours: "09", minutes: "00" };
  }

  const hours = Math.min(23, Math.max(0, Number(match[1]))).toString().padStart(2, "0");
  const minutes = Math.min(59, Math.max(0, Number(match[2]))).toString().padStart(2, "0");
  return { hours, minutes };
}

function buildMinuteOptions(step: number, currentMinutes: string): string[] {
  const safeStep = Math.max(1, Math.min(30, step));
  const options = Array.from({ length: Math.ceil(60 / safeStep) }, (_, index) =>
    String((index * safeStep) % 60).padStart(2, "0")
  );

  if (!options.includes(currentMinutes)) {
    options.push(currentMinutes);
    options.sort((left, right) => Number(left) - Number(right));
  }

  return options;
}

function TimeColumn({
  label,
  options,
  value,
  onSelect,
  columnRef
}: {
  label: string;
  options: string[];
  value: string;
  onSelect: (nextValue: string) => void;
  columnRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={styles.column} ref={columnRef} role="listbox" aria-label={label}>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="option"
            data-value={option}
            aria-selected={active}
            className={`${styles.option} ${active ? styles.optionActive : ""}`}
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default function TimeField({
  value,
  onChange,
  id,
  disabled = false,
  className,
  selectClassName,
  controlClassName,
  minuteStep = 1,
  ariaLabel = "Время"
}: TimeFieldProps) {
  const { hours, minutes } = parseTimeValue(value);
  const minuteOptions =
    minuteStep === 1
      ? Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"))
      : buildMinuteOptions(minuteStep, minutes);

  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoursColumnRef = useRef<HTMLDivElement>(null);
  const minutesColumnRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const resolvedControlClassName = controlClassName ?? selectClassName;
  const triggerClassName = resolvedControlClassName
    ? `${styles.trigger} ${resolvedControlClassName}`
    : styles.trigger;

  function updatePanelPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.max(rect.width, 220);
    const maxLeft = window.innerWidth - panelWidth - 12;
    const left = Math.min(Math.max(12, rect.left), maxLeft);

    setPanelPosition({
      top: rect.bottom + 6,
      left,
      width: panelWidth
    });
  }

  function scrollActiveOptionsIntoView() {
    hoursColumnRef.current
      ?.querySelector<HTMLElement>(`[data-value="${hours}"]`)
      ?.scrollIntoView({ block: "center" });
    minutesColumnRef.current
      ?.querySelector<HTMLElement>(`[data-value="${minutes}"]`)
      ?.scrollIntoView({ block: "center" });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    scrollActiveOptionsIntoView();
  }, [open, hours, minutes]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleReposition() {
      updatePanelPosition();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  function handleHoursChange(nextHours: string) {
    onChange(`${nextHours}:${minutes}`);
  }

  function handleMinutesChange(nextMinutes: string) {
    onChange(`${hours}:${nextMinutes}`);
  }

  function handleToggle() {
    if (disabled) return;
    setOpen((current) => !current);
  }

  const panel =
    open && panelPosition
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className={styles.panel}
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              width: panelPosition.width
            }}
            role="dialog"
            aria-label={ariaLabel}
          >
            <div className={styles.panelHead}>
              <span>Часы</span>
              <span>Минуты</span>
            </div>
            <div className={styles.columns}>
              <TimeColumn
                label="Часы"
                options={HOUR_OPTIONS}
                value={hours}
                columnRef={hoursColumnRef}
                onSelect={handleHoursChange}
              />
              <TimeColumn
                label="Минуты"
                options={minuteOptions}
                value={minutes}
                columnRef={minutesColumnRef}
                onSelect={handleMinutesChange}
              />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={rootRef} className={`${styles.root} ${className ?? ""}`} id={id}>
        <button
          ref={triggerRef}
          type="button"
          className={triggerClassName}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={handleToggle}
        >
          <Clock3 className={styles.triggerIcon} size={16} aria-hidden="true" />
          <span className={styles.triggerValue}>
            <span>{hours}</span>
            <span className={styles.triggerSeparator}>:</span>
            <span>{minutes}</span>
          </span>
          <ChevronDown
            className={`${styles.triggerChevron} ${open ? styles.triggerChevronOpen : ""}`}
            size={16}
            aria-hidden="true"
          />
        </button>
      </div>
      {panel}
    </>
  );
}
