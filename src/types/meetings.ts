export interface MeetingDashboardItem {
  ref_key: string | null;
  number: string | null;
  title?: string | null;
  status: string | null;
  status_label?: string | null;
  meeting_type: string | null;
  meeting_type_label?: string | null;
  document_date: string | null;
  scheduled_label?: string | null;
  meeting_date: string | null;
  desired_meeting_date: string | null;
  meeting_start: string | null;
  meeting_end: string | null;
  participants_count?: number;
  participant_names?: string[];
  warnings?: string[];
  subject: string | null;
  comment: string | null;
  location: string | null;
  initiator?: MeetingPerson | null;
  manager?: MeetingPerson | null;
  psd_level?: boolean;
  series_detected?: boolean;
  series_recurrence_label?: string | null;
}

export interface MeetingLoginContext {
  date: string;
  unapproved: MeetingDashboardItem[];
  today: MeetingDashboardItem[];
  items?: MeetingDashboardItem[];
  counts: {
    unapproved?: number;
    today?: number;
    items?: number;
    [key: string]: number | undefined;
  };
  fetched_at: string;
  error: string | null;
}

export interface MeetingPermissions {
  can_access_agent: boolean;
  can_manage_meetings: boolean;
}

export interface MeetingPerson {
  ref_key: string | null;
  full_name: string | null;
  department: string | null;
  position: string | null;
}

export interface MeetingParticipantDetail {
  ref_key: string | null;
  full_name: string | null;
  department: string | null;
}

export interface MeetingValidationCheck {
  field: string;
  label: string;
  severity: string;
  message: string;
  passed: boolean;
}

export interface MeetingStoChecklistItem {
  field: string;
  label: string;
  passed: boolean;
  message: string;
}

export interface MeetingStoIssue {
  field: string;
  message: string;
}

export interface MeetingHistoryEvent {
  timestamp: string;
  message: string;
}

export type MeetingSeriesPlanningConfidence = "high" | "medium" | "low";
export type MeetingSeriesPlanningMode = "series" | "single";

export interface MeetingMemoSeriesPlanning {
  detected: boolean;
  requires_user_choice: boolean;
  confidence: MeetingSeriesPlanningConfidence;
  recurrence_label: string | null;
  series_start_date: string | null;
  series_end_date: string | null;
  occurrence_count: number | null;
  source_quote: string | null;
  ambiguities: string[];
  planning_options: MeetingSeriesPlanningMode[];
  selected_mode: MeetingSeriesPlanningMode | null;
}

export interface MeetingMemoSeriesPlanningChoiceRequest {
  mode: MeetingSeriesPlanningMode;
}

export interface MeetingMemoSeriesPlanningChoiceRead {
  ref_key: string;
  mode: MeetingSeriesPlanningMode;
  stored: boolean;
}

export interface MeetingMemoSeriesCreateRead {
  ref_key: string;
  scheduled_meeting_id: string;
  scheduled_meeting_title: string;
  recurrence_label: string | null;
  occurrence_count?: number | null;
  memo_approved?: boolean;
  memo_approve_message?: string | null;
}

export interface MeetingMemoSeriesCreateRequest {
  meeting_topic?: Record<string, unknown> | null;
}

export interface MeetingApplication {
  initiator: MeetingPerson | null;
  manager: MeetingPerson | null;
  participants: MeetingParticipantDetail[];
  participants_count: number;
  agenda: string | null;
  memo_text: string | null;
  scheduled_label: string | null;
  document_date: string | null;
  meeting_start: string | null;
  meeting_end: string | null;
  duration_minutes: number | null;
  location: string | null;
  invite_location?: string | null;
  meeting_type: string | null;
  meeting_type_label: string | null;
  priority: string | null;
  psd_level?: boolean;
}

export interface MeetingMemoDetail {
  ref_key: string | null;
  number: string | null;
  title: string | null;
  status: string | null;
  status_label: string | null;
  queue: MeetingDashboardItem;
  application: MeetingApplication;
  validation_checks: MeetingValidationCheck[];
  warnings: string[];
  history: MeetingHistoryEvent[];
  agent_recommendation: string | null;
  sto_ready?: boolean;
  auto_approve_allowed?: boolean;
  sto_checklist?: MeetingStoChecklistItem[];
  sto_issues?: MeetingStoIssue[];
  series_planning?: MeetingMemoSeriesPlanning | null;
}

