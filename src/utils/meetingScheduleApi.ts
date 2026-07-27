import type {
  MeetingScheduleContext,
  MeetingScheduleOccurrenceView,
  MeetingScheduleRecurrenceRule,
  MeetingScheduleSeriesDetailView,
  MeetingScheduleSeriesItem,
  MeetingScheduleSeriesSavePayload,
  MeetingScheduleStatus,
  MeetingScheduleType,
  MeetingScheduleTypeCounts,
  MeetingScheduleWeekday,
  ScheduledMeetingApiWeekday,
  ScheduledMeetingCreate,
  ScheduledMeetingDetailRead,
  ScheduledMeetingOccurrence,
  ScheduledMeetingParticipantRead,
  ScheduledMeetingRead,
  ScheduledMeetingRecurrenceCreate,
  ScheduledMeetingUpdate
} from "@/types/meetings";
import {
  formatScheduledOccurrenceCalendarParts,
  formatScheduledOccurrenceDate,
  formatScheduledOccurrenceListDate,
  formatScheduledOccurrenceTimeRange
} from "@/utils/meetingSchedule";

const weekdayToApi: Record<MeetingScheduleWeekday, ScheduledMeetingApiWeekday> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday"
};

export function toApiWeekday(weekday: MeetingScheduleWeekday): ScheduledMeetingApiWeekday {
  return weekdayToApi[weekday];
}

export function mapRecurrenceRuleToApi(
  recurrence: MeetingScheduleRecurrenceRule
): ScheduledMeetingRecurrenceCreate {
  const base: ScheduledMeetingRecurrenceCreate = {
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    time_local: recurrence.time_local,
    duration_minutes: recurrence.duration_minutes
  };

  if (recurrence.frequency === "weekly" && recurrence.weekday) {
    return {
      ...base,
      weekday: toApiWeekday(recurrence.weekday)
    };
  }

  if (recurrence.frequency === "monthly") {
    if (recurrence.monthly_mode === "by_day_of_month" && recurrence.day_of_month) {
      return {
        ...base,
        monthly_mode: "by_day_of_month",
        day_of_month: recurrence.day_of_month
      };
    }

    if (
      recurrence.monthly_mode === "by_weekday_position" &&
      recurrence.monthly_weekday &&
      recurrence.weekday_position
    ) {
      return {
        ...base,
        monthly_mode: "by_weekday_position",
        weekday: toApiWeekday(recurrence.monthly_weekday),
        weekday_position: recurrence.weekday_position
      };
    }
  }

  return base;
}

export function mapScheduleFormToApiPayload(
  payload: MeetingScheduleSeriesSavePayload
): ScheduledMeetingCreate {
  return {
    title: payload.title,
    meeting_category_id: payload.meeting_category_id,
    manager_user_id: payload.manager_user_id,
    responsible_user_id: payload.responsible_user_id,
    manager_person_fio: payload.manager_person_fio,
    manager_person_email: payload.manager_person_email,
    responsible_person_fio: payload.responsible_person_fio,
    responsible_person_email: payload.responsible_person_email,
    manager_position_id: payload.manager_position_id ?? undefined,
    responsible_position_id: payload.responsible_position_id ?? undefined,
    meeting_type: payload.meeting_type,
    status: payload.status,
    series_start_date: payload.series_start_date ?? undefined,
    series_end_date: payload.series_end_date ?? undefined,
    comment: payload.comment,
    recurrence: mapRecurrenceRuleToApi(payload.recurrence),
    participants: payload.participants.map((participant, index) => ({
      ...participant,
      sort_order: participant.sort_order ?? index,
      is_required: participant.is_required ?? true
    })),
    payload: payload.payload ?? undefined
  };
}

export function mapScheduleFormParticipantsToApi(
  participants: ScheduleFormParticipant[]
): MeetingScheduleSeriesSavePayload["participants"] {
  return participants.map((participant, index) => ({
    user_id: participant.id,
    person_fio: participant.name,
    person_email: participant.email,
    position_id: participant.positionId ?? undefined,
    sort_order: index,
    is_required: true
  }));
}

function normalizeParticipantId(id: string | null | undefined): string {
  return (id ?? "").trim().toLowerCase();
}

function mapParticipantIds(read: ScheduledMeetingRead): string[] {
  return [...read.participants]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((participant) => normalizeParticipantId(participant.user_id))
    .filter((id) => id.length > 0);
}

