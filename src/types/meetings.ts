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

export interface MeetingApplication {
  initiator: MeetingPerson | null;
  manager: MeetingPerson | null;
  participants: MeetingParticipantDetail[];
  participants_count: number;
  agenda: string | null;
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
}

export interface MeetingSlotBlockingEvent {
  event_label: string;
  event_subject?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  event_time_label?: string | null;
  organizer?: string | null;
  movability?: string | null;
  movability_reason?: string | null;
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
  reschedule_recommendations?: MeetingSlotRescheduleRecommendation[];
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

export interface MeetingRegistryParticipantsResponse {
  ref_key: string;
  participants: string[];
  participants_count: number;
  fetched_at: string;
}