export interface MeetingSlot {
  start: string;
  end: string;
  confidence: number;
}

export interface MeetingRunCreate {
  memo_ref_key?: string;
  memo_number?: string | null;
  meeting_type?: string | null;
  subject?: string | null;
  planned_start?: string | null;
  duration_minutes?: number | null;
  participant_fio?: string[];
  room_name?: string | null;
  initiator_comment?: string | null;
  title?: string | null;
}

export interface MeetingRun {
  task_id: string;
  status: string;
  celery_task_id: string | null;
  requires_human_review: boolean;
}

export interface MeetingRunResult {
  task_id: string;
  status: string;
  summary: string | null;
  result: Record<string, unknown> | null;
  requires_human_review: boolean;
  error_message: string | null;
}

export interface MeetingSlotsRequest {
  memo_ref_key?: string;
  memo_number?: string | null;
  participant_fio?: string[];
  planned_start?: string | null;
  duration_minutes?: number | null;
}

export interface MeetingAgentSlotPreviewRequest {
  duration_minutes?: number | null;
}

export type MeetingSlotSearchMode = "all" | "partial";

export type MeetingSlotPreviewErrorStage =
  | "onec"
  | "participants"
  | "email"
  | "calendar"
  | "no_slot"
  | "slot";

export interface MeetingSlotCoverage {
  free: number;
  total: number;
  ratio: number;
  weighted_ratio?: number;
  required_ok?: boolean;
}

export interface MeetingSlotConflict {
  fio: string;
  email?: string | null;
  event_subject?: string | null;
  movability?: string | null;
  reschedule_hint_label?: string | null;
  event_attendees?: string[];
  event_attendee_names?: string[];
}

export interface MeetingSlotCandidate {
  slot?: MeetingSlot | null;
  slot_start?: string | null;
  slot_end?: string | null;
  slot_label: string;
  coverage: MeetingSlotCoverage;
  free_attendees: string[];
  busy_attendees: string[];
  conflicts?: MeetingSlotConflict[];
  verified?: boolean;
  impact_score?: number;
  busy_weight_cost?: number;
  reschedule_count?: number;
  low_movability_count?: number;
}

export interface MeetingAgentSlotPreviewDetailsRequest {
  slot_start: string;
  slot_end: string;
  duration_minutes?: number;
  availability_cache_id?: string | null;
}

export interface MeetingSlotBlockingEvent {
  event_label: string;
  event_subject?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  event_start_iso?: string | null;
  event_end_iso?: string | null;
  event_time_label?: string | null;
  organizer?: string | null;
  movability?: string | null;
  movability_reason?: string | null;
  source?: string | null;
  reschedule_hint_start?: string | null;
  reschedule_hint_end?: string | null;
  reschedule_hint_label?: string | null;
  event_attendees?: string[];
  event_attendee_names?: string[];
}

export interface MeetingSlotPreviewParticipant {
  fio: string;
  email: string | null;
  role: string;
  role_label?: string | null;
  status: "free" | "busy" | "unknown";
  blocking_events: MeetingSlotBlockingEvent[];
  calendar_access_error?: string | null;
}

export interface MeetingSlotRescheduleRecommendation {
  participant_fio: string;
  event_label: string;
  event_time_label?: string | null;
  reschedule_hint_label?: string | null;
}

export interface MeetingAgentSlotPreviewDetails {
  memo_ref_key: string;
  slot_start: string;
  slot_end: string;
  slot_label: string;
  duration_minutes?: number | null;
  participants: MeetingSlotPreviewParticipant[];
  room?: MeetingSlotRoomStatus | null;
  slot_available?: boolean | null;
  can_confirm?: boolean | null;
  requires_reschedule?: boolean;
  reschedule_recommendations?: MeetingSlotRescheduleRecommendation[];
  company_calendar_cache_id?: string | null;
  error?: string | null;
  error_stage?: MeetingSlotPreviewErrorStage | null;
}

