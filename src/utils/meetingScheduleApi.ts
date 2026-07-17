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
    }))
  };
}

export function mapScheduleFormParticipantsToApi(
  participants: ScheduleFormParticipant[]
): MeetingScheduleSeriesSavePayload["participants"] {
  return participants.map((participant, index) => ({
    ...(participant.kind === "position"
      ? { position_id: participant.id }
      : { department_id: participant.id }),
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
    .map((participant) =>
      normalizeParticipantId(participant.position_id ?? participant.department_id)
    )
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
    .map((participant) =>
      normalizeParticipantId(participant.position_id ?? participant.department_id)
    )
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

  return update;
}

export type ScheduleFormParticipant = {
  id: string;
  name: string;
  kind: "position" | "department";
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
  if (participant.position_id) {
    return {
      id: participant.position_id,
      name: participant.position_name?.trim() || participant.position_id,
      kind: "position"
    };
  }

  return {
    id: participant.department_id ?? participant.id,
    name: participant.department_name?.trim() || participant.department_id || participant.id,
    kind: "department"
  };
}

export function mapApiStatusToUi(status: ScheduledMeetingRead["status"]): MeetingScheduleStatus {
  if (status === "planned") return "scheduled";
  return status;
}

export function mapScheduledMeetingReadToSeriesItem(
  read: ScheduledMeetingRead
): MeetingScheduleSeriesItem {
  const participantRoles = [...read.participants]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map(
      (participant) =>
        participant.position_name?.trim() ||
        participant.department_name?.trim() ||
        participant.position_id ||
        participant.department_id ||
        ""
    )
    .filter((name) => name.length > 0);

  return {
    id: read.id,
    name: read.title,
    type: read.meeting_type,
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
    .map(
      (participant) =>
        participant.position_name?.trim() ||
        participant.department_name?.trim() ||
        participant.position_id ||
        participant.department_id ||
        ""
    )
    .filter((name) => name.length > 0);
}

export function normalizeMeetingScheduleDetail(
  read: ScheduledMeetingDetailRead
): MeetingScheduleSeriesDetailView {
  const pastOccurrences = (read.past_occurrences ?? []).map(mapOccurrenceToView);
  const nextOccurrence = read.next_occurrence ? mapOccurrenceToView(read.next_occurrence) : null;
  const usesRuleFallback =
    nextOccurrence?.source === "rule" || pastOccurrences.some((item) => item.source === "rule");

  return {
    seriesTitle: read.series.title,
    nextOccurrence,
    pastOccurrences,
    comment: read.series.payload?.comment ?? null,
    participants: mapSeriesParticipants(read.series),
    recurrenceLabel: read.series.recurrence_label,
    outlookMeetingUrl: read.series.outlook_meeting_url,
    usesRuleFallback
  };
}
