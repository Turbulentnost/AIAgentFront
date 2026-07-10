import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  buildMeetingSlotRangeFromLocal,
  formatMeetingSlot
} from "@/utils/meetingDashboard";
import styles from "./MeetingAgent.module.css";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

type Props = {
  open: boolean;
  durationMinutes: number;
  initialDate?: string;
  initialStartTime?: string;
  onClose: () => void;
  onApply: (slot: { start: string; end: string; label: string }) => void;
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function buildCalendarCells(month: Date): Array<Date | null> {
  const firstDay = startOfMonth(month);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < mondayOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export default function MeetingAgentManualSlotModal({
  open,
  durationMinutes,
  initialDate,
  initialStartTime,
  onClose,
  onApply
}: Props) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(today));
  const [startTime, setStartTime] = useState("10:00");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const baseDate = initialDate ? new Date(`${initialDate}T12:00:00`) : today;
    const safeDate = Number.isNaN(baseDate.getTime()) ? today : baseDate;
    setVisibleMonth(startOfMonth(safeDate));
    setSelectedDate(initialDate ?? toDateInputValue(today));
    setStartTime(initialStartTime ?? "10:00");
    setValidationError(null);
  }, [open, initialDate, initialStartTime, today]);

  if (!open) return null;

  const calendarCells = buildCalendarCells(visibleMonth);
  const selectedDateObject = new Date(`${selectedDate}T12:00:00`);
  const previewSlot = buildMeetingSlotRangeFromLocal(selectedDate, startTime, durationMinutes);

  function handlePrevMonth() {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function handleSubmit() {
    const slot = buildMeetingSlotRangeFromLocal(selectedDate, startTime, durationMinutes);
    if (!slot) {
      setValidationError("Укажите корректную дату и время.");
      return;
    }

    const slotStart = new Date(slot.start);
    if (Number.isNaN(slotStart.getTime())) {
      setValidationError("Не удалось определить выбранное время.");
      return;
    }

    if (slotStart < new Date()) {
      setValidationError("Нельзя выбрать время в прошлом.");
      return;
    }

    setValidationError(null);
    onApply({
      start: slot.start,
      end: slot.end,
      label: formatMeetingSlot(slot)
    });
  }

  return (
    <div className={`${styles.modalOverlay} ${styles.modalOverlayNested}`} onClick={onClose} role="presentation">
      <div
        className={`${styles.modalCard} ${styles.manualSlotModalCard}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-manual-slot-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-manual-slot-title">Запланировать вручную</h2>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="Закрыть">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className={styles.modalHint}>
          Выберите дату и время начала. Длительность совещания: {durationMinutes} мин.
        </p>

        <div className={styles.manualSlotCalendar}>
          <div className={styles.manualSlotCalendarHead}>
            <button type="button" className={styles.manualSlotNavButton} onClick={handlePrevMonth} aria-label="Предыдущий месяц">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <strong>
              {MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
            </strong>
            <button type="button" className={styles.manualSlotNavButton} onClick={handleNextMonth} aria-label="Следующий месяц">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.manualSlotWeekdays} aria-hidden="true">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className={styles.manualSlotDays} role="grid" aria-label="Календарь">
            {calendarCells.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className={styles.manualSlotDayEmpty} />;
              }

              const disabled = day < today;
              const selected = isSameDay(day, selectedDateObject);
              const dayValue = toDateInputValue(day);

              return (
                <button
                  key={dayValue}
                  type="button"
                  role="gridcell"
                  className={`${styles.manualSlotDay} ${
                    selected ? styles.manualSlotDaySelected : ""
                  } ${disabled ? styles.manualSlotDayDisabled : ""}`}
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedDate(dayValue);
                    setValidationError(null);
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.manualSlotTimeFields}>
          <label className={styles.manualSlotTimeField}>
            <span>Начало</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value);
                setValidationError(null);
              }}
            />
          </label>
          <label className={styles.manualSlotTimeField}>
            <span>Длительность</span>
            <input type="text" value={`${durationMinutes} мин`} readOnly />
          </label>
        </div>

        {previewSlot ? (
          <p className={styles.manualSlotPreviewLabel}>
            Выбранный слот: <strong>{formatMeetingSlot(previewSlot)}</strong>
          </p>
        ) : null}

        {validationError ? (
          <p className={styles.manualSlotValidationError} role="alert">
            {validationError}
          </p>
        ) : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleSubmit}>
            Проверить слот
          </button>
        </div>
      </div>
    </div>
  );
}
