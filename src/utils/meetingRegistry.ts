import type {
  MeetingRegistryItem,
  MeetingRegistryStage,
  MeetingRegistryStageFilter
} from "@/types/meetings";
import { formatMeetingTime } from "@/utils/meetingDashboard";

export type MeetingRegistryStepStage = MeetingRegistryStage | "approved";

export interface MeetingRegistryViewItem {
  id: string;
  refKey: string;
  memoNumber: string;
  title: string;
  meetingAtLabel: string;
  location: string | null;
  initiator: string;
  manager: string;
  participantsCount: number;
  stage: MeetingRegistryStage;
  invitationsSentAt: string;
  protocolNumber: string | null;
  updatedAt: string;
}

export const meetingRegistryStages: {
  id: MeetingRegistryStepStage;
  label: string;
  shortLabel: string;
}[] = [
  { id: "approved", label: "Согласовано", shortLabel: "Согласовано" },
  { id: "invitations_sent", label: "Приглашения отправлены", shortLabel: "Приглашения" },
  { id: "protocol_created", label: "Протокол создан", shortLabel: "Протокол создан" },
  { id: "protocol_conducted", label: "Протокол проведён", shortLabel: "Проведён" },
  { id: "meeting_completed", label: "Совещание завершено", shortLabel: "Завершено" }
];

export function mapMeetingRegistryItem(item: MeetingRegistryItem): MeetingRegistryViewItem {
  const meetingAtLabel =
    item.slot_start && item.slot_end
      ? formatMeetingTime(item.slot_start, item.slot_end)
      : "—";

  return {
    id: item.ref_key,
    refKey: item.ref_key,
    memoNumber: item.memo_number ?? "—",
    title: item.title ?? item.subject ?? "Заявка на совещание",
    meetingAtLabel,
    location: item.location,
    initiator: item.initiator_name ?? "—",
    manager: item.manager_name ?? "—",
    participantsCount: item.participants_count,
    stage: item.stage,
    invitationsSentAt: item.invitations_sent_at,
    protocolNumber: item.protocol_number,
    updatedAt: item.updated_at
  };
}

export function getMeetingRegistryStageLabel(stage: MeetingRegistryStage): string {
  return (
    meetingRegistryStages.find((entry) => entry.id === stage)?.label ??
    stage
  );
}

export function getMeetingRegistryStageIndex(stage: MeetingRegistryStage): number {
  const executionIndex = meetingRegistryStages.findIndex((entry) => entry.id === stage);
  return executionIndex >= 0 ? executionIndex : 1;
}

export function registryStageQueryParam(
  filter: MeetingRegistryStageFilter
): string | undefined {
  if (filter === "all" || filter === "approved") {
    return undefined;
  }
  return filter;
}

export function defaultRegistryStageCounts(): Record<string, number> {
  return {
    all: 0,
    approved: 0,
    invitations_sent: 0,
    protocol_created: 0,
    protocol_conducted: 0,
    meeting_completed: 0
  };
}

export function filterMeetingRegistryItems(
  items: MeetingRegistryViewItem[],
  filter: MeetingRegistryStageFilter
): MeetingRegistryViewItem[] {
  if (filter === "all" || filter === "approved") {
    return items;
  }
  return items.filter((item) => item.stage === filter);
}
