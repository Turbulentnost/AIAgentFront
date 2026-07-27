export type AppNotificationType = "turbo_project_rg" | string;

export type ScheduledMeetingWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  entity_key: string;
  payload?: Record<string, unknown> | null;
  read_at?: string | null;
  opened_at?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
}

export interface AppNotificationList {
  items: AppNotification[];
  unread_count: number;
}

export interface TurboProjectRgParticipantProposal {
  user_id: string;
  fio: string;
  email: string;
  role?: string | null;
  position_name?: string | null;
}

export interface TurboProjectRgWeeklySlotProposal {
  weekday: ScheduledMeetingWeekday;
  time_local: string;
  duration_minutes: number;
  slot_start?: string | null;
  coverage_ratio?: number | null;
  fallback: boolean;
}

export interface TurboProjectRgSeriesProposal {
  file_id: number;
  project_name: string;
  one_c_ref_key?: string | null;
  nomer_proekta?: string | null;
  status_proekta?: string | null;
  title: string;
  meeting_category_name: string;
  series_start_date: string;
  series_end_date: string;
  recurrence_label: string;
  weekly_slot: TurboProjectRgWeeklySlotProposal;
  manager: TurboProjectRgParticipantProposal;
  responsible: TurboProjectRgParticipantProposal;
  participants: TurboProjectRgParticipantProposal[];
}

export interface AppNotificationOpen {
  notification: AppNotification;
  proposal?: TurboProjectRgSeriesProposal | null;
}

export interface AppNotificationAcceptRequest {
  weekday?: ScheduledMeetingWeekday | null;
  time_local?: string | null;
  duration_minutes?: number | null;
}

export interface AppNotificationAccept {
  notification: AppNotification;
  scheduled_meeting: {
    id: string;
    title: string;
    status: string;
  };
}
