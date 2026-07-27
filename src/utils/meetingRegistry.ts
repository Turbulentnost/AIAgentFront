import type {
  MeetingRegistryCancelResponse,
  MeetingRegistryContext,
  MeetingRegistryItem,
  MeetingRegistryParticipantsApplyResponse,
  MeetingRegistryParticipantsAddConfirmResponse,
  MeetingRegistryParticipantsRemovalConfirmResponse,
  MeetingRegistryProtocolCreateResponse,
  MeetingRegistryReschedulableStage,
  MeetingRegistryRescheduleApproveResponse,
  MeetingRegistryStage,
  MeetingRegistryStageFilter
} from "@/types/meetings";
import { formatMeetingDateTime, formatMeetingTime } from "@/utils/meetingDashboard";

export type MeetingRegistryStepStage = MeetingRegistryStage | "approved";

export interface MeetingRegistryViewItem {
  id: string;
  refKey: string;
  memoNumber: string | null;
  memoTopic: string | null;
  meetingTopic: string;
  displayTitle: string;
  /** @deprecated use meetingTopic or displayTitle */
  title: string;
  meetingAtLabel: string;
  slotStart: string | null;
  slotEnd: string | null;
  location: string | null;
  initiator: string;
  manager: string;
  participantsCount: number;
  stage: MeetingRegistryStage;
  invitationsSentAt: string;
  protocolNumber: string | null;
  protocolDraftAt: string | null;
  protocolDraftCreatedAt: string | null;
  protocolDraftError: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  canCancel: boolean;
  actionsLocked: boolean;
}

export const meetingRegistryCancelledStage = {
  id: "cancelled" as const,
  label: "Отменено",
  shortLabel: "Отменено"
};

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

export function isMeetingRegistryActionsLocked(stage: MeetingRegistryStage): boolean {
  return (
    stage === "meeting_completed" ||
    stage === "protocol_conducted" ||
    stage === "cancelled"
  );
}

export function meetingRegistryCanCancel(stage: MeetingRegistryStage): boolean {
  return !isMeetingRegistryActionsLocked(stage);
}

export function normalizeRegistryMemoNumber(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return null;
  return trimmed;
}

export function buildMeetingRegistryDisplayTitle(input: {
  memoNumber: string | null;
  memoTopic: string | null;
  meetingTopic: string;
}): string {
  if (input.memoNumber) {
    const memoTopic = input.memoTopic?.trim();
    return memoTopic ? `СЗ №${input.memoNumber} · ${memoTopic}` : `СЗ №${input.memoNumber}`;
  }
  return input.meetingTopic;
}

export function mapMeetingRegistryItem(item: MeetingRegistryItem): MeetingRegistryViewItem {
  const meetingAtLabel =
    item.slot_start && item.slot_end
      ? formatMeetingTime(item.slot_start, item.slot_end)
      : "—";

  const memoNumber = normalizeRegistryMemoNumber(item.memo_number);
  const meetingTopic = item.subject?.trim() || item.title?.trim() || "Заявка на совещание";
  const memoTopic = memoNumber ? item.title?.trim() || item.subject?.trim() || null : null;
  const displayTitle = buildMeetingRegistryDisplayTitle({
    memoNumber,
    memoTopic,
    meetingTopic
  });

  return {
    id: item.ref_key,
    refKey: item.ref_key,
    memoNumber,
    memoTopic,
    meetingTopic,
    displayTitle,
    title: meetingTopic,
    meetingAtLabel,
    slotStart: item.slot_start,
    slotEnd: item.slot_end,
    location: item.location,
    initiator: item.initiator_name ?? "—",
    manager: item.manager_name ?? "—",
    participantsCount: item.participants_count,
    stage: item.stage,
    invitationsSentAt: item.invitations_sent_at,
    protocolNumber: item.protocol_number,
    protocolDraftAt: item.protocol_draft_at,
    protocolDraftCreatedAt: item.protocol_draft_created_at,
    protocolDraftError: item.protocol_draft_error,
    cancelledAt: item.cancelled_at,
    updatedAt: item.updated_at,
    canCancel:
      item.can_cancel ??
      meetingRegistryCanCancel(item.stage),
    actionsLocked:
      item.actions_locked ?? isMeetingRegistryActionsLocked(item.stage)
  };
}

