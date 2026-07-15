import type {
  MeetingScheduleHowOftenPreset,
  MeetingScheduleRecurrenceFormState,
  MeetingScheduleRecurrenceRule,
  MeetingScheduleWeekday,
  MeetingScheduleWeekdayPosition
} from "@/types/meetings";

export const meetingScheduleHowOftenOptions: {
  id: MeetingScheduleHowOftenPreset;
  label: string;
}[] = [
  { id: "daily", label: "Ежедневно" },
  { id: "weekly", label: "Еженедельно" },
  { id: "biweekly", label: "Раз в 2 недели" },
  { id: "monthly", label: "Ежемесячно" },
  { id: "quarterly", label: "Ежеквартально" },
  { id: "yearly", label: "Ежегодно" },
  { id: "custom", label: "Другое…" }
];

export const meetingScheduleWeekdayOptions: {
  id: MeetingScheduleWeekday;
  shortLabel: string;
  label: string;
}[] = [
  { id: "mon", shortLabel: "Пн", label: "понедельник" },
  { id: "tue", shortLabel: "Вт", label: "вторник" },
  { id: "wed", shortLabel: "Ср", label: "среда" },
  { id: "thu", shortLabel: "Чт", label: "четверг" },
  { id: "fri", shortLabel: "Пт", label: "пятница" },
  { id: "sat", shortLabel: "Сб", label: "суббота" },
  { id: "sun", shortLabel: "Вс", label: "воскресенье" }
];

export const meetingScheduleWeekdayPositionOptions: {
  id: MeetingScheduleWeekdayPosition;
  label: string;
}[] = [
  { id: "first", label: "1-я" },
  { id: "second", label: "2-я" },
  { id: "third", label: "3-я" },
  { id: "fourth", label: "4-я" },
  { id: "last", label: "последняя" }
];

export const meetingScheduleCustomUnitOptions = [
  { id: "days" as const, label: "дней" },
  { id: "weeks" as const, label: "недель" },
  { id: "months" as const, label: "месяцев" }
];

export const meetingScheduleDurationOptions = [30, 45, 60, 90, 120];

const weekdayLabels = Object.fromEntries(
  meetingScheduleWeekdayOptions.map((option) => [option.id, option.label])
) as Record<MeetingScheduleWeekday, string>;

const weekdayPositionLabels = Object.fromEntries(
  meetingScheduleWeekdayPositionOptions.map((option) => [option.id, option.label])
) as Record<MeetingScheduleWeekdayPosition, string>;

export function createDefaultRecurrenceFormState(): MeetingScheduleRecurrenceFormState {
  return {
    preset: "weekly",
    customInterval: 1,
    customUnit: "weeks",
    weekday: "mon",
    monthlyMode: "by_weekday_position",
    dayOfMonth: 15,
    weekdayPosition: "last",
    monthlyWeekday: "fri",
    timeLocal: "09:00",
    durationMinutes: 60
  };
}

export function shouldShowWeekdayFields(form: MeetingScheduleRecurrenceFormState): boolean {
  if (form.preset === "weekly" || form.preset === "biweekly") return true;
  return form.preset === "custom" && form.customUnit === "weeks";
}

export function shouldShowMonthlyFields(form: MeetingScheduleRecurrenceFormState): boolean {
  if (form.preset === "monthly" || form.preset === "quarterly") return true;
  return form.preset === "custom" && form.customUnit === "months";
}

export function shouldShowCustomFields(form: MeetingScheduleRecurrenceFormState): boolean {
  return form.preset === "custom";
}

function buildMonthlyRule(
  form: MeetingScheduleRecurrenceFormState,
  interval: number,
  base: Pick<MeetingScheduleRecurrenceRule, "time_local" | "duration_minutes">
): MeetingScheduleRecurrenceRule {
  if (form.monthlyMode === "by_day_of_month") {
    return {
      frequency: "monthly",
      interval,
      monthly_mode: "by_day_of_month",
      day_of_month: form.dayOfMonth,
      ...base
    };
  }

  return {
    frequency: "monthly",
    interval,
    monthly_mode: "by_weekday_position",
    weekday_position: form.weekdayPosition,
    monthly_weekday: form.monthlyWeekday,
    ...base
  };
}

/**
 * Converts recurrence form state into the API recurrence rule payload.
 */
export function buildRecurrenceRule(
  form: MeetingScheduleRecurrenceFormState
): MeetingScheduleRecurrenceRule {
  const base = {
    time_local: form.timeLocal,
    duration_minutes: form.durationMinutes
  };

  switch (form.preset) {
    case "daily":
      return { frequency: "daily", interval: 1, ...base };
    case "weekly":
      return { frequency: "weekly", interval: 1, weekday: form.weekday, ...base };
    case "biweekly":
      return { frequency: "weekly", interval: 2, weekday: form.weekday, ...base };
    case "monthly":
      return buildMonthlyRule(form, 1, base);
    case "quarterly":
      return buildMonthlyRule(form, 3, base);
    case "yearly":
      return { frequency: "yearly", interval: 1, ...base };
    case "custom": {
      const interval = Math.max(1, form.customInterval);

      if (form.customUnit === "days") {
        return { frequency: "daily", interval, custom_unit: "days", ...base };
      }

      if (form.customUnit === "weeks") {
        return {
          frequency: "weekly",
          interval,
          weekday: form.weekday,
          custom_unit: "weeks",
          ...base
        };
      }

      return { ...buildMonthlyRule(form, interval, base), custom_unit: "months" };
    }
  }
}

