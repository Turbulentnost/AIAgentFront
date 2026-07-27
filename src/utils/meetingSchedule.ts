import type {
  MeetingScheduleContext,
  MeetingScheduleSeriesItem,
  MeetingScheduleStatus,
  MeetingScheduleType
} from "@/types/meetings";

export type MeetingScheduleTypeTone = "blue" | "green" | "violet" | "amber";
export type MeetingScheduleStatusTone = "green" | "amber" | "slate";

export interface MeetingScheduleViewItem extends MeetingScheduleSeriesItem {
  typeLabel: string;
  typeTone: MeetingScheduleTypeTone;
  categoryLabel: string;
  managerLabel: string;
  responsibleLabel: string;
  statusLabel: string;
  statusTone: MeetingScheduleStatusTone;
  deadlinePrimary: string;
  deadlineSecondary: string;
  visibleParticipants: string[];
  recurrenceLabel: string;
}

const typeLabels: Record<MeetingScheduleType, string> = {
  planned: "Плановое",
  report: "Отчётное",
  selector: "Селектор",
  unplanned: "Внеплановое"
};

const typeTones: Record<MeetingScheduleType, MeetingScheduleTypeTone> = {
  planned: "blue",
  report: "green",
  selector: "violet",
  unplanned: "amber"
};

const statusLabels: Record<MeetingScheduleStatus, string> = {
  scheduled: "Распланировано",
  created: "Создано",
  archive: "Архив"
};

const statusTones: Record<MeetingScheduleStatus, MeetingScheduleStatusTone> = {
  scheduled: "green",
  created: "amber",
  archive: "slate"
};

export const meetingScheduleTypeOptions: { id: MeetingScheduleType; label: string }[] = [
  { id: "planned", label: typeLabels.planned },
  { id: "report", label: typeLabels.report },
  { id: "selector", label: typeLabels.selector },
  { id: "unplanned", label: typeLabels.unplanned }
];

export const meetingScheduleStatusOptions: { id: MeetingScheduleStatus; label: string }[] = [
  { id: "scheduled", label: statusLabels.scheduled },
  { id: "created", label: statusLabels.created },
  { id: "archive", label: statusLabels.archive }
];

type MeetingScheduleSeriesApiItem = MeetingScheduleSeriesItem & {
  series_start_date?: string | null;
  series_end_date?: string | null;
};

export function normalizeMeetingScheduleSeriesItem(
  item: MeetingScheduleSeriesApiItem
): MeetingScheduleSeriesItem {
  return {
    ...item,
    deadline_start: item.deadline_start ?? item.series_start_date ?? null,
    deadline_end: item.deadline_end ?? item.series_end_date ?? null
  };
}

export function normalizeMeetingScheduleContext(context: MeetingScheduleContext): MeetingScheduleContext {
  return {
    ...context,
    items: context.items.map((item) => normalizeMeetingScheduleSeriesItem(item))
  };
}

