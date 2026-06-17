import type { MeetingDashboardItem, MeetingLoginContext } from "@/types/meetings";
import type { MeetingQueueTab } from "@/mock-data/meetingAgent";

export function getMeetingItemId(item: MeetingDashboardItem): string {
  return item.ref_key ?? item.number ?? "";
}

export function formatMeetingDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU");
}

export function formatMeetingDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatMeetingTime(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!start && !end) return "—";
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? "—";
}

export function getMeetingItemTitle(item: MeetingDashboardItem): string {
  return (
    item.title?.trim() ||
    item.subject?.trim() ||
    item.meeting_type_label?.trim() ||
    item.meeting_type?.trim() ||
    item.comment?.trim() ||
    "Заявка на совещание"
  );
}

export function getMeetingItemCode(item: MeetingDashboardItem): string {
  return item.number ? `СЗ №${item.number}` : "Служебная записка";
}

export function getMeetingItemDate(
  item: MeetingDashboardItem,
  options: { preferDocumentDate?: boolean } = {}
): string {
  if (options.preferDocumentDate) {
    return formatMeetingDate(item.document_date);
  }
  return formatMeetingDate(item.meeting_date ?? item.desired_meeting_date ?? item.document_date);
}

export function isTodayQueueItem(
  item: MeetingDashboardItem,
  context: MeetingLoginContext,
  tab: MeetingQueueTab
): boolean {
  if (tab === "today") return true;
  if (tab !== "all") return false;
  return context.today.some((todayItem) => getMeetingItemId(todayItem) === getMeetingItemId(item));
}

export function getMeetingStatusTone(
  status: string | null | undefined
): "blue" | "amber" | "red" | "slate" | "green" {
  if (!status) return "slate";
  if (status === "НеСогласована") return "amber";
  if (status === "Согласована") return "green";
  return "slate";
}

export function getMeetingStatusLabel(
  status: string | null | undefined,
  statusLabel?: string | null
): string {
  if (statusLabel?.trim()) return statusLabel.trim();
  if (!status) return "Без статуса";
  if (status === "НеСогласована") return "Не согласована";
  if (status === "Согласована") return "Согласована";
  return status;
}

export function formatMeetingSlot(slot: { start: string; end: string }): string {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${slot.start}–${slot.end}`;
  }
  if (start.toDateString() === end.toDateString()) {
    const date = start.toLocaleDateString("ru-RU");
    const startTime = start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const endTime = end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return `${date}, ${startTime}–${endTime}`;
  }
  return `${formatMeetingDateTime(slot.start)} – ${formatMeetingDateTime(slot.end)}`;
}

export function getMeetingItemTags(
  item: MeetingDashboardItem,
  options: { preferDocumentDate?: boolean } = {}
) {
  const tags: { label: string; tone: "blue" | "amber" | "red" | "slate" | "green" }[] = [];

  if (item.status) {
    tags.push({
      label: getMeetingStatusLabel(item.status, item.status_label),
      tone: getMeetingStatusTone(item.status)
    });
  }

  for (const warning of item.warnings ?? []) {
    tags.push({ label: warning, tone: "amber" });
  }

  if (!options.preferDocumentDate && !item.meeting_date && !item.desired_meeting_date) {
    tags.push({ label: "Не назначено", tone: "blue" });
  }

  if (item.location) {
    tags.push({ label: item.location, tone: "slate" });
  }

  return tags;
}

export function mergeMeetingItems(
  unapproved: MeetingDashboardItem[],
  today: MeetingDashboardItem[]
): MeetingDashboardItem[] {
  const seen = new Set<string>();
  const merged: MeetingDashboardItem[] = [];

  for (const item of [...unapproved, ...today]) {
    const id = getMeetingItemId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }

  return merged;
}

export function filterMeetingItems(
  context: MeetingLoginContext,
  tab: MeetingQueueTab
): MeetingDashboardItem[] {
  switch (tab) {
    case "ud":
      return context.unapproved;
    case "today":
      return context.today;
    case "conflicts":
      return [];
    case "errors":
      return [];
    default:
      return mergeMeetingItems(context.unapproved, context.today);
  }
}

export function getMemoRefKey(item: MeetingDashboardItem | null | undefined): string | null {
  return item?.ref_key ?? null;
}

export function isMeetingRunActive(status: string | null | undefined): boolean {
  return Boolean(status && ["pending", "planning", "running", "waiting_human"].includes(status));
}

export function buildMeetingStats(context: MeetingLoginContext) {
  const unapprovedCount = context.counts.unapproved ?? context.unapproved.length;
  const todayCount = context.counts.today ?? context.today.length;
  const totalCount = mergeMeetingItems(context.unapproved, context.today).length;

  return [
    { id: "unapproved", label: "Не согласовано", value: unapprovedCount, tone: "amber" as const },
    { id: "today", label: "СЗ за сегодня", value: todayCount, tone: "green" as const },
    { id: "total", label: "Всего в очереди", value: totalCount, tone: "blue" as const },
    { id: "errors", label: "Ошибки интеграции", value: context.error ? 1 : 0, tone: "red" as const }
  ];
}