export interface MeetingSlotRoomStatus {
  name: string;
  email?: string | null;
  status: "free" | "busy" | "unknown";
  status_label: string;
  available?: boolean | null;
  calendar_access_error?: string | null;
}

export interface MeetingAttendee {
  fio: string;
  email: string | null;
  role: string;
  role_label?: string;
  found: boolean;
  status?: "free" | "busy" | "unknown";
  status_label?: string | null;
  nearest_slot_start?: string | null;
  nearest_slot_end?: string | null;
  nearest_slot_label?: string | null;
}

export interface MeetingAgentSlotPreview {
  memo_ref_key?: string;
  search_mode?: MeetingSlotSearchMode;
  slot?: MeetingSlot | null;
  slot_label?: string | null;
  duration_minutes?: number | null;
  availability_cache_id?: string | null;
  preview_note?: string | null;
  coverage?: MeetingSlotCoverage | null;
  slot_candidates?: MeetingSlotCandidate[];
  conflicts?: MeetingSlotConflict[];
  attendees: MeetingAttendee[];
  room?: MeetingSlotRoomStatus | null;
  missing_emails?: string[];
  error?: string | null;
  error_stage?: MeetingSlotPreviewErrorStage | null;
}

export interface MeetingAgentSlotApproveRequest {
  slot_start: string;
  slot_end: string;
  subject?: string | null;
  location?: string | null;
  attendees?: MeetingAttendee[];
  attendee_emails?: string[];
  participants?: MeetingSlotPreviewParticipant[];
  company_calendar_cache_id?: string | null;
  reschedule_message?: string | null;
  meeting_topic?: Record<string, unknown> | null;
}

export interface MeetingAgentSlotApprove {
  memo_ref_key: string;
  subject: string;
  start: string;
  end: string;
  slot_label: string;
  location: string | null;
  attendees: string[];
  attendee_details: MeetingAttendee[];
  sent: boolean;
  outlook_item_id?: string | null;
  outlook_changekey?: string | null;
  outlook_meeting_url?: string | null;
  rescheduled_events?: string[];
}

export interface MeetingMemoRejectRequest {
  reason: string;
  notify_initiator?: boolean;
}

export interface MeetingMemoRejectRead {
  ref_key: string;
  number: string | null;
  status: string;
  status_label?: string | null;
  reason: string | null;
  changed: boolean;
  already_rejected: boolean;
  notification_sent: boolean;
  message?: string | null;
}

export interface MeetingMemoApproveRequest {
  comment?: string | null;
}

export interface MeetingMemoApproveRead {
  ref_key: string;
  number: string | null;
  status: string;
  changed: boolean;
  already_approved: boolean;
  sto_ready: boolean;
  message: string;
}

export type MeetingRegistryStage =
  | "invitations_sent"
  | "protocol_created"
  | "protocol_conducted"
  | "meeting_completed"
  | "cancelled";

export type MeetingRegistryStageFilter = MeetingRegistryStage | "all" | "approved";

export interface MeetingRegistryItem {
  ref_key: string;
  memo_number: string | null;
  title: string | null;
  subject: string | null;
  location: string | null;
  initiator_name: string | null;
  manager_name: string | null;
  participants_count: number;
  slot_start: string | null;
  slot_end: string | null;
  stage: MeetingRegistryStage;
  invitations_sent_at: string;
  approved_at: string | null;
  protocol_number: string | null;
  protocol_draft_at: string | null;
  protocol_draft_created_at: string | null;
  protocol_draft_error: string | null;
  can_cancel?: boolean;
  actions_locked?: boolean;
  cancelled_at: string | null;
  updated_at: string;
}

export interface MeetingRegistryCancelRequest {
  message?: string;
}

export interface MeetingRegistryCancelResponse {
  ref_key: string;
  stage: "cancelled";
  cancelled: boolean;
  outlook_cancelled: boolean;
  message: string | null;
  cancelled_at: string | null;
}

export interface MeetingRegistryProtocolCreateResponse {
  ref_key: string;
  created: boolean;
  skipped: boolean;
  reason?: string | null;
  message?: string | null;
  protocol_ref_key?: string | null;
  protocol_number?: string | null;
  stage?: MeetingRegistryStage | null;
  protocol_draft_created_at?: string | null;
}

