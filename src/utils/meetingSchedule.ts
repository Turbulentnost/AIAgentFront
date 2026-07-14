import type {
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

export function mapMeetingScheduleItem(item: MeetingScheduleSeriesItem): MeetingScheduleViewItem {
  const deadline = formatMeetingScheduleDeadline(item.deadline_start, item.deadline_end);
  const visibleParticipants = item.participant_roles.slice(0, 2);

  return {
    ...item,
    typeLabel: item.type_label?.trim() || typeLabels[item.type],
    typeTone: typeTones[item.type],
    statusLabel: item.status_label?.trim() || statusLabels[item.status],
    statusTone: statusTones[item.status],
    deadlinePrimary: deadline.primary,
    deadlineSecondary: deadline.secondary,
    visibleParticipants
  };
}

export function sortMeetingScheduleItems(items: MeetingScheduleViewItem[]): MeetingScheduleViewItem[] {
  return [...items].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}
