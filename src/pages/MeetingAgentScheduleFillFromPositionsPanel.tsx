import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, X } from "lucide-react";

import { meetingsApi } from "@/api/endpoints";
import type {
  ScheduledMeetingEmployeeOption,
  ScheduledMeetingParticipantOption,
  ScheduledMeetingPositionResolveItem
} from "@/types/meetings";

import styles from "./MeetingAgent.module.css";

export type ScheduleEmployeeFromForm = {
  id: string;
  name: string;
  email: string;
  positionName?: string | null;
  positionId?: string | null;
  kind: "employee";
};

type PositionChip = {
  id: string;
  name: string;
};

type Props = {
  onApply: (payload: {
    manager: ScheduleEmployeeFromForm | null;
    responsible: ScheduleEmployeeFromForm | null;
    participants: ScheduleEmployeeFromForm[];
  }) => void;
};

function employeeFromOption(
  option: ScheduledMeetingEmployeeOption,
  positionId: string,
  positionName: string
): ScheduleEmployeeFromForm {
  return {
    id: option.id,
    name: option.fio,
    email: option.email,
    positionName: option.position_name ?? positionName,
    positionId,
    kind: "employee"
  };
}

function filterPositionSuggestions(
  query: string,
  selectedIds: string[],
  options: PositionChip[]
): PositionChip[] {
  const normalized = query.trim().toLowerCase().replace("ё", "е");
  if (!normalized) return [];

  return options
    .filter((item) => !selectedIds.includes(item.id))
    .filter((item) => item.name.toLowerCase().replace("ё", "е").includes(normalized))
    .slice(0, 8);
}

function PositionPicker({
  label,
  value,
  onChange,
  excludeIds = []
}: {
  label: string;
  value: PositionChip | null;
  onChange: (value: PositionChip | null) => void;
  excludeIds?: string[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedSearch = searchQuery.trim();

  const positionsQuery = useQuery({
    queryKey: ["meetings", "schedule", "participant-options", label, trimmedSearch],
    queryFn: () => meetingsApi.listScheduleParticipantOptions(trimmedSearch || undefined),
    staleTime: 60_000
  });

  const options = useMemo(
    () =>
      (positionsQuery.data ?? [])
        .map((item: ScheduledMeetingParticipantOption) => ({
          id: item.id,
          name: item.name.trim()
        }))
        .filter((item) => !excludeIds.includes(item.id)),
    [positionsQuery.data, excludeIds]
  );

  const suggestions = useMemo(
    () => filterPositionSuggestions(searchQuery, value ? [value.id] : [], options),
    [searchQuery, value, options]
  );

  return (
    <div className={styles.scheduleFillRoleField}>
      <span className={styles.scheduleFillRoleLabel}>{label}</span>
      {value ? (
        <span className={styles.scheduleParticipantChip}>
          <span className={styles.scheduleParticipantChipLabel}>{value.name}</span>
          <button
            type="button"
            className={styles.scheduleParticipantChipRemove}
            aria-label={`Убрать должность ${value.name}`}
            onClick={() => onChange(null)}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ) : (
        <>
          <div className={styles.scheduleParticipantSearchField}>
            <Search className={styles.scheduleParticipantSearchIcon} size={16} aria-hidden="true" />
            <input
              className={`${styles.scheduleControl} ${styles.scheduleParticipantSearchInput}`}
              value={searchQuery}
              placeholder="Поиск должности"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Enter" && suggestions[0]) {
                  event.preventDefault();
                  onChange(suggestions[0]!);
                  setSearchQuery("");
                }
              }}
            />
          </div>
          {trimmedSearch && suggestions.length ? (
            <ul className={styles.scheduleParticipantSuggestions}>
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.scheduleParticipantSuggestionButton}
                    onClick={() => {
                      onChange(item);
                      setSearchQuery("");
                    }}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : trimmedSearch && !positionsQuery.isLoading ? (
            <p className={styles.scheduleParticipantEmptyHint}>Должность не найдена</p>
          ) : null}
        </>
      )}
    </div>
  );
}

type PositionRolesContext = {
  managerPositionId: string | null;
  responsiblePositionId: string | null;
  participantPositionIds: Set<string>;
};

function buildPositionRolesContext(
  managerPosition: PositionChip | null,
  responsiblePosition: PositionChip | null,
  participantPositions: PositionChip[]
): PositionRolesContext {
  return {
    managerPositionId: managerPosition?.id ?? null,
    responsiblePositionId: responsiblePosition?.id ?? null,
    participantPositionIds: new Set(participantPositions.map((item) => item.id))
  };
}