export function mapScheduleFormToUpdatePayload(
  original: ScheduledMeetingRead,
  payload: MeetingScheduleSeriesSavePayload
): ScheduledMeetingUpdate {
  const update: ScheduledMeetingUpdate = {};

  const originalEnd = original.series_end_date?.slice(0, 10) ?? null;
  const nextEnd = payload.series_end_date?.slice(0, 10) ?? null;
  if (nextEnd !== originalEnd) {
    update.series_end_date = nextEnd ?? undefined;
  }

  const originalComment =
    typeof original.payload?.comment === "string" ? original.payload.comment.trim() || null : null;
  const nextComment = payload.comment?.trim() || null;
  if (nextComment !== originalComment) {
    update.comment = nextComment;
  }

  const originalParticipantIds = mapParticipantIds(original);
  const nextParticipantIds = payload.participants
    .map((participant) => normalizeParticipantId(participant.user_id))
    .filter((id) => id.length > 0);
  const participantsChanged =
    originalParticipantIds.length !== nextParticipantIds.length ||
    originalParticipantIds.some((id, index) => id !== nextParticipantIds[index]);
  if (participantsChanged) {
    update.participants = payload.participants.map((participant, index) => ({
      ...participant,
      sort_order: participant.sort_order ?? index,
      is_required: participant.is_required ?? true
    }));
  }

  update.recurrence = mapRecurrenceRuleToApi(payload.recurrence);

  return update;
}

export type ScheduleFormParticipant = {
  id: string;
  name: string;
  email: string;
  positionName?: string | null;
  positionId?: string | null;
  kind: "employee";
};

export function mapScheduledMeetingReadToFormParticipants(
  read: ScheduledMeetingRead
): ScheduleFormParticipant[] {
  return [...read.participants]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((participant) => mapScheduledMeetingParticipantReadToForm(participant));
}

function mapScheduledMeetingParticipantReadToForm(
  participant: ScheduledMeetingParticipantRead
): ScheduleFormParticipant {
  const name =
    participant.person_fio?.trim() ||
    participant.position_name?.trim() ||
    participant.person_email?.trim() ||
    "";

  return {
    id: participant.user_id ?? participant.id,
    name,
    email: participant.person_email?.trim() || "",
    positionName: participant.position_name?.trim() || null,
    positionId: participant.position_id ?? participant.department_id ?? null,
    kind: "employee"
  };
}

export function mapApiStatusToUi(status: ScheduledMeetingRead["status"]): MeetingScheduleStatus {
  if (status === "planned") return "scheduled";
  return status;
}