export type MeetingRegistryReschedulableStage = "invitations_sent" | "cancelled";

export interface MeetingRegistryRescheduleSlotPreviewRequest {
  duration_minutes?: number;
}

export interface MeetingRegistryRescheduleSlotPreviewResponse {
  ref_key: string;
  stage: MeetingRegistryReschedulableStage | MeetingRegistryStage;
  previous_slot_start: string | null;
  previous_slot_end: string | null;
  previous_slot_label: string | null;
  search_after: string | null;
  slot_preview: MeetingAgentSlotPreview;
}

export interface MeetingRegistryRescheduleApproveRequest {
  slot_start: string;
  slot_end: string;
  subject?: string;
  location?: string;
  attendees?: MeetingAttendee[];
  attendee_emails?: string[];
  message?: string;
}

export interface MeetingRegistryRescheduleApproveResponse {
  ref_key: string;
  stage: "invitations_sent";
  previous_slot_label?: string | null;
  slot_label?: string | null;
  subject: string;
  start: string;
  end: string;
  location?: string | null;
  attendees: string[];
  rescheduled: boolean;
  outlook_updated: boolean;
  new_invite_sent: boolean;
  message?: string | null;
  outlook_item_id?: string | null;
  outlook_changekey?: string | null;
  outlook_meeting_url?: string | null;
}

export interface MeetingRegistryContext {
  items: MeetingRegistryItem[];
  stage_counts: Record<string, number>;
  fetched_at: string;
  error: string | null;
}

export type MeetingRegistryConfirmationKind =
  | "add_current_slot"
  | "add_reschedule"
  | "removal"
  | null;

export interface MeetingRegistryParticipantsResponse {
  ref_key: string;
  participants: string[];
  participants_count: number;
  pending_confirmation?: boolean;
  pending_added?: string[];
  pending_removed?: string[];
  pending_participants?: string[] | null;
  confirmation_kind?: MeetingRegistryConfirmationKind;
  fetched_at: string;
}

export interface MeetingRegistryParticipantSuggestion {
  fio: string;
  email: string;
  already_added: boolean;
}

export interface MeetingRegistryParticipantSearchResponse {
  query: string;
  fio: string;
  email: string | null;
  found: boolean;
  already_added: boolean;
  can_add: boolean;
  suggestions: MeetingRegistryParticipantSuggestion[];
  message: string | null;
}

export interface MeetingRegistryParticipantsApplyRequest {
  added: string[];
  removed: string[];
  participants: string[];
  message?: string;
}

export interface MeetingRegistryEarlierSlotCandidate {
  slot_start: string;
  slot_end: string;
  slot_label: string;
  coverage_ratio: number | null;
  free_attendees_count: number | null;
}

export interface MeetingRegistryEarlierSlotSuggestion {
  message: string;
  current_slot_label: string;
  search_from?: string;
  search_until?: string;
  candidates: MeetingRegistryEarlierSlotCandidate[];
}

export type MeetingRegistryCommonSlotSuggestion = MeetingRegistryEarlierSlotSuggestion;

export interface MeetingRegistryCurrentSlotAvailability {
  slot_label: string;
  free_count: number;
  total_count: number;
  all_free: boolean;
  participants: MeetingSlotPreviewParticipant[];
}

export interface MeetingRegistryParticipantsApplyResponse {
  ref_key: string;
  participants: string[];
  participants_count: number;
  added: string[];
  removed: string[];
  outlook_updated: boolean;
  outlook_warning: string | null;
  message: string | null;
  earlier_slot_suggestion: MeetingRegistryEarlierSlotSuggestion | null;
  common_slot_suggestion: MeetingRegistryCommonSlotSuggestion | null;
  current_slot_availability?: MeetingRegistryCurrentSlotAvailability | null;
  reschedule_recommendations?: MeetingSlotRescheduleRecommendation[];
  requires_reschedule?: boolean;
  confirmation_kind: MeetingRegistryConfirmationKind;
  pending_confirmation: boolean;
  fetched_at: string;
}

export interface MeetingRegistryParticipantsAddConfirmRequest {
  participants: string[];
  added: string[];
  slot_start?: string;
  slot_end?: string;
  message?: string;
}