export function formatProtocolDraftStatus(item: MeetingRegistryViewItem): string | null {
  if (item.protocolDraftCreatedAt) {
    const numberLabel = item.protocolNumber ? ` №${item.protocolNumber}` : "";
    return `Черновик протокола создан${numberLabel}`;
  }
  if (item.protocolDraftError) {
    return `Ошибка создания протокола: ${item.protocolDraftError}`;
  }
  if (item.protocolDraftAt) {
    const label = formatMeetingDateTime(item.protocolDraftAt);
    return label ? `Черновик протокола будет создан ${label}` : null;
  }
  return null;
}

export function getMeetingRegistryStageLabel(stage: MeetingRegistryStage): string {
  if (stage === "cancelled") {
    return meetingRegistryCancelledStage.label;
  }
  return (
    meetingRegistryStages.find((entry) => entry.id === stage)?.label ??
    stage
  );
}

export function getMeetingRegistryStageIndex(stage: MeetingRegistryStage): number {
  if (stage === "cancelled") {
    return 1;
  }
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
    meeting_completed: 0,
    cancelled: 0
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

export function isMeetingRegistryReschedulable(
  stage: MeetingRegistryStage
): stage is MeetingRegistryReschedulableStage {
  return stage === "invitations_sent" || stage === "cancelled";
}

export function patchRegistryContextAfterProtocolCreate(
  data: MeetingRegistryContext,
  refKey: string,
  result: MeetingRegistryProtocolCreateResponse,
  stageFilter: MeetingRegistryStageFilter = "all"
): MeetingRegistryContext {
  const target = data.items.find((item) => item.ref_key === refKey);
  if (!target || !result.created) return data;

  const updatedAt = result.protocol_draft_created_at ?? new Date().toISOString();
  const updatedItem: MeetingRegistryItem = {
    ...target,
    stage: result.stage ?? "protocol_created",
    protocol_number: result.protocol_number ?? target.protocol_number,
    protocol_draft_created_at: result.protocol_draft_created_at ?? updatedAt,
    protocol_draft_error: null,
    updated_at: updatedAt
  };

  let nextItems = data.items.map((item) => (item.ref_key === refKey ? updatedItem : item));

  if (
    stageFilter !== "all" &&
    stageFilter !== "approved" &&
    stageFilter !== "protocol_created" &&
    stageFilter !== updatedItem.stage
  ) {
    nextItems = nextItems.filter((item) => item.ref_key !== refKey);
  }

  const nextCounts = { ...data.stage_counts };
  if (target.stage !== updatedItem.stage) {
    if (typeof nextCounts[target.stage] === "number") {
      nextCounts[target.stage] = Math.max(0, nextCounts[target.stage] - 1);
    }
    nextCounts[updatedItem.stage] = (nextCounts[updatedItem.stage] ?? 0) + 1;
  }

  return {
    ...data,
    items: nextItems,
    stage_counts: nextCounts
  };
}

export function patchRegistryContextAfterCancel(
  data: MeetingRegistryContext,
  refKey: string,
  result: MeetingRegistryCancelResponse,
  stageFilter: MeetingRegistryStageFilter = "all"
): MeetingRegistryContext {
  const target = data.items.find((item) => item.ref_key === refKey);
  if (!target) return data;

  const wasAlreadyCancelled = target.stage === "cancelled";
  const cancelledAt = result.cancelled_at ?? target.cancelled_at ?? new Date().toISOString();
  const updatedItem: MeetingRegistryItem = {
    ...target,
    stage: "cancelled",
    cancelled_at: cancelledAt,
    updated_at: cancelledAt
  };

  let nextItems = data.items.map((item) => (item.ref_key === refKey ? updatedItem : item));

  if (
    stageFilter !== "all" &&
    stageFilter !== "approved" &&
    stageFilter !== "cancelled"
  ) {
    nextItems = nextItems.filter((item) => item.ref_key !== refKey);
  }

  const nextCounts = { ...data.stage_counts };
  if (!wasAlreadyCancelled) {
    const previousStage = target.stage;
    if (previousStage && typeof nextCounts[previousStage] === "number") {
      nextCounts[previousStage] = Math.max(0, nextCounts[previousStage] - 1);
    }
    nextCounts.cancelled = (nextCounts.cancelled ?? 0) + 1;
  }

  return {
    ...data,
    items: nextItems,
    stage_counts: nextCounts
  };
}

export function patchRegistryContextAfterReschedule(
  data: MeetingRegistryContext,
  refKey: string,
  result: MeetingRegistryRescheduleApproveResponse,
  stageFilter: MeetingRegistryStageFilter = "all"
): MeetingRegistryContext {
  const target = data.items.find((item) => item.ref_key === refKey);
  if (!target) return data;

  const wasCancelled = target.stage === "cancelled";
  const updatedAt = new Date().toISOString();
  const updatedItem: MeetingRegistryItem = {
    ...target,
    stage: "invitations_sent",
    slot_start: result.start,
    slot_end: result.end,
    location: result.location ?? target.location,
    subject: result.subject ?? target.subject,
    cancelled_at: null,
    updated_at: updatedAt
  };

  let nextItems = data.items.map((item) => (item.ref_key === refKey ? updatedItem : item));

  if (stageFilter !== "all" && stageFilter !== "approved") {
    if (wasCancelled && stageFilter === "cancelled") {
      nextItems = nextItems.filter((item) => item.ref_key !== refKey);
    } else if (!wasCancelled && stageFilter !== "invitations_sent") {
      nextItems = nextItems.filter((item) => item.ref_key !== refKey);
    }
  }

  const nextCounts = { ...data.stage_counts };
  if (wasCancelled) {
    nextCounts.cancelled = Math.max(0, (nextCounts.cancelled ?? 0) - 1);
    nextCounts.invitations_sent = (nextCounts.invitations_sent ?? 0) + 1;
  }

  return {
    ...data,
    items: nextItems,
    stage_counts: nextCounts
  };
}

export function patchRegistryContextAfterParticipantsApply(
  data: MeetingRegistryContext,
  refKey: string,
  result: MeetingRegistryParticipantsApplyResponse
): MeetingRegistryContext {
  const items = Array.isArray(data.items) ? data.items : [];
  const target = items.find((item) => item.ref_key === refKey);
  if (!target) return data;

  const updatedAt = result.fetched_at ?? new Date().toISOString();
  const updatedItem: MeetingRegistryItem = {
    ...target,
    participants_count: result.participants_count,
    updated_at: updatedAt
  };

  return {
    ...data,
    items: items.map((item) => (item.ref_key === refKey ? updatedItem : item))
  };
}

export function patchRegistryContextAfterParticipantsAddConfirm(
  data: MeetingRegistryContext,
  refKey: string,
  result: MeetingRegistryParticipantsAddConfirmResponse
): MeetingRegistryContext {
  const items = Array.isArray(data.items) ? data.items : [];
  const target = items.find((item) => item.ref_key === refKey);
  if (!target) return data;

  const updatedAt = result.fetched_at ?? new Date().toISOString();
  const updatedItem: MeetingRegistryItem = {
    ...target,
    participants_count: result.participants_count,
    ...(result.slot_start ? { slot_start: result.slot_start } : {}),
    ...(result.slot_end ? { slot_end: result.slot_end } : {}),
    updated_at: updatedAt
  };

  return {
    ...data,
    items: items.map((item) => (item.ref_key === refKey ? updatedItem : item))
  };
}

export function patchRegistryContextAfterParticipantsRemovalConfirm(
  data: MeetingRegistryContext,
  refKey: string,
  result: MeetingRegistryParticipantsRemovalConfirmResponse
): MeetingRegistryContext {
  const items = Array.isArray(data.items) ? data.items : [];
  const target = items.find((item) => item.ref_key === refKey);
  if (!target) return data;

  const updatedAt = result.fetched_at ?? new Date().toISOString();
  const updatedItem: MeetingRegistryItem = {
    ...target,
    participants_count: result.participants_count,
    slot_start: result.slot_start,
    slot_end: result.slot_end,
    updated_at: updatedAt
  };

  return {
    ...data,
    items: items.map((item) => (item.ref_key === refKey ? updatedItem : item))
  };
}
