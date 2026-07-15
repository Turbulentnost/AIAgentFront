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