function collectPositionIds(context: PositionRolesContext): string[] {
  const ids = [
    context.managerPositionId,
    context.responsiblePositionId,
    ...context.participantPositionIds
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export default function MeetingAgentScheduleFillFromPositionsPanel({ onApply }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [managerPosition, setManagerPosition] = useState<PositionChip | null>(null);
  const [responsiblePosition, setResponsiblePosition] = useState<PositionChip | null>(null);
  const [participantPositions, setParticipantPositions] = useState<PositionChip[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveItems, setResolveItems] = useState<ScheduledMeetingPositionResolveItem[]>([]);
  const [ambiguousChoices, setAmbiguousChoices] = useState<Record<string, string>>({});

  const participantSearchQuery = useQuery({
    queryKey: ["meetings", "schedule", "fill-participant-positions", participantSearch.trim()],
    queryFn: () => meetingsApi.listScheduleParticipantOptions(participantSearch.trim() || undefined),
    enabled: expanded && participantSearch.trim().length > 0,
    staleTime: 60_000
  });

  const selectedParticipantPositionIds = useMemo(
    () => new Set(participantPositions.map((item) => item.id)),
    [participantPositions]
  );

  const participantSuggestions = useMemo(() => {
    const excluded = [
      ...(managerPosition ? [managerPosition.id] : []),
      ...(responsiblePosition ? [responsiblePosition.id] : []),
      ...participantPositions.map((item) => item.id)
    ];
    return filterPositionSuggestions(
      participantSearch,
      excluded,
      (participantSearchQuery.data ?? []).map((item) => ({
        id: item.id,
        name: item.name.trim()
      }))
    );
  }, [
    participantSearch,
    participantSearchQuery.data,
    managerPosition,
    responsiblePosition,
    participantPositions
  ]);

  const ambiguousItems = useMemo(
    () => resolveItems.filter((item) => item.status === "ambiguous"),
    [resolveItems]
  );

  const canResolve =
    managerPosition !== null ||
    responsiblePosition !== null ||
    participantPositions.length > 0;

  const canConfirmAmbiguous = ambiguousItems.every(
    (item) => ambiguousChoices[item.position_id]?.length
  );

  function resetResolveState() {
    setResolveItems([]);
    setAmbiguousChoices({});
    setResolveError(null);
  }

  function handleAddParticipantPosition(position: PositionChip) {
    if (selectedParticipantPositionIds.has(position.id)) return;
    setParticipantPositions((current) => [...current, position]);
    setParticipantSearch("");
    resetResolveState();
  }

  function handleRemoveParticipantPosition(positionId: string) {
    setParticipantPositions((current) => current.filter((item) => item.id !== positionId));
    resetResolveState();
  }

  async function handleResolve() {
    if (!canResolve) return;

    setResolving(true);
    setResolveError(null);

    const rolesContext = buildPositionRolesContext(
      managerPosition,
      responsiblePosition,
      participantPositions
    );

    try {
      const response = await meetingsApi.resolveSchedulePositions(
        collectPositionIds(rolesContext)
      );
      setResolveItems(response.items);

      const emptyItems = response.items.filter((item) => item.status === "empty");
      const notFoundItems = response.items.filter((item) => item.status === "not_found");
      const ambiguous = response.items.filter((item) => item.status === "ambiguous");
      const resolvedItems = response.items.filter((item) => item.status === "resolved");

      if (emptyItems.length || notFoundItems.length) {
        const labels = [...emptyItems, ...notFoundItems].map((item) => item.position_name);
        setResolveError(
          `Не найден сотрудник для должностей: ${labels.join(", ")}. Выберите людей вручную или уточните должность.`
        );
      }

      if (ambiguous.length) {
        setAmbiguousChoices((current) => {
          const next = { ...current };
          for (const item of ambiguous) {
            if (!next[item.position_id] && item.candidates[0]) {
              next[item.position_id] = item.candidates[0]!.id;
            }
          }
          return next;
        });
        return;
      }

      if (!resolvedItems.length) {
        return;
      }

      applyResolved(response.items, rolesContext, {}, {
        closePanel: !(emptyItems.length || notFoundItems.length),
        clearError: !(emptyItems.length || notFoundItems.length)
      });
    } catch {
      setResolveError("Не удалось подставить сотрудников по должностям");
    } finally {
      setResolving(false);
    }
  }

  function applyResolved(
    items: ScheduledMeetingPositionResolveItem[],
    rolesContext: PositionRolesContext,
    choices: Record<string, string>,
    options?: { closePanel?: boolean; clearError?: boolean }
  ) {
    let manager: ScheduleEmployeeFromForm | null = null;
    let responsible: ScheduleEmployeeFromForm | null = null;
    const participants: ScheduleEmployeeFromForm[] = [];
    const seenUserIds = new Set<string>();

    for (const item of items) {
      let employeeOption: ScheduledMeetingEmployeeOption | null = item.employee;
      if (item.status === "ambiguous") {
        const chosenId = choices[item.position_id];
        employeeOption = item.candidates.find((candidate) => candidate.id === chosenId) ?? null;
      }
      if (!employeeOption) continue;

      const mapped = employeeFromOption(employeeOption, item.position_id, item.position_name);
      if (rolesContext.managerPositionId === item.position_id) {
        manager = mapped;
        seenUserIds.add(mapped.id);
      }
      if (rolesContext.responsiblePositionId === item.position_id) {
        responsible = mapped;
        seenUserIds.add(mapped.id);
      }
      if (
        rolesContext.participantPositionIds.has(item.position_id) &&
        !seenUserIds.has(mapped.id)
      ) {
        participants.push(mapped);
        seenUserIds.add(mapped.id);
      }
    }

    onApply({ manager, responsible, participants });
    setResolveItems([]);
    setAmbiguousChoices({});
    if (options?.clearError !== false) {
      setResolveError(null);
    }
    if (options?.closePanel !== false) {
      setExpanded(false);
    }
  }

  function handleConfirmAmbiguous() {
    if (!canConfirmAmbiguous) return;

    const rolesContext = buildPositionRolesContext(
      managerPosition,
      responsiblePosition,
      participantPositions
    );

    applyResolved(resolveItems, rolesContext, ambiguousChoices);
  }

  return (
    <div className={styles.scheduleFillFromPositions}>
      <button
        type="button"
        className={styles.scheduleFillToggle}
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span>Заполнить по должностям</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={expanded ? styles.scheduleFillToggleIconOpen : styles.scheduleFillToggleIcon}
        />
      </button>

      {expanded ? (
        <div className={styles.scheduleFillBody}>
          <p className={styles.scheduleFillHint}>
            Укажите должности из нормативного документа — система подставит текущих сотрудников.
            Если на должности несколько людей, попросим выбрать конкретного.
          </p>

          <PositionPicker
            label="Руководитель (должность)"
            value={managerPosition}
            onChange={(value) => {
              setManagerPosition(value);
              resetResolveState();
            }}
            excludeIds={participantPositions.map((item) => item.id)}
          />

          <PositionPicker
            label="Ответственный (должность)"
            value={responsiblePosition}
            onChange={(value) => {
              setResponsiblePosition(value);
              resetResolveState();
            }}
            excludeIds={participantPositions.map((item) => item.id)}
          />

          <div className={styles.scheduleFillRoleField}>
            <span className={styles.scheduleFillRoleLabel}>Участники (должности)</span>
            <div className={styles.scheduleParticipantSearchField}>
              <Search className={styles.scheduleParticipantSearchIcon} size={16} aria-hidden="true" />
              <input
                className={`${styles.scheduleControl} ${styles.scheduleParticipantSearchInput}`}
                value={participantSearch}
                placeholder="Поиск должности участника"
                onChange={(event) => setParticipantSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && participantSuggestions[0]) {
                    event.preventDefault();
                    handleAddParticipantPosition(participantSuggestions[0]!);
                  }
                }}
              />
            </div>
            {participantSearch.trim() && participantSuggestions.length ? (
              <ul className={styles.scheduleParticipantSuggestions}>
                {participantSuggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.scheduleParticipantSuggestionButton}
                      onClick={() => handleAddParticipantPosition(item)}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {participantPositions.length ? (
              <div className={styles.scheduleParticipantChipList}>
                {participantPositions.map((position) => (
                  <span className={styles.scheduleParticipantChip} key={position.id}>
                    <span className={styles.scheduleParticipantChipLabel}>{position.name}</span>
                    <button
                      type="button"
                      className={styles.scheduleParticipantChipRemove}
                      aria-label={`Убрать ${position.name}`}
                      onClick={() => handleRemoveParticipantPosition(position.id)}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {ambiguousItems.length ? (
            <div className={styles.scheduleFillAmbiguous}>
              <p className={styles.scheduleFillAmbiguousTitle}>Выберите сотрудника для должности</p>
              {ambiguousItems.map((item) => (
                <label key={item.position_id} className={styles.scheduleFillAmbiguousRow}>
                  <span>{item.position_name}</span>
                  <select
                    className={styles.scheduleControl}
                    value={ambiguousChoices[item.position_id] ?? ""}
                    onChange={(event) =>
                      setAmbiguousChoices((current) => ({
                        ...current,
                        [item.position_id]: event.target.value
                      }))
                    }
                  >
                    {item.candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.fio} · {candidate.email}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!canConfirmAmbiguous}
                onClick={handleConfirmAmbiguous}
              >
                Подтвердить выбор
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={!canResolve || resolving}
              onClick={() => void handleResolve()}
            >
              {resolving ? "Подставляем…" : "Подставить сотрудников"}
            </button>
          )}

          {resolveError ? <p className={styles.scheduleDrawerError}>{resolveError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