function participantDisplayName(participant: ScheduledMeetingParticipantRead): string {
  const fio = participant.person_fio?.trim();
  if (fio && !isUuidLike(fio)) {
    return fio;
  }

  const position =
    participant.position_name?.trim() || participant.department_name?.trim();
  if (position) {
    return position;
  }

  const email = participant.person_email?.trim();
  if (email) {
    return email;
  }

  return "";
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export function mapScheduledMeetingReadToSeriesItem(
  read: ScheduledMeetingRead
): MeetingScheduleSeriesItem {
  const participantRoles = [...read.participants]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map(participantDisplayName)
    .filter((name) => name.length > 0);

  return {
    id: read.id,
    name: read.title,
    type: read.meeting_type,
    meeting_category_id: read.meeting_category_id,
    meeting_category_name: read.meeting_category_name,
    manager_user_id: read.manager_user_id,
    manager_user_fio: read.manager_user_fio,
    manager_position_id: read.manager_position_id,
    manager_position_name: read.manager_position_name,
    responsible_user_id: read.responsible_user_id,
    responsible_user_fio: read.responsible_user_fio,
    responsible_position_id: read.responsible_position_id,
    responsible_position_name: read.responsible_position_name,
    participant_roles: participantRoles,
    extra_participants_count: Math.max(participantRoles.length - 2, 0),
    frequency_label: read.recurrence_label,
    recurrence_label: read.recurrence_label,
    deadline_start: read.series_start_date,
    deadline_end: read.series_end_date,
    status: mapApiStatusToUi(read.status),
    comment: read.payload?.comment ?? null,
    outlook_series_id: read.outlook_series_id,
    outlook_changekey: read.outlook_changekey,
    outlook_meeting_url: read.outlook_meeting_url
  };
}

export function canPlanMeetingScheduleSeries(item: MeetingScheduleSeriesItem): boolean {
  return item.status === "created" && !item.outlook_series_id;
}

export function canCancelMeetingScheduleSeries(item: MeetingScheduleSeriesItem): boolean {
  return item.status === "scheduled";
}

export function canEditMeetingScheduleSeries(item: MeetingScheduleSeriesItem): boolean {
  return item.status !== "archive";
}

export function buildMeetingScheduleTypeCounts(
  items: MeetingScheduleSeriesItem[]
): MeetingScheduleTypeCounts {
  return items.reduce<MeetingScheduleTypeCounts>(
    (counts, item) => {
      counts.total += 1;
      counts[item.type] += 1;
      return counts;
    },
    { total: 0, planned: 0, report: 0, selector: 0, unplanned: 0 }
  );
}

export function incrementMeetingScheduleTypeCounts(
  counts: MeetingScheduleTypeCounts,
  type: MeetingScheduleType
): MeetingScheduleTypeCounts {
  return {
    ...counts,
    total: counts.total + 1,
    [type]: counts[type] + 1
  };
}

export function mapScheduledMeetingsToContext(readItems: ScheduledMeetingRead[]) {
  const items = readItems.map(mapScheduledMeetingReadToSeriesItem);

  return {
    type_counts: buildMeetingScheduleTypeCounts(items),
    items,
    fetched_at: new Date().toISOString()
  };
}

export function updateMeetingScheduleItem(
  context: MeetingScheduleContext,
  read: ScheduledMeetingRead
): MeetingScheduleContext {
  const nextItem = mapScheduledMeetingReadToSeriesItem(read);
  const hasItem = context.items.some((item) => item.id === nextItem.id);

  return {
    ...context,
    fetched_at: new Date().toISOString(),
    items: hasItem
      ? context.items.map((item) => (item.id === nextItem.id ? nextItem : item))
      : [...context.items, nextItem]
  };
}

function mapOccurrenceToView(occurrence: ScheduledMeetingOccurrence): MeetingScheduleOccurrenceView {
  const calendarParts = formatScheduledOccurrenceCalendarParts(
    occurrence.slot_start,
    occurrence.occurrence_date
  );

  return {
    occurrenceKey:
      occurrence.outlook_item_id ?? `${occurrence.slot_start}|${occurrence.slot_end}`,
    dateLabel: formatScheduledOccurrenceDate(occurrence.slot_start, occurrence.occurrence_date),
    listDateLabel: formatScheduledOccurrenceListDate(
      occurrence.slot_start,
      occurrence.occurrence_date
    ),
    calendarDayLabel: calendarParts.dayLabel,
    calendarMonthLabel: calendarParts.monthLabel,
    timeRangeLabel: formatScheduledOccurrenceTimeRange(occurrence.slot_start, occurrence.slot_end),
    subject: occurrence.subject,
    outlookMeetingUrl: occurrence.outlook_meeting_url,
    source: occurrence.source
  };
}

function mapSeriesParticipants(read: ScheduledMeetingRead): string[] {
  return [...read.participants]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map(participantDisplayName)
    .filter((name) => name.length > 0);
}

export function normalizeMeetingScheduleDetail(
  read: ScheduledMeetingDetailRead
): MeetingScheduleSeriesDetailView {
  const pastOccurrences = (read.past_occurrences ?? []).map(mapOccurrenceToView);
  const upcomingOccurrences = (read.upcoming_occurrences ?? []).map(mapOccurrenceToView);
  const nextOccurrence = read.next_occurrence ? mapOccurrenceToView(read.next_occurrence) : null;
  const usesRuleFallback =
    nextOccurrence?.source === "rule" ||
    pastOccurrences.some((item) => item.source === "rule") ||
    upcomingOccurrences.some((item) => item.source === "rule");

  return {
    seriesTitle: read.series.title,
    nextOccurrence,
    upcomingOccurrences,
    pastOccurrences,
    comment: read.series.payload?.comment ?? null,
    participants: mapSeriesParticipants(read.series),
    recurrenceLabel: read.series.recurrence_label,
    occurrenceCount:
      read.series.occurrence_count ??
      (upcomingOccurrences.length > 0 ? upcomingOccurrences.length : null),
    outlookMeetingUrl: read.series.outlook_meeting_url,
    usesRuleFallback
  };
}
