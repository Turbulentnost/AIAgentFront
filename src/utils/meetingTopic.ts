import type {
  MeetingDashboardItem,
  MeetingMemoDetail,
  MeetingScheduleSeriesSavePayload,
  MeetingScheduleType,
  MeetingTopicCheckSimilarRequest,
  MeetingTopicResolveRead
} from "@/types/meetings";
import { meetingsApi } from "@/api/endpoints";

const MEETING_TOPIC_RESOLUTION_STORAGE_PREFIX = "meeting-topic-resolved:v2:";

function meetingTopicResolutionStorageKey(memoRefKey: string): string {
  return `${MEETING_TOPIC_RESOLUTION_STORAGE_PREFIX}${memoRefKey}`;
}

function isLegacyMeetingTopicResolutionKey(key: string): boolean {
  return key.startsWith("meeting-topic-resolved:") && !key.startsWith(MEETING_TOPIC_RESOLUTION_STORAGE_PREFIX);
}

export function resetMeetingTopicResolutionCache(): void {
  if (typeof sessionStorage === "undefined") return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key && isLegacyMeetingTopicResolutionKey(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}

export function clearMeetingTopicResolution(memoRefKey: string | null | undefined): void {
  if (!memoRefKey || typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(meetingTopicResolutionStorageKey(memoRefKey));
  sessionStorage.removeItem(`meeting-topic-resolved:${memoRefKey}`);
}

export function loadMeetingTopicResolution(memoRefKey: string | null | undefined): MeetingTopicResolveRead | null {
  if (!memoRefKey || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(meetingTopicResolutionStorageKey(memoRefKey));
    if (!raw) return null;
    return JSON.parse(raw) as MeetingTopicResolveRead;
  } catch {
    return null;
  }
}

export function saveMeetingTopicResolution(
  memoRefKey: string,
  result: MeetingTopicResolveRead
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(meetingTopicResolutionStorageKey(memoRefKey), JSON.stringify(result));
}

export function hasMeetingTopicResolution(memoRefKey: string | null | undefined): boolean {
  return loadMeetingTopicResolution(memoRefKey) != null;
}

export async function validateStoredMeetingTopicResolution(
  memoRefKey: string | null | undefined
): Promise<MeetingTopicResolveRead | null> {
  const stored = loadMeetingTopicResolution(memoRefKey);
  const topicRefKey = stored?.topic?.ref_key?.trim();
  if (!stored || !topicRefKey) {
    if (memoRefKey) clearMeetingTopicResolution(memoRefKey);
    return null;
  }

  try {
    const validation = await meetingsApi.validateTopicRef(topicRefKey);
    if (!validation.valid) {
      clearMeetingTopicResolution(memoRefKey);
      return null;
    }
    return stored;
  } catch {
    return stored;
  }
}

export type MeetingTopicPendingAction = "approve" | "slot" | "series";

export const MEETING_TOPIC_TYPES = [
  "Отчетное",
  "Внеплановое",
  "Плановое",
  "Селекторное"
] as const;

export type MeetingTopicType = (typeof MEETING_TOPIC_TYPES)[number];

export function normalizeMeetingTopicType(value: string | null | undefined): MeetingTopicType {
  const normalized = (value ?? "").trim();
  if (MEETING_TOPIC_TYPES.includes(normalized as MeetingTopicType)) {
    return normalized as MeetingTopicType;
  }
  return "Отчетное";
}

const SCHEDULE_TYPE_TO_TOPIC: Record<MeetingScheduleType, MeetingTopicType> = {
  planned: "Плановое",
  report: "Отчетное",
  selector: "Селекторное",
  unplanned: "Внеплановое"
};

const TOPIC_TYPE_TO_SCHEDULE: Record<MeetingTopicType, MeetingScheduleType> = {
  Плановое: "planned",
  Отчетное: "report",
  Селекторное: "selector",
  Внеплановое: "unplanned"
};

export function mapScheduleTypeToMeetingTopicType(type: MeetingScheduleType): MeetingTopicType {
  return SCHEDULE_TYPE_TO_TOPIC[type] ?? "Отчетное";
}

export function mapMeetingTopicTypeToScheduleType(value: string | null | undefined): MeetingScheduleType {
  const normalized = normalizeMeetingTopicType(value);
  return TOPIC_TYPE_TO_SCHEDULE[normalized] ?? "report";
}

export type ScheduleTopicFormSnapshot = {
  title: string;
  managerFio: string;
  responsibleFio?: string | null;
  participantFios: string[];
  meetingType: MeetingScheduleType;
  comment?: string | null;
};

export function buildScheduleMeetingTopicCheckPayload(
  input: ScheduleTopicFormSnapshot
): MeetingTopicCheckSimilarRequest | null {
  const managerFio = input.managerFio.trim();
  const description = input.title.trim();
  if (!managerFio || !description) {
    return null;
  }

  const participantNames = [
    ...new Set(
      [
        managerFio,
        input.responsibleFio?.trim(),
        ...input.participantFios.map((name) => name.trim()).filter(Boolean)
      ].filter((name): name is string => Boolean(name))
    )
  ];

  return {
    description,
    manager_fio: managerFio,
    meeting_type: mapScheduleTypeToMeetingTopicType(input.meetingType),
    topic_details: input.comment?.trim() || null,
    initiator_fio: input.responsibleFio?.trim() || null,
    participant_fios: participantNames
  };
}

export function scheduleTopicSnapshotFromPayload(
  payload: MeetingScheduleSeriesSavePayload
): ScheduleTopicFormSnapshot {
  return {
    title: payload.title,
    managerFio: payload.manager_person_fio?.trim() ?? "",
    responsibleFio: payload.responsible_person_fio?.trim() || null,
    participantFios: payload.participants
      .map((participant) => participant.person_fio?.trim())
      .filter((name): name is string => Boolean(name)),
    meetingType: payload.meeting_type,
    comment: payload.comment ?? null
  };
}

export function applyResolvedTopicToSchedulePayload(
  payload: MeetingScheduleSeriesSavePayload,
  resolvedTopic: MeetingTopicResolveRead
): MeetingScheduleSeriesSavePayload {
  const topicPayload = buildMeetingTopicRequestPayload(resolvedTopic);
  const topic = resolvedTopic.topic;
  const seriesPayload: Record<string, unknown> = {
    source: "manual_schedule"
  };
  if (topicPayload) {
    seriesPayload.meeting_topic = topicPayload;
  }
  if (topic?.ref_key) {
    seriesPayload.meeting_topic_ref_key = topic.ref_key;
  }

  const next: MeetingScheduleSeriesSavePayload = {
    ...payload,
    payload: seriesPayload
  };

  if (topic && (resolvedTopic.used_existing || resolvedTopic.created)) {
    const topicTitle = topic.description?.trim();
    if (topicTitle) {
      next.title = topicTitle;
    }
    if (resolvedTopic.used_existing && topic.meeting_type?.trim()) {
      next.meeting_type = mapMeetingTopicTypeToScheduleType(topic.meeting_type);
    }
  }

  return next;
}

export function buildMeetingTopicCheckPayload(
  detail: MeetingMemoDetail,
  queueItem?: MeetingDashboardItem | null
): MeetingTopicCheckSimilarRequest | null {
  const managerFio = detail.application.manager?.full_name?.trim();
  const description = (detail.title || detail.application.agenda || "").trim();
  if (!managerFio || !description) {
    return null;
  }

  const participantNames = [
    ...new Set(
      [
        detail.application.initiator?.full_name?.trim(),
        managerFio,
        ...(detail.application.participants ?? []).map((participant) =>
          participant.full_name?.trim()
        )
      ].filter((name): name is string => Boolean(name))
    )
  ];

  if (!participantNames.length && queueItem?.participant_names?.length) {
    participantNames.push(
      ...queueItem.participant_names.map((name) => name.trim()).filter(Boolean)
    );
  }

  return {
    description,
    manager_fio: managerFio,
    meeting_type: normalizeMeetingTopicType(detail.application.meeting_type),
    topic_details: detail.application.agenda?.trim() || null,
    initiator_fio: detail.application.initiator?.full_name?.trim() || null,
    participant_fios: [...new Set(participantNames)]
  };
}

export function formatMeetingTopicSimilarityScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "—";
  return `${Math.round(score * 100)}%`;
}

export function formatMeetingTopicSimilarityBreakdown(
  breakdown: { topic?: number | null; participants?: number | null; details?: number | null } | null | undefined
): string {
  if (!breakdown) return "";
  const parts: string[] = [];
  if (breakdown.topic != null) parts.push(`название ${formatMeetingTopicSimilarityScore(breakdown.topic)}`);
  if (breakdown.participants != null) {
    parts.push(`участники ${formatMeetingTopicSimilarityScore(breakdown.participants)}`);
  }
  if (breakdown.details != null) parts.push(`описание ${formatMeetingTopicSimilarityScore(breakdown.details)}`);
  return parts.join(" · ");
}

export function resolveMeetingSubjectFromTopic(
  detail: MeetingMemoDetail,
  resolvedTopic: MeetingTopicResolveRead | null | undefined
): string | undefined {
  const topicName = resolvedTopic?.topic?.description?.trim();
  if (topicName && resolvedTopic && (resolvedTopic.used_existing || resolvedTopic.created)) {
    return topicName;
  }
  return detail.title?.trim() || detail.application.agenda?.trim() || undefined;
}

export function resolveMeetingTypeFromTopic(
  detail: MeetingMemoDetail,
  resolvedTopic: MeetingTopicResolveRead | null | undefined
): string | undefined {
  const topicType = resolvedTopic?.topic?.meeting_type?.trim();
  if (topicType && resolvedTopic?.used_existing) {
    return topicType;
  }
  return detail.application.meeting_type?.trim() || undefined;
}

export function formatResolvedMeetingTopicLabel(
  resolvedTopic: MeetingTopicResolveRead | null | undefined
): string | null {
  if (!resolvedTopic?.topic) return null;
  const { code, description, meeting_type: meetingType } = resolvedTopic.topic;
  const parts = [
    code ? `№${code}` : null,
    description?.trim() || null,
    meetingType?.trim() || null
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function buildMeetingTopicRequestPayload(
  resolvedTopic: MeetingTopicResolveRead | null | undefined
): Record<string, unknown> | undefined {
  const topic = resolvedTopic?.topic;
  if (!topic?.ref_key || !resolvedTopic) return undefined;
  return {
    ref_key: topic.ref_key,
    code: topic.code,
    description: topic.description,
    meeting_type: topic.meeting_type,
    used_existing: resolvedTopic.used_existing,
    created: resolvedTopic.created
  };
}

export function formatProtocolDraftAtLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