export interface MeetingRegistryParticipantsAddConfirmResponse {
  ref_key: string;
  participants: string[];
  participants_count: number;
  added: string[];
  previous_slot_label: string | null;
  slot_label: string | null;
  slot_start: string | null;
  slot_end: string | null;
  outlook_updated: boolean;
  message: string | null;
  fetched_at: string;
}

export interface MeetingRegistryParticipantsRemovalConfirmRequest {
  participants: string[];
  removed: string[];
  slot_start: string;
  slot_end: string;
  message?: string;
}

export interface MeetingRegistryParticipantsRemovalConfirmResponse {
  ref_key: string;
  participants: string[];
  participants_count: number;
  removed: string[];
  previous_slot_label: string | null;
  slot_label: string;
  slot_start: string;
  slot_end: string;
  outlook_updated: boolean;
  message: string | null;
  fetched_at: string;
}

export type MeetingScheduleType = "planned" | "report" | "selector" | "unplanned";

export type MeetingScheduleStatus = "scheduled" | "created" | "archive";

export type MeetingScheduleRecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type MeetingScheduleRecurrenceCustomUnit = "days" | "weeks" | "months";

export type MeetingScheduleWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type MeetingScheduleWeekdayPosition = "first" | "second" | "third" | "fourth" | "last";

export type MeetingScheduleMonthlyMode = "by_day_of_month" | "by_weekday_position";

export type MeetingScheduleHowOftenPreset =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export interface MeetingScheduleRecurrenceRule {
  frequency: MeetingScheduleRecurrenceFrequency;
  interval: number;
  time_local: string;
  duration_minutes: number;
  weekday?: MeetingScheduleWeekday;
  monthly_mode?: MeetingScheduleMonthlyMode;
  day_of_month?: number;
  weekday_position?: MeetingScheduleWeekdayPosition;
  monthly_weekday?: MeetingScheduleWeekday;
  custom_unit?: MeetingScheduleRecurrenceCustomUnit;
}

export interface MeetingScheduleRecurrenceFormState {
  preset: MeetingScheduleHowOftenPreset;
  customInterval: number;
  customUnit: MeetingScheduleRecurrenceCustomUnit;
  weekday: MeetingScheduleWeekday;
  monthlyMode: MeetingScheduleMonthlyMode;
  dayOfMonth: number;
  weekdayPosition: MeetingScheduleWeekdayPosition;
  monthlyWeekday: MeetingScheduleWeekday;
  timeLocal: string;
  durationMinutes: number;
}

export interface MeetingScheduleSeriesItem {
  id: string;
  name: string;
  type: MeetingScheduleType;
  type_label?: string | null;
  meeting_category_id?: string | null;
  meeting_category_name?: string | null;
  manager_user_id?: string | null;
  manager_user_fio?: string | null;
  manager_position_id?: string | null;
  manager_position_name?: string | null;
  responsible_user_id?: string | null;
  responsible_user_fio?: string | null;
  responsible_position_id?: string | null;
  responsible_position_name?: string | null;
  participant_roles: string[];
  extra_participants_count?: number;
  frequency_label: string;
  recurrence_label?: string | null;
  recurrence?: MeetingScheduleRecurrenceRule | null;
  deadline_start: string | null;
  deadline_end: string | null;
  status: MeetingScheduleStatus;
  status_label?: string | null;
  comment?: string | null;
  sort_order?: number;
  outlook_series_id?: string | null;
  outlook_changekey?: string | null;
  outlook_meeting_url?: string | null;
}

export interface ScheduledMeetingOccurrence {
  occurrence_date: string;
  slot_start: string;
  slot_end: string;
  subject: string;
  outlook_item_id: string | null;
  outlook_meeting_url: string | null;
  source: "outlook" | "rule" | "none";
}

export interface MeetingScheduleOccurrenceView {
  occurrenceKey: string;
  dateLabel: string;
  listDateLabel: string;
  calendarDayLabel: string;
  calendarMonthLabel: string;
  timeRangeLabel: string;
  subject: string;
  outlookMeetingUrl: string | null;
  source: ScheduledMeetingOccurrence["source"];
}

