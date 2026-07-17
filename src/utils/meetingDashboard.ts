import type {
  MeetingApplication,
  MeetingAgentSlotPreview,
  MeetingAttendee,
  MeetingDashboardItem,
  MeetingLoginContext,
  MeetingMemoDetail,
  MeetingSlotCandidate,
  MeetingSlotCoverage,
  MeetingSlotBlockingEvent,
  MeetingSlotPreviewParticipant,
  MeetingSlotRoomStatus
} from "@/types/meetings";

export type MeetingQueueFilter = "today" | "approved" | "unapproved" | "rejected";

export const meetingQueueFilters: { id: MeetingQueueFilter; label: string }[] = [
  { id: "today", label: "СЗ за сегодня" },
  { id: "approved", label: "Согласованы" },
  { id: "unapproved", label: "Не согласованы" },
  { id: "rejected", label: "Отклонены" }
];

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
  if (start && end) return formatMeetingSlot({ start, end });
  const single = start ?? end;
  return single ? formatMeetingDateTime(single) : "—";
}

const MANAGER_LOCATION_PREFIX = "Руководитель совещания ";

/** Переговорная из строки места Outlook-приглашения (без ФИО руководителя). */
export function meetingPlaceFromInviteLocation(location: string | null | undefined): string {
  const text = location?.trim();
  if (!text) return "—";
  if (text.startsWith(MANAGER_LOCATION_PREFIX)) {
    const rest = text.slice(MANAGER_LOCATION_PREFIX.length);
    const commaIndex = rest.indexOf(", ");
    if (commaIndex >= 0) {
      const place = rest.slice(commaIndex + 2).trim();
      return place || "—";
    }
    return "—";
  }
  return text;
}

export function formatShortPersonName(fullName?: string | null): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const [lastName, ...rest] = parts;
  const initials = rest.map((part) => `${part.charAt(0).toUpperCase()}.`).join("");
  return `${lastName} ${initials}`.trim();
}

export function getMeetingPersonName(
  person: { full_name?: string | null } | null | undefined,
  options: { short?: boolean } = {}
): string {
  const fullName = person?.full_name?.trim();
  if (!fullName) return "—";
  return options.short ? formatShortPersonName(fullName) : fullName;
}

export function getMeetingScheduledLabel(item: MeetingDashboardItem): string {
  if (item.scheduled_label?.trim()) return item.scheduled_label.trim();
  if (item.meeting_start) {
    if (item.meeting_end) {
      return formatMeetingSlot({ start: item.meeting_start, end: item.meeting_end });
    }
    return formatMeetingDateTime(item.meeting_start);
  }
  const date = formatMeetingDate(item.meeting_date ?? item.desired_meeting_date);
  return date !== "—" ? date : "—";
}

