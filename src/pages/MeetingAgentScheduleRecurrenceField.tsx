import { ChevronDown } from "lucide-react";

import type { MeetingScheduleRecurrenceFormState } from "@/types/meetings";
import {
  formatRecurrencePreview,
  meetingScheduleCustomUnitOptions,
  meetingScheduleDurationOptions,
  meetingScheduleHowOftenOptions,
  meetingScheduleWeekdayOptions,
  meetingScheduleWeekdayPositionOptions,
  shouldShowCustomFields,
  shouldShowMonthlyFields,
  shouldShowWeekdayFields
} from "@/utils/meetingScheduleRecurrence";

import styles from "./MeetingAgent.module.css";

type Props = {
  value: MeetingScheduleRecurrenceFormState;
  onChange: (value: MeetingScheduleRecurrenceFormState) => void;
};

export default function MeetingAgentScheduleRecurrenceField({ value, onChange }: Props) {
  const preview = formatRecurrencePreview(value);
  const showWeekday = shouldShowWeekdayFields(value);
  const showMonthly = shouldShowMonthlyFields(value);
  const showCustom = shouldShowCustomFields(value);

  function updateField<K extends keyof MeetingScheduleRecurrenceFormState>(
    key: K,
    nextValue: MeetingScheduleRecurrenceFormState[K]
  ) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <fieldset className={styles.scheduleRecurrence}>
      <legend className={styles.scheduleRecurrenceLegend}>Периодичность</legend>

      <label className={styles.scheduleRecurrenceRow}>
        <span className={styles.scheduleRecurrenceRowLabel}>Как часто</span>
        <div className={styles.scheduleSelectField}>
          <select
            className={styles.scheduleControl}
            value={value.preset}
            onChange={(event) =>
              updateField("preset", event.target.value as MeetingScheduleRecurrenceFormState["preset"])
            }
          >
            {meetingScheduleHowOftenOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className={styles.scheduleSelectChevron} size={16} aria-hidden="true" />
        </div>
      </label>

      {showCustom ? (
        <div className={styles.scheduleRecurrenceCustomRow}>
          <label className={styles.scheduleRecurrenceInlineField}>
            <span className={styles.scheduleRecurrenceInlineLabel}>Каждые</span>
            <input
              className={styles.scheduleControl}
              type="number"
              min={1}
              max={365}
              value={value.customInterval}
              onChange={(event) =>
                updateField("customInterval", Math.max(1, Number(event.target.value) || 1))
              }
            />
          </label>
          <div className={styles.scheduleSelectField}>
            <select
              className={styles.scheduleControl}
              value={value.customUnit}
              onChange={(event) =>
                updateField(
                  "customUnit",
                  event.target.value as MeetingScheduleRecurrenceFormState["customUnit"]
                )
              }
            >
              {meetingScheduleCustomUnitOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className={styles.scheduleSelectChevron} size={16} aria-hidden="true" />
          </div>
        </div>
      ) : null}

      {showWeekday ? (
        <div className={styles.scheduleRecurrenceRow}>
          <span className={styles.scheduleRecurrenceRowLabel}>День недели</span>
          <div className={styles.scheduleRecurrenceWeekdays} role="group" aria-label="День недели">
            {meetingScheduleWeekdayOptions.map((option) => {
              const isActive = value.weekday === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.scheduleRecurrenceWeekdayButton} ${
                    isActive ? styles.scheduleRecurrenceWeekdayButtonActive : ""
                  }`}
                  aria-pressed={isActive}
                  onClick={() => updateField("weekday", option.id)}
                >
                  {option.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showMonthly ? (
        <div className={styles.scheduleRecurrenceMonthly}>
          <div className={styles.scheduleRecurrenceMonthlyModes} role="radiogroup" aria-label="Режим месяца">
            <label className={styles.scheduleRecurrenceRadio}>
              <input
                type="radio"
                name="schedule-monthly-mode"
                checked={value.monthlyMode === "by_day_of_month"}
                onChange={() => updateField("monthlyMode", "by_day_of_month")}
              />
              <span>Число месяца</span>
            </label>
            <label className={styles.scheduleRecurrenceRadio}>
              <input
                type="radio"
                name="schedule-monthly-mode"
                checked={value.monthlyMode === "by_weekday_position"}
                onChange={() => updateField("monthlyMode", "by_weekday_position")}
              />
              <span>День недели</span>
            </label>
          </div>

          {value.monthlyMode === "by_day_of_month" ? (
            <div className={styles.scheduleSelectField}>
              <select
                className={styles.scheduleControl}
                value={value.dayOfMonth}
                onChange={(event) => updateField("dayOfMonth", Number(event.target.value))}
              >
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <ChevronDown className={styles.scheduleSelectChevron} size={16} aria-hidden="true" />
            </div>
          ) : (
            <div className={styles.scheduleRecurrenceMonthlyWeekdayRow}>
              <div className={styles.scheduleSelectField}>
                <select
                  className={styles.scheduleControl}
                  value={value.weekdayPosition}
                  onChange={(event) =>
                    updateField(
                      "weekdayPosition",
                      event.target.value as MeetingScheduleRecurrenceFormState["weekdayPosition"]
                    )
                  }
                >
                  {meetingScheduleWeekdayPositionOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className={styles.scheduleSelectChevron} size={16} aria-hidden="true" />
              </div>
              <div className={styles.scheduleSelectField}>
                <select
                  className={styles.scheduleControl}
                  value={value.monthlyWeekday}
                  onChange={(event) =>
                    updateField(
                      "monthlyWeekday",
                      event.target.value as MeetingScheduleRecurrenceFormState["monthlyWeekday"]
                    )
                  }
                >
                  {meetingScheduleWeekdayOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className={styles.scheduleSelectChevron} size={16} aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className={styles.scheduleRecurrenceTimeRow}>
        <label className={styles.scheduleRecurrenceInlineField}>
          <span className={styles.scheduleRecurrenceInlineLabel}>Время</span>
          <input
            className={styles.scheduleControl}
            type="time"
            value={value.timeLocal}
            onChange={(event) => updateField("timeLocal", event.target.value)}
          />
        </label>
        <label className={styles.scheduleRecurrenceInlineField}>
          <span className={styles.scheduleRecurrenceInlineLabel}>Длительность</span>
          <div className={styles.scheduleSelectField}>
            <select
              className={styles.scheduleControl}
              value={value.durationMinutes}
              onChange={(event) => updateField("durationMinutes", Number(event.target.value))}
            >
              {meetingScheduleDurationOptions.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} мин
                </option>
              ))}
            </select>
            <ChevronDown className={styles.scheduleSelectChevron} size={16} aria-hidden="true" />
          </div>
        </label>
      </div>

      <p className={styles.scheduleRecurrencePreview} aria-live="polite">
        <span className={styles.scheduleRecurrencePreviewMarker} aria-hidden="true">
          ▸
        </span>
        {preview}
      </p>
    </fieldset>
  );
}