function formatTimeLocal(timeLocal: string): string {
  const [hoursPart, minutesPart] = timeLocal.split(":");
  const hours = hoursPart?.padStart(2, "0") ?? "09";
  const minutes = minutesPart?.padStart(2, "0") ?? "00";
  return `${hours}:${minutes}`;
}

/**
 * Builds a human-readable recurrence label for table preview and API `recurrence_label`.
 */
export function formatRecurrenceLabel(rule: MeetingScheduleRecurrenceRule): string {
  const time = formatTimeLocal(rule.time_local);

  if (rule.frequency === "daily") {
    if (rule.interval === 1) return `ежедневно, ${time}`;
    return `каждые ${rule.interval} дней, ${time}`;
  }

  if (rule.frequency === "weekly") {
    const weekday = rule.weekday ? weekdayLabels[rule.weekday] : "";

    if (rule.interval === 1) {
      return `еженедельно, ${weekday} ${time}`.replace(/\s+/g, " ").trim();
    }

    if (rule.interval === 2) {
      return `раз в 2 недели, ${weekday} ${time}`.replace(/\s+/g, " ").trim();
    }

    return `каждые ${rule.interval} недели, ${weekday} ${time}`.replace(/\s+/g, " ").trim();
  }

  if (rule.frequency === "monthly") {
    const prefix =
      rule.interval === 3
        ? "ежеквартально"
        : rule.interval === 1
          ? "ежемесячно"
          : `каждые ${rule.interval} месяцев`;

    if (rule.monthly_mode === "by_day_of_month" && rule.day_of_month) {
      return `${prefix}, ${rule.day_of_month}-е число ${time}`;
    }

    if (
      rule.monthly_mode === "by_weekday_position" &&
      rule.weekday_position &&
      rule.monthly_weekday
    ) {
      const position = weekdayPositionLabels[rule.weekday_position];
      const weekday = weekdayLabels[rule.monthly_weekday];
      return `${prefix}, ${position} ${weekday} ${time}`;
    }

    return `${prefix}, ${time}`;
  }

  if (rule.frequency === "yearly") {
    if (rule.interval === 1) return `ежегодно, ${time}`;
    return `каждые ${rule.interval} лет, ${time}`;
  }

  return time;
}

export function formatRecurrencePreview(form: MeetingScheduleRecurrenceFormState): string {
  return formatRecurrenceLabel(buildRecurrenceRule(form));
}

const apiWeekdayAliases: Record<string, MeetingScheduleWeekday> = {
  mon: "mon",
  monday: "mon",
  tue: "tue",
  tuesday: "tue",
  wed: "wed",
  wednesday: "wed",
  thu: "thu",
  thursday: "thu",
  fri: "fri",
  friday: "fri",
  sat: "sat",
  saturday: "sat",
  sun: "sun",
  sunday: "sun"
};

function parseApiWeekday(value: string | null | undefined): MeetingScheduleWeekday {
  if (!value) return "mon";
  return apiWeekdayAliases[value.trim().toLowerCase()] ?? "mon";
}

function detectRecurrencePreset(
  frequency: MeetingScheduleRecurrenceRule["frequency"],
  interval: number
): MeetingScheduleHowOftenPreset {
  if (frequency === "daily" && interval === 1) return "daily";
  if (frequency === "weekly" && interval === 1) return "weekly";
  if (frequency === "weekly" && interval === 2) return "biweekly";
  if (frequency === "monthly" && interval === 1) return "monthly";
  if (frequency === "monthly" && interval === 3) return "quarterly";
  if (frequency === "yearly" && interval === 1) return "yearly";
  return "custom";
}

type ScheduledMeetingReadLike = {
  frequency: MeetingScheduleRecurrenceRule["frequency"];
  interval: number;
  time_local: string;
  duration_minutes: number;
  monthly_mode: MeetingScheduleRecurrenceRule["monthly_mode"] | null;
  day_of_month: number | null;
  weekday: string | null;
  weekday_position: string | null;
};

/**
 * Converts API series recurrence fields into recurrence form state for editing.
 */
export function mapScheduledMeetingReadToRecurrenceFormState(
  read: Pick<
    ScheduledMeetingReadLike,
    | "frequency"
    | "interval"
    | "time_local"
    | "duration_minutes"
    | "monthly_mode"
    | "day_of_month"
    | "weekday"
    | "weekday_position"
  >
): MeetingScheduleRecurrenceFormState {
  const interval = Math.max(1, read.interval || 1);
  const preset = detectRecurrencePreset(read.frequency, interval);
  const weekday = parseApiWeekday(read.weekday);
  const monthlyWeekday = weekday;
  const monthlyMode =
    read.monthly_mode === "by_day_of_month" ? "by_day_of_month" : "by_weekday_position";

  const form = createDefaultRecurrenceFormState();
  form.preset = preset;
  form.timeLocal = read.time_local?.slice(0, 5) || form.timeLocal;
  form.durationMinutes = read.duration_minutes || form.durationMinutes;
  form.weekday = weekday;
  form.monthlyMode = monthlyMode;
  form.dayOfMonth = read.day_of_month ?? form.dayOfMonth;
  form.weekdayPosition =
    (read.weekday_position as MeetingScheduleWeekdayPosition | null) ?? form.weekdayPosition;
  form.monthlyWeekday = monthlyWeekday;

  if (preset === "custom") {
    if (read.frequency === "daily") {
      form.customUnit = "days";
      form.customInterval = interval;
    } else if (read.frequency === "weekly") {
      form.customUnit = "weeks";
      form.customInterval = interval;
    } else {
      form.customUnit = "months";
      form.customInterval = interval;
    }
  }

  return form;
}
