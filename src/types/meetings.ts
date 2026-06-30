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
}

export interface MeetingLoginContext {
  date: string;
  unapproved: MeetingDashboardItem[];
  today: MeetingDashboardItem[];
  counts: {
    unapproved?: number;
    today?: number;
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
  meeting_type: string | null;
  meeting_type_label: string | null;
  priority: string | null;
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

export interface MeetingAttendee {
  fio: string;
  email: string | null;
  role: string;
  role_label: string;
  found: boolean;
}

export interface MeetingAgentSlotPreview {
  memo_ref_key: string;
  slot: MeetingSlot | null;
  slot_label: string | null;
  duration_minutes: number | null;
  attendees: MeetingAttendee[];
  missing_emails: string[];
  error: string | null;
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
}
