import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import styles from "./SearchAlarmClock.module.css";

/** Practical web-search budget: 30 seconds … 10 minutes. */
export const SEARCH_TIMER_MIN_SECONDS = 30;
export const SEARCH_TIMER_MAX_SECONDS = 600;
export const SEARCH_TIMER_DEFAULT_SECONDS = 180;

const PRESETS = [
  { label: "1 мин", seconds: 60 },
  { label: "3 мин", seconds: 180 },
  { label: "5 мин", seconds: 300 }
] as const;

const CX = 50;
const CY = 52;
const HAND_LEN = 26;
const ARC_LEN = 2 * Math.PI * 26;

export function clampSearchTimerSeconds(value: number): number {
  if (!Number.isFinite(value)) return SEARCH_TIMER_DEFAULT_SECONDS;
  return Math.max(
    SEARCH_TIMER_MIN_SECONDS,
    Math.min(SEARCH_TIMER_MAX_SECONDS, Math.round(value))
  );
}

export function formatSearchTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Map set/remaining seconds onto a 360° dial (0 at 12 o'clock, clockwise = more time). */
function secondsToAngle(seconds: number): number {
  const clamped = Math.max(0, Math.min(SEARCH_TIMER_MAX_SECONDS, seconds));
  return (clamped / SEARCH_TIMER_MAX_SECONDS) * 360;
}

function angleToSeconds(angleDeg: number): number {
  let normalized = angleDeg % 360;
  if (normalized < 0) normalized += 360;
  const raw = (normalized / 360) * SEARCH_TIMER_MAX_SECONDS;
  return clampSearchTimerSeconds(raw);
}

function pointerAngle(clientX: number, clientY: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const radians = Math.atan2(clientX - cx, cy - clientY);
  let deg = (radians * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + Math.cos(radians) * radius,
    y: CY + Math.sin(radians) * radius
  };
}

type SearchAlarmClockProps = {
  /** Configured search budget (idle / before start). */
  durationSeconds: number;
  onDurationChange: (seconds: number) => void;
  /** True while supplier search (or timed agent work) is in flight. */
  active: boolean;
  /** Called once when the countdown hits zero while active. */
  onExpire: () => void;
  disabled?: boolean;
};

export function SearchAlarmClock({
  durationSeconds,
  onDurationChange,
  active,
  onExpire,
  disabled = false
}: SearchAlarmClockProps) {
  const labelId = useId();
  const dialRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const expiredForRunRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const displaySeconds = active ? remainingSeconds : durationSeconds;
  const handAngle = secondsToAngle(displaySeconds);
  const handTip = polar(handAngle, HAND_LEN);
  const sweep = Math.max(0, Math.min(1, displaySeconds / SEARCH_TIMER_MAX_SECONDS));

  useEffect(() => {
    if (!active) {
      expiredForRunRef.current = false;
      setRemainingSeconds(durationSeconds);
      return;
    }
    const startedAt = Date.now();
    const totalMs = clampSearchTimerSeconds(durationSeconds) * 1000;
    setRemainingSeconds(clampSearchTimerSeconds(durationSeconds));

    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((totalMs - (Date.now() - startedAt)) / 1000));
      setRemainingSeconds(left);
      if (left <= 0 && !expiredForRunRef.current) {
        expiredForRunRef.current = true;
        onExpireRef.current();
      }
    }, 200);

    return () => window.clearInterval(tick);
  }, [active, durationSeconds]);

  const applyAngle = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || active || !dialRef.current) return;
      const angle = pointerAngle(clientX, clientY, dialRef.current.getBoundingClientRect());
      onDurationChange(angleToSeconds(angle));
    },
    [active, disabled, onDurationChange]
  );

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || active) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyAngle(event.clientX, event.clientY);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    applyAngle(event.clientX, event.clientY);
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (disabled || active) return;
    const step = event.shiftKey ? 60 : 15;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onDurationChange(clampSearchTimerSeconds(durationSeconds + step));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onDurationChange(clampSearchTimerSeconds(durationSeconds - step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onDurationChange(SEARCH_TIMER_MIN_SECONDS);
    } else if (event.key === "End") {
      event.preventDefault();
      onDurationChange(SEARCH_TIMER_MAX_SECONDS);
    }
  };

  const statusText = active
    ? "идёт обратный отсчёт"
    : disabled
      ? "недоступно"
      : "перетащите стрелку, чтобы задать время";

  return (
    <div
      className={`${styles.root}${active ? ` ${styles.rootActive}` : ""}${
        disabled ? ` ${styles.rootDisabled}` : ""
      }`}
    >
      <div className={styles.countdown} aria-live="polite" id={labelId}>
        {formatSearchTimer(displaySeconds)}
      </div>
      <p className={styles.hint}>
        Лимит поиска · 30 с – 10 мин
        {active ? " · осталось" : ""}
      </p>
      <svg
        ref={dialRef}
        className={styles.dial}
        viewBox="0 0 100 100"
        role="slider"
        tabIndex={disabled || active ? -1 : 0}
        aria-labelledby={labelId}
        aria-label={`Будильник лимита поиска: ${formatSearchTimer(durationSeconds)}. ${statusText}`}
        aria-valuemin={SEARCH_TIMER_MIN_SECONDS}
        aria-valuemax={SEARCH_TIMER_MAX_SECONDS}
        aria-valuenow={displaySeconds}
        aria-valuetext={`${formatSearchTimer(displaySeconds)}, ${statusText}`}
        aria-disabled={disabled || active || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <defs>
          <linearGradient id={`${labelId}-face`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="14" rx="8" ry="5" className={styles.bell} />
        <ellipse cx="68" cy="14" rx="8" ry="5" className={styles.bell} />
        <circle cx="50" cy="16" r="3.5" className={styles.bellKnob} />
        <line x1="22" y1="92" x2="30" y2="78" className={styles.leg} />
        <line x1="78" y1="92" x2="70" y2="78" className={styles.leg} />
        <circle cx={CX} cy={CY} r="34" className={styles.rim} />
        <circle cx={CX} cy={CY} r="30" fill={`url(#${labelId}-face)`} className={styles.face} />
        <circle
          cx={CX}
          cy={CY}
          r="26"
          className={styles.track}
          strokeDasharray={`${sweep * ARC_LEN} ${ARC_LEN}`}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
        {[0, 90, 180, 270].map((angle) => {
          const inner = polar(angle, 23);
          const outer = polar(angle, 28);
          return (
            <line
              key={angle}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={styles.tick}
            />
          );
        })}
        <line x1={CX} y1={CY} x2={handTip.x} y2={handTip.y} className={styles.hand} />
        <circle cx={CX} cy={CY} r="3.2" className={styles.hub} />
        <circle cx={handTip.x} cy={handTip.y} r="3.8" className={styles.handKnob} />
      </svg>
      <div className={styles.presets} role="group" aria-label="Быстрый выбор длительности поиска">
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            type="button"
            className={
              !active && durationSeconds === preset.seconds
                ? styles.presetActive
                : styles.preset
            }
            disabled={disabled || active}
            onClick={() => onDurationChange(preset.seconds)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
