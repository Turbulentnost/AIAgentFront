import type {
  ScheduledMeetingPlanOccurrencePreview,
  ScheduledMeetingPlanOption,
  ScheduledMeetingPlanOptionKind,
  ScheduledMeetingPlanOverride,
  ScheduledMeetingPlanPreviewRead
} from "@/types/meetings";

export type PlanChoiceByDate = Record<string, ScheduledMeetingPlanOptionKind>;

export type PlanPreviewGroupId =
  | "ok"
  | "shift_ours"
  | "reschedule_blockers"
  | "keep_conflict"
  | "skip"
  | "unresolved";

export type PlanPreviewGroup = {
  id: PlanPreviewGroupId;
  title: string;
  description: string;
  occurrences: ScheduledMeetingPlanOccurrencePreview[];
};

const GROUP_META: Record<
  PlanPreviewGroupId,
  { title: string; description: string; order: number }
> = {
  ok: {
    title: "Без конфликтов",
    description: "Оставляем слот по правилу серии",
    order: 0
  },
  shift_ours: {
    title: "Сдвинуть нашу встречу",
    description: "На той же неделе найден свободный слот",
    order: 1
  },
  reschedule_blockers: {
    title: "Оставить наш слот",
    description: "Проще перенести конфликтующие встречи (вручную по подсказке)",
    order: 2
  },
  keep_conflict: {
    title: "Оставить с конфликтом",
    description: "Распланировать на исходный слот, несмотря на занятость",
    order: 3
  },
  skip: {
    title: "Пропустить дату",
    description: "Эту встречу серии не ставим",
    order: 4
  },
  unresolved: {
    title: "Нужен выбор",
    description: "Автоматическая рекомендация недоступна",
    order: 5
  }
};

export function formatPlanDifficulty(difficulty?: string | null): string {
  if (!difficulty) return "—";
  if (difficulty === "easy") return "Легко";
  if (difficulty === "medium") return "Средне";
  if (difficulty === "hard") return "Сложно";
  return difficulty;
}

export function formatPlanOptionKind(kind: ScheduledMeetingPlanOptionKind): string {
  switch (kind) {
    case "shift_ours":
      return "Сдвинуть нашу";
    case "reschedule_blockers":
      return "Оставить наш слот";
    case "keep_conflict":
      return "Оставить с конфликтом";
    case "skip":
      return "Пропустить";
    default:
      return kind;
  }
}

export function getOccurrenceOption(
  occurrence: ScheduledMeetingPlanOccurrencePreview,
  kind: ScheduledMeetingPlanOptionKind
): ScheduledMeetingPlanOption | undefined {
  return occurrence.options.find((option) => option.kind === kind);
}

export function resolveDefaultChoice(
  occurrence: ScheduledMeetingPlanOccurrencePreview
): ScheduledMeetingPlanOptionKind {
  if (occurrence.status === "ok") return "keep_conflict";
  if (
    occurrence.recommended_option &&
    getOccurrenceOption(occurrence, occurrence.recommended_option)?.available
  ) {
    return occurrence.recommended_option;
  }
  const recommended = occurrence.options.find((option) => option.recommended && option.available);
  if (recommended) return recommended.kind;
  const available = occurrence.options.find((option) => option.available);
  return available?.kind ?? "keep_conflict";
}

export function buildDefaultChoices(
  preview: ScheduledMeetingPlanPreviewRead
): PlanChoiceByDate {
  const choices: PlanChoiceByDate = {};
  for (const occurrence of preview.occurrences) {
    if (occurrence.status === "ok") continue;
    choices[occurrence.occurrence_date] = resolveDefaultChoice(occurrence);
  }
  return choices;
}

export function groupPlanPreviewOccurrences(
  preview: ScheduledMeetingPlanPreviewRead,
  choices: PlanChoiceByDate
): PlanPreviewGroup[] {
  const buckets: Record<PlanPreviewGroupId, ScheduledMeetingPlanOccurrencePreview[]> = {
    ok: [],
    shift_ours: [],
    reschedule_blockers: [],
    keep_conflict: [],
    skip: [],
    unresolved: []
  };

  for (const occurrence of preview.occurrences) {
    if (occurrence.status === "ok") {
      buckets.ok.push(occurrence);
      continue;
    }
    const choice = choices[occurrence.occurrence_date] ?? resolveDefaultChoice(occurrence);
    if (choice === "shift_ours") buckets.shift_ours.push(occurrence);
    else if (choice === "reschedule_blockers") buckets.reschedule_blockers.push(occurrence);
    else if (choice === "skip") buckets.skip.push(occurrence);
    else if (choice === "keep_conflict") buckets.keep_conflict.push(occurrence);
    else buckets.unresolved.push(occurrence);
  }

  return (Object.keys(GROUP_META) as PlanPreviewGroupId[])
    .sort((a, b) => GROUP_META[a].order - GROUP_META[b].order)
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({
      id,
      title: GROUP_META[id].title,
      description: GROUP_META[id].description,
      occurrences: buckets[id]
    }));
}

export function buildPlanOverridesFromChoices(
  preview: ScheduledMeetingPlanPreviewRead,
  choices: PlanChoiceByDate
): ScheduledMeetingPlanOverride[] {
  const overrides: ScheduledMeetingPlanOverride[] = [];

  for (const occurrence of preview.occurrences) {
    if (occurrence.status === "ok") continue;
    const choice = choices[occurrence.occurrence_date] ?? resolveDefaultChoice(occurrence);
    const option = getOccurrenceOption(occurrence, choice);

    if (choice === "shift_ours") {
      const newStart = option?.suggested_start || occurrence.suggested_start;
      if (!newStart) continue;
      overrides.push({
        occurrence_date: occurrence.occurrence_date,
        action: "shift",
        new_start: newStart
      });
      continue;
    }

    if (choice === "skip") {
      overrides.push({
        occurrence_date: occurrence.occurrence_date,
        action: "skip"
      });
      continue;
    }

    // reschedule_blockers / keep_conflict → keep our original slot
    overrides.push({
      occurrence_date: occurrence.occurrence_date,
      action: "keep"
    });
  }

  return overrides;
}

export function summarizeChoices(
  preview: ScheduledMeetingPlanPreviewRead,
  choices: PlanChoiceByDate
): {
  total: number;
  ok: number;
  shift: number;
  rescheduleBlockers: number;
  keep: number;
  skip: number;
} {
  let ok = 0;
  let shift = 0;
  let rescheduleBlockers = 0;
  let keep = 0;
  let skip = 0;

  for (const occurrence of preview.occurrences) {
    if (occurrence.status === "ok") {
      ok += 1;
      continue;
    }
    const choice = choices[occurrence.occurrence_date] ?? resolveDefaultChoice(occurrence);
    if (choice === "shift_ours") shift += 1;
    else if (choice === "reschedule_blockers") rescheduleBlockers += 1;
    else if (choice === "skip") skip += 1;
    else keep += 1;
  }

  return {
    total: preview.occurrences.length,
    ok,
    shift,
    rescheduleBlockers,
    keep,
    skip
  };
}

export function availableChoicesForOccurrence(
  occurrence: ScheduledMeetingPlanOccurrencePreview
): ScheduledMeetingPlanOption[] {
  return occurrence.options.filter((option) => option.available);
}