export interface MeetingScheduleSeriesDetailView {
  seriesTitle: string;
  nextOccurrence: MeetingScheduleOccurrenceView | null;
  upcomingOccurrences: MeetingScheduleOccurrenceView[];
  pastOccurrences: MeetingScheduleOccurrenceView[];
  comment: string | null;
  participants: string[];
  recurrenceLabel: string;
  occurrenceCount: number | null;
  outlookMeetingUrl: string | null;
  usesRuleFallback: boolean;
}

export interface MeetingSchedulePastMeeting {
  id: string;
  date_label: string;
  time_label: string;
  protocol_number?: string | null;
  outcome_label: string;
  outcome_tone: "success" | "neutral" | "warning";
}

export interface MeetingScheduleNextMeeting {
  date_label: string;
  time_range_label: string;
  format_label: string;
}

export interface MeetingScheduleSeriesDetail {
  series_id: string;
  past_meetings: MeetingSchedulePastMeeting[];
  next_meeting: MeetingScheduleNextMeeting | null;
}

export interface MeetingScheduleTypeCounts {
  total: number;
  planned: number;
  report: number;
  selector: number;
  unplanned: number;
}

export interface MeetingScheduleContext {
  type_counts: MeetingScheduleTypeCounts;
  items: MeetingScheduleSeriesItem[];
  fetched_at: string;
}

export interface MeetingScheduleSeriesSavePayload {
  title: string;
  meeting_category_id: string;
  manager_user_id: string;
  responsible_user_id: string;
  manager_person_fio?: string;
  manager_person_email?: string;
  responsible_person_fio?: string;
  responsible_person_email?: string;
  manager_position_id?: string | null;
  responsible_position_id?: string | null;
  meeting_type: MeetingScheduleType;
  status: ScheduledMeetingStatus;
  participants: ScheduledMeetingParticipantCreate[];
  recurrence: MeetingScheduleRecurrenceRule;
  comment?: string | null;
  series_start_date?: string | null;
  series_end_date?: string | null;
  payload?: Record<string, unknown> | null;
}

export type ScheduledMeetingStatus = "planned" | "created" | "archive";

export type ScheduledMeetingApiWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface ScheduledMeetingRecurrenceCreate {
  frequency: MeetingScheduleRecurrenceFrequency;
  interval?: number;
  time_local: string;
  duration_minutes?: number;
  monthly_mode?: MeetingScheduleMonthlyMode;
  day_of_month?: number;
  weekday?: ScheduledMeetingApiWeekday;
  weekday_position?: MeetingScheduleWeekdayPosition;
  series_start_date?: string;
  series_end_date?: string;
}

export interface ScheduledMeetingParticipantCreate {
  user_id?: string;
  person_fio?: string;
  person_email?: string;
  department_id?: string;
  position_id?: string;
  sort_order?: number;
  is_required?: boolean;
}