export function getMeetingTheme(item: MeetingDashboardItem): string {
  const theme = item.title?.trim() || item.subject?.trim();
  return theme || "—";
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

export function isMeetingPsdLevel(item: MeetingDashboardItem): boolean {
  return Boolean(item.psd_level);
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

export function getMeetingStatusTone(
  status: string | null | undefined
): "blue" | "amber" | "red" | "slate" | "green" {
  if (!status) return "slate";
  if (status === "НеСогласована") return "amber";
  if (status === "Согласована") return "green";
  if (status === "Отклонена") return "red";
  return "slate";
}

export function getMeetingStatusLabel(
  status: string | null | undefined,
  statusLabel?: string | null
): string {
  if (status === "НеСогласована") return "Не согласована";
  if (status === "Согласована") return "Согласована";
  if (status === "Отклонена") return "Отклонена";
  if (statusLabel?.trim()) return statusLabel.trim();
  if (!status) return "Без статуса";
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

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatMeetingIsoWithOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = padDatePart(Math.floor(absoluteOffset / 60));
  const offsetMins = padDatePart(absoluteOffset % 60);

  return (
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}` +
    `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:00` +
    `${sign}${offsetHours}:${offsetMins}`
  );
}

export function buildMeetingSlotRangeFromLocal(
  date: string,
  startTime: string,
  durationMinutes: number
): { start: string; end: string } | null {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  const [hours, minutes] = startTime.split(":").map((part) => Number(part));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    durationMinutes <= 0
  ) {
    return null;
  }

  const start = new Date(year, month - 1, day, hours, minutes, 0);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    start: formatMeetingIsoWithOffset(start),
    end: formatMeetingIsoWithOffset(end)
  };
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

export function getMeetingDashboardItems(context: MeetingLoginContext): MeetingDashboardItem[] {
  if (context.items?.length) {
    return context.items;
  }
  return mergeMeetingItems(context.unapproved, context.today);
}

export function filterMeetingQueueItems(
  context: MeetingLoginContext,
  filter: MeetingQueueFilter
): MeetingDashboardItem[] {
  const items = getMeetingDashboardItems(context);

  switch (filter) {
    case "today":
      return context.today;
    case "approved":
      return items.filter((item) => item.status === "Согласована");
    case "unapproved":
      return items.filter(
        (item) =>
          !isMeetingMemoApproved(item.status, item.status_label) &&
          !isMeetingMemoRejected(item.status, item.status_label)
      );
    case "rejected":
      return items.filter((item) => item.status === "Отклонена");
    default:
      return items;
  }
}

export function getMeetingQueueEmptyMessage(filter: MeetingQueueFilter): string {
  switch (filter) {
    case "today":
      return "СЗ с датой документа за сегодня нет";
    case "approved":
      return "Согласованных СЗ нет";
    case "unapproved":
      return "Не согласованных СЗ нет";
    case "rejected":
      return "Отклонённых СЗ нет";
    default:
      return "Заявок в очереди нет";
  }
}

export function buildMeetingQueueFilterCounts(
  context: MeetingLoginContext
): Record<MeetingQueueFilter, number> {
  return meetingQueueFilters.reduce(
    (counts, filter) => {
      counts[filter.id] = filterMeetingQueueItems(context, filter.id).length;
      return counts;
    },
    {
      today: 0,
      approved: 0,
      unapproved: 0,
      rejected: 0
    } as Record<MeetingQueueFilter, number>
  );
}

export function getMemoRefKey(item: MeetingDashboardItem | null | undefined): string | null {
  return item?.ref_key ?? null;
}

export function isMeetingRunActive(status: string | null | undefined): boolean {
  return Boolean(status && ["pending", "planning", "running", "waiting_human"].includes(status));
}

export function getMeetingParticipantNames(
  application: MeetingApplication,
  queueItem?: MeetingDashboardItem | null
): string[] {
  const names = (application.participants ?? [])
    .map((participant) => participant.full_name?.trim())
    .filter((name): name is string => Boolean(name));

  if (names.length) {
    return [...new Set(names)];
  }

  return [
    ...new Set(
      (queueItem?.participant_names ?? [])
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ];
}

export function buildMeetingStats(context: MeetingLoginContext) {
  const counts = buildMeetingQueueFilterCounts(context);

  const tones: Record<MeetingQueueFilter, "amber" | "green" | "blue" | "red"> = {
    today: "green",
    approved: "blue",
    unapproved: "amber",
    rejected: "red"
  };

  return meetingQueueFilters.map((filter) => ({
    id: filter.id,
    label: filter.label,
    value: counts[filter.id],
    tone: tones[filter.id]
  }));
}

function normalizeMeetingStatusText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/a/g, "а")
    .replace(/e/g, "е")
    .replace(/o/g, "о")
    .replace(/p/g, "р")
    .replace(/c/g, "с")
    .replace(/x/g, "х")
    .replace(/k/g, "к")
    .replace(/m/g, "м")
    .replace(/t/g, "т");
}

export function isMeetingMemoApproved(
  status: string | null | undefined,
  statusLabel?: string | null
): boolean {
  for (const value of [status, statusLabel]) {
    const normalized = normalizeMeetingStatusText(value);
    if (!normalized) continue;
    if (normalized === "согласована") return true;
    if (normalized.includes("соглас") && !normalized.includes("несоглас")) return true;
  }
  return false;
}

export function isMeetingMemoRejected(
  status: string | null | undefined,
  statusLabel?: string | null
): boolean {
  for (const value of [status, statusLabel]) {
    const normalized = normalizeMeetingStatusText(value);
    if (!normalized) continue;
    if (normalized === "отклонена" || normalized.includes("отклон")) return true;
  }
  return false;
}

export function isMeetingMemoPendingApproval(
  status: string | null | undefined,
  statusLabel?: string | null
): boolean {
  if (isMeetingMemoApproved(status, statusLabel) || isMeetingMemoRejected(status, statusLabel)) {
    return false;
  }

  for (const value of [status, statusLabel]) {
    const normalized = normalizeMeetingStatusText(value);
    if (!normalized) continue;
    if (normalized.includes("несоглас")) return true;
  }

  return false;
}

/** Кнопки «Согласовать» / «Отклонить» — по статусу карточки из очереди (не detail.queue). */
export function canShowMeetingMemoDecisionActions(
  detail: MeetingMemoDetail,
  queueItem?: MeetingDashboardItem | null
): boolean {
  const status = queueItem?.status ?? detail.status;
  const statusLabel = queueItem?.status_label ?? detail.status_label;
  const visibleLabel = getMeetingStatusLabel(status, statusLabel);

  return visibleLabel !== "Согласована" && visibleLabel !== "Отклонена";
}

export function canApproveMeetingMemo(
  detail: MeetingMemoDetail,
  queueItem?: MeetingDashboardItem | null
): boolean {
  return canShowMeetingMemoDecisionActions(detail, queueItem);
}

export function countPassedStoChecklist(detail: MeetingMemoDetail): number {
  return (detail.sto_checklist ?? []).filter((item) => item.passed).length;
}

const ATTENDEE_ROLE_LABELS: Record<string, string> = {
  initiator: "Инициатор",
  manager: "Руководитель",
  participant: "Участник",
  room: "Переговорная"
};

export function getMeetingAttendeeRoleLabel(attendee: MeetingAttendee): string {
  const label = attendee.role_label?.trim();
  if (label) return label;
  return ATTENDEE_ROLE_LABELS[attendee.role] ?? attendee.role;
}

export type MeetingSlotPreviewResolved = {
  start: string;
  end: string;
  label: string;
};

function calcSlotDurationMinutes(start: string, end: string): number | null {
  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  return Math.round(durationMs / 60000);
}

function resolveAttendeeSlot(attendee: MeetingAttendee): MeetingSlotPreviewResolved | null {
  if (!attendee.nearest_slot_start || !attendee.nearest_slot_end) return null;
  return {
    start: attendee.nearest_slot_start,
    end: attendee.nearest_slot_end,
    label: attendee.nearest_slot_label?.trim() || formatMeetingTime(attendee.nearest_slot_start, attendee.nearest_slot_end)
  };
}

export function resolveMeetingSlotPreview(preview: MeetingAgentSlotPreview): MeetingSlotPreviewResolved | null {
  if (preview.search_mode === "partial") return null;

  if (preview.slot?.start && preview.slot?.end) {
    return {
      start: preview.slot.start,
      end: preview.slot.end,
      label: preview.slot_label?.trim() || formatMeetingTime(preview.slot.start, preview.slot.end)
    };
  }

  const attendeeSlots = preview.attendees
    .map(resolveAttendeeSlot)
    .filter((slot): slot is MeetingSlotPreviewResolved => Boolean(slot));

  if (!attendeeSlots.length) return null;

  const [first] = attendeeSlots;
  const allSame = attendeeSlots.every(
    (slot) => slot.start === first.start && slot.end === first.end
  );

  return allSame ? first : null;
}

export function isMeetingSlotPreviewAssignable(preview: MeetingAgentSlotPreview): boolean {
  if (preview.search_mode === "partial") return false;
  return Boolean(preview.slot?.start && preview.slot?.end);
}

export function isMeetingSlotPreviewPartial(preview: MeetingAgentSlotPreview): boolean {
  return preview.search_mode === "partial";
}

export function formatMeetingSlotCoverage(coverage?: MeetingSlotCoverage | null): string {
  if (!coverage) return "—";
  const percent = Math.round(coverage.ratio * 100);
  return `${coverage.free} из ${coverage.total} (${percent}%)`;
}

export function formatMeetingSlotCandidateCoverage(coverage: MeetingSlotCoverage): string {
  const percent = Math.round(coverage.ratio * 100);
  const weighted =
    coverage.weighted_ratio != null
      ? ` · важные: ${Math.round(coverage.weighted_ratio * 100)}%`
      : "";
  return `${coverage.free}/${coverage.total} (${percent}%)${weighted}`;
}

export function formatMeetingSlotPreviewErrorStage(stage?: string | null): string | null {
  if (!stage) return null;
  const labels: Record<string, string> = {
    onec: "1С ERP",
    participants: "участники",
    email: "e-mail",
    calendar: "календарь",
    no_slot: "нет слота",
    slot: "слот"
  };
  return labels[stage] ?? stage;
}

export function buildMeetingAttendeesByEmail(
  attendees: MeetingAttendee[]
): Record<string, MeetingAttendee> {
  return Object.fromEntries(
    attendees
      .filter((attendee) => attendee.email?.trim())
      .map((attendee) => [attendee.email!.trim().toLowerCase(), attendee])
  );
}

export function resolveMeetingAttendeeFioByEmail(
  byEmail: Record<string, MeetingAttendee>,
  email: string
): string {
  return byEmail[email.trim().toLowerCase()]?.fio ?? email;
}

export function resolveMeetingSlotCandidateTimes(
  candidate: MeetingSlotCandidate
): { start: string; end: string } | null {
  if (candidate.slot?.start && candidate.slot?.end) {
    return { start: candidate.slot.start, end: candidate.slot.end };
  }
  if (candidate.slot_start && candidate.slot_end) {
    return { start: candidate.slot_start, end: candidate.slot_end };
  }
  return null;
}

export function formatMeetingBlockingEventRange(event: MeetingSlotBlockingEvent): string {
  if (event.event_time_label?.trim()) return event.event_time_label.trim();
  if (event.event_start && event.event_end) {
    return formatMeetingTime(event.event_start, event.event_end);
  }
  return "—";
}

export function formatMeetingSlotParticipantStatus(
  participant: MeetingSlotPreviewParticipant
): string {
  if (participant.status === "free") return "Свободен";
  if (participant.status === "busy") return "Занят";
  return "Неизвестно";
}

export function filterPreviewAttendeePeople(attendees: MeetingAttendee[]): MeetingAttendee[] {
  return (attendees ?? []).filter((attendee) => attendee.role !== "room");
}

export function filterMeetingSlotPreviewPeople(
  participants?: MeetingSlotPreviewParticipant[] | null
): MeetingSlotPreviewParticipant[] {
  return (participants ?? []).filter((participant) => participant.role !== "room");
}

export function resolveMeetingSlotRoomFromAttendee(attendee: MeetingAttendee): MeetingSlotRoomStatus {
  const status =
    attendee.status ??
    (attendee.found ? "free" : attendee.found === false ? "unknown" : "unknown");

  return {
    name: attendee.fio,
    email: attendee.email,
    status,
    status_label:
      attendee.status_label?.trim() ||
      (status === "free" ? "свободна" : status === "busy" ? "занята" : "неизвестно"),
    available: status === "free"
  };
}

export function resolveMeetingSlotPreviewRoom(
  source: {
    room?: MeetingSlotRoomStatus | null;
    attendees?: MeetingAttendee[];
    participants?: MeetingSlotPreviewParticipant[] | null;
  }
): MeetingSlotRoomStatus | null {
  if (source.room) return source.room;

  const roomAttendee = (source.attendees ?? []).find((attendee) => attendee.role === "room");
  if (roomAttendee) return resolveMeetingSlotRoomFromAttendee(roomAttendee);

  const roomParticipant = (source.participants ?? []).find((participant) => participant.role === "room");
  if (!roomParticipant) return null;

  return {
    name: roomParticipant.fio,
    email: roomParticipant.email,
    status: roomParticipant.status,
    status_label:
      roomParticipant.status === "free"
        ? "свободна"
        : roomParticipant.status === "busy"
          ? "занята"
          : "неизвестно",
    available: roomParticipant.status === "free",
    calendar_access_error: roomParticipant.calendar_access_error
  };
}

export function formatMeetingConflictMovability(movability?: string | null): string {
  if (!movability) return "—";
  const normalized = movability.trim().toLowerCase();
  if (normalized === "high") return "Высокая";
  if (normalized === "medium") return "Средняя";
  if (normalized === "low") return "Низкая";
  return movability;
}

export function isMeetingSlotDetailAvailable(
  details: {
    slot_available?: boolean | null;
    can_confirm?: boolean | null;
    participants?: MeetingSlotPreviewParticipant[] | null;
    room?: MeetingSlotRoomStatus | null;
    error?: string | null;
  } | null | undefined
): boolean | null {
  if (!details || details.error) return null;
  if (typeof details.can_confirm === "boolean") return details.can_confirm;
  if (typeof details.slot_available === "boolean") return details.slot_available;

  const people = filterMeetingSlotPreviewPeople(details.participants);
  if (!people.length) return null;

  const participantsFree = people.every((participant) => participant.status === "free");
  const roomFree = !details.room || details.room.status !== "busy";
  return participantsFree && roomFree;
}

export function resolveManualSlotDefaultsFromIso(
  iso: string | null | undefined
): { initialDate?: string; initialStartTime?: string } {
  if (!iso?.trim()) return {};

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return {};

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return {
    initialDate: `${year}-${month}-${day}`,
    initialStartTime: `${hours}:${minutes}`
  };
}

export function resolveMeetingSlotPreviewLabel(preview: MeetingAgentSlotPreview): string | null {
  const resolved = resolveMeetingSlotPreview(preview);
  if (resolved) return resolved.label;

  const labels = [
    ...new Set(
      preview.attendees
        .map((attendee) => attendee.nearest_slot_label?.trim())
        .filter((label): label is string => Boolean(label))
    )
  ];

  return labels.length === 1 ? labels[0] : null;
}

export function resolveMeetingSlotPreviewDuration(preview: MeetingAgentSlotPreview): number | null {
  if (preview.duration_minutes) return preview.duration_minutes;

  const resolved = resolveMeetingSlotPreview(preview);
  if (!resolved) return null;

  return calcSlotDurationMinutes(resolved.start, resolved.end);
}

/** Нормализует ссылку OWA; открытие — только по явному клику пользователя. */
export function normalizeOutlookMeetingUrl(url: string | null | undefined): string | null {
  const normalized = url?.trim();
  return normalized || null;
}

/** @deprecated Используйте normalizeOutlookMeetingUrl — автоматический window.open убран. */
export function openOutlookMeetingUrl(url: string | null | undefined): string | null {
  return normalizeOutlookMeetingUrl(url);
}
