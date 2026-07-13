import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Search, Undo2, X } from "lucide-react";
import { usersApi } from "@/api/endpoints";
import { getMeetingRequestError } from "@/hooks/useMeetingDashboard";
import { useMeetingRegistryParticipants } from "@/hooks/useMeetingRegistry";
import type { User } from "@/types";
import styles from "./MeetingAgent.module.css";

function getUserFullName(user: User): string {
  const fullName = user.full_name?.trim();
  if (fullName) return fullName;

  const composed = [user.last_name, user.first_name, user.middle_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return composed || user.email;
}

function normalizeParticipantName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function participantListsEqual(left: string[], right: string[]): boolean {
  const leftKeys = new Set(left.map((name) => name.toLowerCase()));
  const rightKeys = new Set(right.map((name) => name.toLowerCase()));
  if (leftKeys.size !== rightKeys.size) return false;
  for (const key of leftKeys) {
    if (!rightKeys.has(key)) return false;
  }
  return true;
}

type ParticipantsApplyPayload = {
  participants: string[];
  added: string[];
  removed: string[];
};

type Props = {
  open: boolean;
  refKey: string | null;
  meetingLabel: string;
  applying: boolean;
  applyError: string | null;
  onClose: () => void;
  onApply: (payload: ParticipantsApplyPayload) => void;
};

export default function MeetingAgentRegistryParticipantsModal({
  open,
  refKey,
  meetingLabel,
  applying,
  applyError,
  onClose,
  onApply
}: Props) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);

  const participantsQuery = useMeetingRegistryParticipants(refKey, open);

  const loading = participantsQuery.isLoading || participantsQuery.isFetching;
  const error = participantsQuery.isError ? getMeetingRequestError(participantsQuery.error) : null;
  const initialParticipants = participantsQuery.data?.participants ?? [];

  const usersQuery = useQuery({
    queryKey: ["users", "participants-search"],
    queryFn: () => usersApi.list(),
    enabled: open,
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setDraft(initialParticipants.map(normalizeParticipantName).filter(Boolean));
    setUndoStack([]);
  }, [open, initialParticipants]);

  const lastRemovedParticipant = undoStack[undoStack.length - 1] ?? null;

  const normalizedInitial = useMemo(
    () =>
      [...new Set(initialParticipants.map(normalizeParticipantName).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ru")
      ),
    [initialParticipants]
  );

  const normalizedDraft = useMemo(
    () => [...new Set(draft.map(normalizeParticipantName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    [draft]
  );

  const hasChanges = useMemo(
    () => !participantListsEqual(normalizedDraft, normalizedInitial),
    [normalizedDraft, normalizedInitial]
  );

  const searchQuery = search.trim().toLowerCase();

  const visibleParticipants = useMemo(() => {
    if (!searchQuery) return draft;
    return draft.filter((name) => name.toLowerCase().includes(searchQuery));
  }, [draft, searchQuery]);

  const suggestions = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const selected = new Set(draft.map((name) => name.toLowerCase()));
    const users = usersQuery.data ?? [];

    return users
      .map((user) => getUserFullName(user))
      .filter((name) => {
        const normalized = name.toLowerCase();
        return normalized.includes(searchQuery) && !selected.has(normalized);
      })
      .slice(0, 8);
  }, [draft, searchQuery, usersQuery.data]);

  if (!open) return null;

  function handleRemove(name: string) {
    setDraft((current) => current.filter((item) => item !== name));
    setUndoStack((stack) => [...stack, name]);
  }

  function handleUndoRemove() {
    setUndoStack((stack) => {
      const next = [...stack];
      const restored = next.pop();
      if (!restored) return stack;

      setDraft((current) => {
        const exists = current.some((item) => item.toLowerCase() === restored.toLowerCase());
        return exists ? current : [...current, restored];
      });

      return next;
    });
  }

  function handleAdd(name: string) {
    const normalized = normalizeParticipantName(name);
    if (!normalized) return;
    setDraft((current) => {
      const exists = current.some((item) => item.toLowerCase() === normalized.toLowerCase());
      return exists ? current : [...current, normalized];
    });
    setUndoStack((stack) => stack.filter((item) => item.toLowerCase() !== normalized.toLowerCase()));
    setSearch("");
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const trimmed = search.trim();
    if (!trimmed) return;
    if (suggestions.length === 1) {
      handleAdd(suggestions[0]);
      return;
    }
    const exists = draft.some((name) => name.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      handleAdd(trimmed);
    }
  }

  function handleApply() {
    if (!hasChanges || applying || loading || !normalizedDraft.length) return;
    const added = normalizedDraft.filter(
      (name) => !normalizedInitial.some((item) => item.toLowerCase() === name.toLowerCase())
    );
    const removed = normalizedInitial.filter(
      (name) => !normalizedDraft.some((item) => item.toLowerCase() === name.toLowerCase())
    );
    onApply({ participants: normalizedDraft, added, removed });
  }

  const isBusy = loading || applying;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.modalCard} ${styles.participantsModalCard}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-registry-participants-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="meeting-registry-participants-title">Список участников</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            disabled={isBusy}
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className={styles.modalHint}>{meetingLabel}</p>

        <div className={styles.participantsSearchField}>
          <Search className={styles.participantsSearchIcon} size={16} aria-hidden="true" />
          <input
            type="search"
            className={styles.participantsSearchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Поиск участника"
            disabled={isBusy}
            autoComplete="off"
            aria-label="Поиск участника"
          />
        </div>

        {suggestions.length ? (
          <ul className={styles.participantsSuggestions} role="listbox" aria-label="Найденные участники">
            {suggestions.map((name) => (
              <li key={name}>
                <button type="button" className={styles.participantsSuggestionItem} onClick={() => handleAdd(name)}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {lastRemovedParticipant && !loading && !error ? (
          <div className={styles.participantsUndoRow}>
            <button
              type="button"
              className={styles.participantsUndoButton}
              onClick={handleUndoRemove}
              disabled={isBusy}
              aria-label={`Вернуть ${lastRemovedParticipant}`}
            >
              <Undo2 size={15} aria-hidden="true" />
              <span>Вернуть {lastRemovedParticipant}</span>
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className={styles.modalLoader}>
            <Loader2 size={18} className={styles.spinner} aria-hidden="true" />
            <span>Загружаем участников…</span>
          </div>
        ) : error ? (
          <div className={styles.modalError} role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : (
          <div className={styles.participantsChipPanel}>
            {visibleParticipants.length ? (
              <ul className={styles.participantsChipList}>
                {visibleParticipants.map((name) => (
                  <li key={name}>
                    <span className={styles.participantChip}>
                      <span className={styles.participantChipLabel}>{name}</span>
                      <button
                        type="button"
                        className={styles.participantChipRemove}
                        onClick={() => handleRemove(name)}
                        disabled={isBusy}
                        aria-label={`Удалить ${name}`}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.participantsEmpty}>
                {searchQuery ? "Нет участников по запросу" : "Участники не указаны"}
              </p>
            )}
          </div>
        )}

        {applyError ? (
          <div className={styles.modalError} role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{applyError}</span>
          </div>
        ) : null}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isBusy || !hasChanges || !normalizedDraft.length}
            onClick={handleApply}
          >
            {applying ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Сохраняем…
              </>
            ) : (
              "Применить"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