export interface MeetingCategoryRead {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface ScheduledMeetingCreate {
  title: string;
  meeting_category_id: string;
  manager_user_id: string;
  responsible_user_id: string;
  manager_person_fio?: string;
  manager_person_email?: string;
  responsible_person_fio?: string;
  responsible_person_email?: string;
  manager_position_id?: string;
  responsible_position_id?: string;
  meeting_type: MeetingScheduleType;
  status?: ScheduledMeetingStatus;
  series_start_date?: string;
  series_end_date?: string;
  comment?: string | null;
  recurrence: ScheduledMeetingRecurrenceCreate;
  participants: ScheduledMeetingParticipantCreate[];
  payload?: Record<string, unknown> | null;
}

export interface ScheduledMeetingEmployeeOption {
  id: string;
  fio: string;
  email: string;
  position_name?: string | null;
  position_id?: string | null;
}

export interface ScheduledMeetingPositionResolveItem {
  position_id: string;
  position_name: string;
  status: "resolved" | "ambiguous" | "empty" | "not_found";
  employee: ScheduledMeetingEmployeeOption | null;
  candidates: ScheduledMeetingEmployeeOption[];
}

export interface ScheduledMeetingPositionResolveRead {
  items: ScheduledMeetingPositionResolveItem[];
}

export interface ScheduledMeetingParticipantRead {
  id: string;
  user_id?: string | null;
  person_fio?: string | null;
  person_email?: string | null;
  department_id?: string;
  department_name?: string | null;
  position_id?: string;
  position_name?: string | null;
  sort_order: number;
  is_required: boolean;
}

export interface ScheduledMeetingParticipantOption {
  id: string;
  name: string;
}

export interface ScheduledMeetingCancelRequest {
  message?: string;
}

export interface ScheduledMeetingCancelRead {
  series: ScheduledMeetingRead;
  cancelled: boolean;
  outlook_cancelled: boolean;
  outlook_warning?: string | null;
  registry_warning?: string | null;
  message?: string | null;
}

export type ScheduledMeetingConflictPolicy = "strict" | "soft_week" | "skip";
export type ScheduledMeetingPlanOccurrenceStatus =
  | "ok"
  | "conflict"
  | "shifted"
  | "skip"
  | "unresolved";
export type ScheduledMeetingPlanOverrideAction = "keep" | "shift" | "skip";
export type ScheduledMeetingPlanOptionKind =
  | "shift_ours"
  | "reschedule_blockers"
  | "keep_conflict"
  | "skip";
export type ScheduledMeetingPlanDifficulty = "easy" | "medium" | "hard";

export interface ScheduledMeetingPlanPreviewRequest {
  conflict_policy?: ScheduledMeetingConflictPolicy;
}

export interface ScheduledMeetingPlanConflict {
  attendee_email: string;
  event_start?: string | null;
  event_end?: string | null;
  event_subject?: string | null;
  busy_type?: string | null;
  movability?: "high" | "medium" | "low" | null;
  source?: "freebusy" | "interval" | "calendar" | "company_calendar" | null;
  reschedule_hint_start?: string | null;
  reschedule_hint_end?: string | null;
}

export interface ScheduledMeetingPlanOption {
  kind: ScheduledMeetingPlanOptionKind;
  available: boolean;
  cost?: number | null;
  difficulty?: ScheduledMeetingPlanDifficulty | null;
  recommended: boolean;
  suggested_start?: string | null;
  suggested_end?: string | null;
  blockers?: ScheduledMeetingPlanConflict[];
  reason?: string | null;
}

export interface ScheduledMeetingPlanOccurrencePreview {
  occurrence_date: string;
  planned_start: string;
  planned_end: string;
  status: ScheduledMeetingPlanOccurrenceStatus;
  busy_attendees: string[];
  conflicts: ScheduledMeetingPlanConflict[];
  suggested_start?: string | null;
  suggested_end?: string | null;
  options: ScheduledMeetingPlanOption[];
  recommended_option?: ScheduledMeetingPlanOptionKind | null;
}

export interface ScheduledMeetingPlanPreviewRead {
  meeting_id: string;
  conflict_policy: ScheduledMeetingConflictPolicy;
  occurrences: ScheduledMeetingPlanOccurrencePreview[];
  summary: Record<string, number>;
}

export interface ScheduledMeetingPlanOverride {
  occurrence_date: string;
  action: ScheduledMeetingPlanOverrideAction;
  new_start?: string | null;
}

export interface ScheduledMeetingPlanRequest {
  conflict_policy?: ScheduledMeetingConflictPolicy;
  overrides?: ScheduledMeetingPlanOverride[];
}

export interface ScheduledMeetingRead {
  id: string;
  title: string;
  meeting_category_id: string;
  meeting_category_name?: string | null;
  manager_user_id?: string | null;
  manager_user_fio?: string | null;
  manager_position_id: string;
  manager_position_name?: string | null;
  responsible_user_id?: string | null;
  responsible_user_fio?: string | null;
  responsible_position_id: string;
  responsible_position_name?: string | null;
  meeting_type: MeetingScheduleType;
  status: ScheduledMeetingStatus;
  time_local: string;
  duration_minutes: number;
  frequency: MeetingScheduleRecurrenceFrequency;
  interval: number;
  monthly_mode: MeetingScheduleMonthlyMode | null;
  day_of_month: number | null;
  weekday: string | null;
  weekday_position: string | null;
  series_start_date: string;
  series_end_date: string;
  recurrence_label: string;
  occurrence_count?: number | null;
  recurrence_rule: Record<string, unknown>;
  outlook_series_id: string | null;
  outlook_changekey: string | null;
  outlook_meeting_url: string | null;
  payload: { comment?: string } | null;
  participants: ScheduledMeetingParticipantRead[];
}

export interface ScheduledMeetingDetailRead {
  series: ScheduledMeetingRead;
  next_occurrence: ScheduledMeetingOccurrence | null;
  upcoming_occurrences: ScheduledMeetingOccurrence[];
  past_occurrences: ScheduledMeetingOccurrence[];
  current_card?: unknown | null;
  history?: unknown[];
}

export interface ScheduledMeetingUpdate {
  title?: string;
  meeting_category_id?: string;
  manager_user_id?: string;
  responsible_user_id?: string;
  manager_position_id?: string;
  responsible_position_id?: string;
  meeting_type?: MeetingScheduleType;
  recurrence?: ScheduledMeetingRecurrenceCreate;
  series_start_date?: string;
  series_end_date?: string;
  participants?: ScheduledMeetingParticipantCreate[];
  comment?: string | null;
}

export interface ScheduledMeetingAppliedChanges {
  db_updated: boolean;
  outlook_updated: boolean;
  changes: string[];
  outlook_actions: string[];
  participants_added: string[];
  participants_removed: string[];
}

export interface ScheduledMeetingUpdateRead {
  series: ScheduledMeetingRead;
  applied_changes: ScheduledMeetingAppliedChanges;
}

export type MeetingTopicDecision = "use_existing" | "create_new";

export interface MeetingTopicSimilarityBreakdown {
  topic?: number | null;
  participants?: number | null;
  details?: number | null;
}

export interface MeetingTopicParticipant {
  participant_ref_key?: string | null;
  fio?: string | null;
}

export interface MeetingTopicSummary {
  ref_key?: string | null;
  code?: string | null;
  description: string;
  details?: string | null;
  meeting_type?: string | null;
  manager?: string | null;
  reviewer?: string | null;
  department?: string | null;
  room?: string | null;
  project?: string | null;
  committee?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  closed_date?: string | null;
  is_active?: boolean;
  similarity_score?: number | null;
  similarity_method?: string | null;
  similarity_breakdown?: MeetingTopicSimilarityBreakdown | null;
  participants?: MeetingTopicParticipant[];
}

export interface MeetingTopicCheckSimilarRequest {
  description: string;
  manager_fio: string;
  meeting_type?: string;
  topic_details?: string | null;
  initiator_fio?: string | null;
  participant_fios?: string[];
}

export interface MeetingTopicCheckSimilarRead {
  similar_found: boolean;
  requires_user_decision: boolean;
  similar_topic?: MeetingTopicSummary | null;
  similarity_score?: number | null;
  similarity_method?: string | null;
  similarity_breakdown?: MeetingTopicSimilarityBreakdown | null;
  missing_participants?: MeetingTopicParticipant[];
  unresolved_participants?: MeetingTopicParticipant[];
  required_fields: string[];
  message: string;
}

export interface MeetingTopicResolveRequest {
  decision: MeetingTopicDecision;
  existing_topic_ref_key?: string | null;
  description?: string | null;
  manager_fio?: string | null;
  meeting_type?: string | null;
  reviewer_fio?: string | null;
  closed_date?: string | null;
  closed_end_of_year?: boolean;
  department_key?: string | null;
  room_key?: string | null;
  project_key?: string | null;
  committee_key?: string | null;
  organization_key?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  is_management_circle_topic?: boolean | null;
  topic_details?: string | null;
  initiator_fio?: string | null;
  participant_fios?: string[];
  dry_run?: boolean;
}

export interface MeetingTopicResolveRead {
  decision: MeetingTopicDecision;
  used_existing: boolean;
  created: boolean;
  dry_run?: boolean;
  topic: MeetingTopicSummary;
  participants_count: number;
  added_participants?: MeetingTopicParticipant[];
  message: string;
}

export interface MeetingTopicValidationRead {
  valid: boolean;
  topic?: MeetingTopicSummary | null;
  reason?: string | null;
}