function formatScheduleDate(value: string | null): string {
  if (!value) return "—";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;

  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatMeetingScheduleDeadline(
  start: string | null,
  end: string | null
): { primary: string; secondary: string } {
  const startLabel = formatScheduleDate(start);
  const endLabel = formatScheduleDate(end);

  if (startLabel === "—" && endLabel === "—") {
    return { primary: "—", secondary: "" };
  }

  if (startLabel === endLabel) {
    return { primary: startLabel, secondary: "разово" };
  }

  return {
    primary: startLabel === "—" ? "—" : `с ${startLabel}`,
    secondary: endLabel === "—" ? "" : `по ${endLabel}`
  };
}

export function getMeetingScheduleRecurrenceLabel(item: MeetingScheduleSeriesItem): string {
  return item.recurrence_label?.trim() || item.frequency_label;
}

export function mapMeetingScheduleItem(item: MeetingScheduleSeriesItem): MeetingScheduleViewItem {
  const deadline = formatMeetingScheduleDeadline(item.deadline_start, item.deadline_end);
  const visibleParticipants = item.participant_roles.slice(0, 2);
  const recurrenceLabel = getMeetingScheduleRecurrenceLabel(item);

  return {
    ...item,
    typeLabel: item.type_label?.trim() || typeLabels[item.type],
    typeTone: typeTones[item.type],
    categoryLabel: item.meeting_category_name?.trim() || "—",
    managerLabel: item.manager_user_fio?.trim() || item.manager_position_name?.trim() || "—",
    responsibleLabel:
      item.responsible_user_fio?.trim() || item.responsible_position_name?.trim() || "—",
    statusLabel: item.status_label?.trim() || statusLabels[item.status],
    statusTone: statusTones[item.status],
    deadlinePrimary: deadline.primary,
    deadlineSecondary: deadline.secondary,
    visibleParticipants,
    recurrenceLabel
  };
}

export function sortMeetingScheduleItems(items: MeetingScheduleViewItem[]): MeetingScheduleViewItem[] {
  return [...items].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

export type MeetingScheduleScope = "active" | "archive";

export type MeetingScheduleCategoryFilter = "all" | string;

const UNCategorizedCategoryId = "__none__";

export function isMeetingScheduleArchived(item: Pick<MeetingScheduleViewItem, "status">): boolean {
  return item.status === "archive";
}

export function filterMeetingScheduleByScope(
  items: MeetingScheduleViewItem[],
  scope: MeetingScheduleScope
): MeetingScheduleViewItem[] {
  return items.filter((item) =>
    scope === "archive" ? isMeetingScheduleArchived(item) : !isMeetingScheduleArchived(item)
  );
}

export function filterMeetingScheduleByCategory(
  items: MeetingScheduleViewItem[],
  categoryFilter: MeetingScheduleCategoryFilter
): MeetingScheduleViewItem[] {
  if (categoryFilter === "all") return items;
  if (categoryFilter === UNCategorizedCategoryId) {
    return items.filter((item) => !item.meeting_category_id);
  }
  return items.filter((item) => item.meeting_category_id === categoryFilter);
}

export type MeetingScheduleCategoryTile = {
  id: MeetingScheduleCategoryFilter;
  label: string;
  count: number;
};

export function buildMeetingScheduleCategoryTiles(
  items: MeetingScheduleViewItem[],
  categories: { id: string; name: string; sort_order: number }[]
): MeetingScheduleCategoryTile[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.meeting_category_id ?? UNCategorizedCategoryId;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const tiles: MeetingScheduleCategoryTile[] = [
    { id: "all", label: "Все виды", count: items.length }
  ];

  for (const category of [...categories].sort((left, right) => left.sort_order - right.sort_order)) {
    tiles.push({
      id: category.id,
      label: category.name,
      count: counts.get(category.id) ?? 0
    });
  }

  const uncategorizedCount = counts.get(UNCategorizedCategoryId) ?? 0;
  if (uncategorizedCount > 0) {
    tiles.push({
      id: UNCategorizedCategoryId,
      label: "Без вида",
      count: uncategorizedCount
    });
  }

  return tiles;
}

export function formatMeetingScheduleParticipantsSummary(count: number): string {
  if (count <= 0) return "—";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} участника`;
  return `${count} участников`;
}

const SCHEDULE_OCCURRENCE_TIMEZONE = "Europe/Moscow";

function parseScheduleOccurrenceInstant(value: string): Date {
  return new Date(value);
}

function formatScheduleOccurrenceWithTimezone(
  value: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: SCHEDULE_OCCURRENCE_TIMEZONE,
    ...options
  }).format(parseScheduleOccurrenceInstant(value));
}

export function formatScheduledOccurrenceDate(slotStart: string, occurrenceDate?: string): string {
  if (occurrenceDate) {
    const match = occurrenceDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        weekday: "long"
      }).format(date);
    }
  }

  return formatScheduleOccurrenceWithTimezone(slotStart, {
    day: "numeric",
    month: "long",
    weekday: "long"
  });
}

export function formatScheduledOccurrenceListDate(slotStart: string, occurrenceDate?: string): string {
  if (occurrenceDate) {
    const match = occurrenceDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}.${match[2]}.${match[1]}`;
    }
  }

  return formatScheduleOccurrenceWithTimezone(slotStart, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export function formatScheduledOccurrenceTimeRange(slotStart: string, slotEnd: string): string {
  const start = formatScheduleOccurrenceWithTimezone(slotStart, {
    hour: "2-digit",
    minute: "2-digit"
  });
  const end = formatScheduleOccurrenceWithTimezone(slotEnd, {
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${start}–${end}`;
}

export function formatScheduledOccurrenceCalendarParts(
  slotStart: string,
  occurrenceDate?: string
): { dayLabel: string; monthLabel: string } {
  if (occurrenceDate) {
    const match = occurrenceDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
      return {
        dayLabel: new Intl.DateTimeFormat("ru-RU", { day: "2-digit" }).format(date),
        monthLabel: new Intl.DateTimeFormat("ru-RU", { month: "short" })
          .format(date)
          .replace(".", "")
      };
    }
  }

  return {
    dayLabel: formatScheduleOccurrenceWithTimezone(slotStart, { day: "2-digit" }),
    monthLabel: formatScheduleOccurrenceWithTimezone(slotStart, { month: "short" }).replace(".", "")
  };
}
