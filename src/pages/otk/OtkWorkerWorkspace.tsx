import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Database } from "lucide-react";
import { OtkPresentationCardView } from "./OtkPresentationCard";
import { OtkShipmentLines } from "./OtkShipmentLines";
import type { OtkPresentationCard, OtkShipmentLine } from "./mockData";
import {
  useOtkAddLine,
  useOtkDeleteLine,
  useOtkPresentation,
  useOtkPresentationsList,
  useOtkUpdateLine,
  useOtkUpdatePresentation,
  useOtkWriteTo1C,
  writeOtkDetailCache
} from "@/hooks/useOtkWorker";
import { mergePresentationCard } from "./otkCardMerge";
import type { OtkPresentationCardUi, OtkShipmentLineUi } from "./otkMappers";
import {
  filterAndSortPresentations,
  isEffectivelyCompleted,
  presentationCheckMark,
  urgencyColor,
  type OtkListFilter,
  type OtkListSort
} from "./otkPresentationUi";
import styles from "./OtkWorker.module.css";

const STATUS_LABELS: Record<OtkPresentationCard["status"], string> = {
  queued: "В очереди",
  in_progress: "В работе",
  done: "Завершено"
};

const FILTER_OPTIONS: { value: OtkListFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "needs_check", label: "На проверку" },
  { value: "overdue", label: "Просроченные" },
  { value: "queued", label: "В очереди" }
];

const SORT_OPTIONS: { value: OtkListSort; label: string }[] = [
  { value: "in_work", label: "По в работе" },
  { value: "urgency", label: "По срочности" }
];

const CHECK_CARD_CLASS: Record<ReturnType<typeof presentationCheckMark>, string> = {
  needs_check: styles.cardCheckNeed,
  passed: styles.cardCheckPassed,
  done_muted: styles.cardCheckDone
};

const CHECK_CHIP_CLASS: Record<ReturnType<typeof presentationCheckMark>, string> = {
  needs_check: styles.statusChipNeed,
  passed: styles.statusChipPassed,
  done_muted: styles.statusChipDone
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function lineSignature(line: OtkShipmentLine) {
  return JSON.stringify({
    id: line.id,
    code: line.code,
    nomenclature: line.nomenclature,
    storageUnit: line.storageUnit,
    qtyUpd: line.qtyUpd,
    qtyFact: line.qtyFact,
    category: line.category,
    supplierQualityRating: line.supplierQualityRating ?? null,
    accepted: Boolean(line.accepted)
  });
}

export default function OtkWorkerWorkspace() {
  const queryClient = useQueryClient();
  const listQuery = useOtkPresentationsList();
  const [selectedId, setSelectedId] = useState<string>("");
  const [listFilter, setListFilter] = useState<OtkListFilter>("all");
  const [listSort, setListSort] = useState<OtkListSort>("in_work");
  const [stubMessage, setStubMessage] = useState<string | null>(null);
  const [localCard, setLocalCard] = useState<OtkPresentationCardUi | null>(null);
  const headerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Line ids with an in-flight PATCH (timer already fired). */
  const inflightLineIds = useRef<Set<string>>(new Set());
  /** Per-line epoch: stale responses for that line must not unlock/overwrite it. */
  const lineEpochs = useRef<Map<string, number>>(new Map());
  const syncingRef = useRef(false);
  const headerPending = useRef(false);

  const items = listQuery.data?.items ?? [];
  const workers = listQuery.data?.workers ?? [];
  const visibleItems = filterAndSortPresentations(items, listFilter, listSort);

  const firstVisibleId = visibleItems[0]?.id ?? "";
  useEffect(() => {
    if (!selectedId && firstVisibleId) {
      setSelectedId(firstVisibleId);
    }
  }, [firstVisibleId, selectedId]);

  const detailQuery = useOtkPresentation(selectedId || null);
  const updatePresentation = useOtkUpdatePresentation();
  const addLineMut = useOtkAddLine();
  const updateLineMut = useOtkUpdateLine();
  const deleteLineMut = useOtkDeleteLine();
  const writeTo1C = useOtkWriteTo1C();

  const lockedLineIds = (): Set<string> => {
    const locked = new Set<string>();
    for (const id of lineTimers.current.keys()) locked.add(id);
    for (const id of inflightLineIds.current) locked.add(id);
    return locked;
  };

  const applyServerCard = (server: OtkPresentationCardUi) => {
    setLocalCard((prev) =>
      mergePresentationCard(prev, server, lockedLineIds(), headerPending.current)
    );
  };

  // Bind localCard to detail only on first load / presentation switch.
  // Continuous query→local sync was the remaining revert path (stale PATCH
  // setQueryData or a focus-refetch finishing after an optimistic category change).
  useEffect(() => {
    if (!detailQuery.data) return;
    setLocalCard((prev) => {
      if (prev && prev.id === detailQuery.data.id) return prev;
      return detailQuery.data;
    });
  }, [detailQuery.data]);

  const selected = localCard;
  const pendingCount = listQuery.data?.pendingCount ?? 0;
  const earliestDueAt = listQuery.data?.earliestDueAt ?? null;

  const scheduleHeaderPatch = (patch: Partial<OtkPresentationCardUi>) => {
    if (!selectedId) return;
    setLocalCard((prev) => (prev ? { ...prev, ...patch } : prev));
    headerPending.current = true;
    if (headerTimer.current) clearTimeout(headerTimer.current);
    headerTimer.current = setTimeout(() => {
      updatePresentation.mutate(
        { presentationId: selectedId, patch },
        {
          onSuccess: () => {
            // Header fields are already optimistic in localCard; do not apply the
            // response lines snapshot (it may predate a newer category PATCH).
            headerPending.current = false;
          },
          onError: () => {
            headerPending.current = false;
          }
        }
      );
    }, 400);
  };

  const scheduleLinePatch = (lineId: string, patch: Partial<OtkShipmentLineUi>) => {
    if (!selectedId) return;
    const timers = lineTimers.current;
    const prev = timers.get(lineId);
    if (prev) clearTimeout(prev);
    const epoch = (lineEpochs.current.get(lineId) ?? 0) + 1;
    lineEpochs.current.set(lineId, epoch);
    timers.set(
      lineId,
      setTimeout(() => {
        timers.delete(lineId);
        inflightLineIds.current.add(lineId);
        updateLineMut.mutate(
          { presentationId: selectedId, lineId, patch },
          {
            onSuccess: (card) => {
              // Stale response for this line — ignore (newer edit owns epoch/lock).
              if (lineEpochs.current.get(lineId) !== epoch) return;
              inflightLineIds.current.delete(lineId);
              writeOtkDetailCache(queryClient, card, lineId);
              applyServerCard(card);
            },
            onSettled: () => {
              // If a newer edit superseded this request, the newer one owns the lock.
              if (lineEpochs.current.get(lineId) === epoch) {
                inflightLineIds.current.delete(lineId);
              }
            }
          }
        );
      }, 400)
    );
  };

  const handleLinesChange = (nextLines: OtkShipmentLine[]) => {
    if (!selectedId || !selected) return;
    const prev = selected.lines;
    const prevById = new Map(prev.map((line) => [line.id, line]));
    const nextById = new Map(nextLines.map((line) => [line.id, line]));

    // Instant local update → category sample recomputes in the table immediately.
    setLocalCard({ ...selected, lines: nextLines as OtkShipmentLineUi[] });

    const added = nextLines.filter((line) => !prevById.has(line.id));
    const removed = prev.filter((line) => !nextById.has(line.id));

    for (const line of removed) {
      const t = lineTimers.current.get(line.id);
      if (t) clearTimeout(t);
      lineTimers.current.delete(line.id);
      inflightLineIds.current.delete(line.id);
      syncingRef.current = true;
      deleteLineMut.mutate(
        { presentationId: selectedId, lineId: line.id },
        {
          onSuccess: (card) => applyServerCard(card),
          onSettled: () => {
            syncingRef.current = false;
          }
        }
      );
    }

    for (const line of added) {
      syncingRef.current = true;
      addLineMut.mutate(
        { presentationId: selectedId, line },
        {
          onSuccess: (card) => applyServerCard(card),
          onSettled: () => {
            syncingRef.current = false;
          }
        }
      );
    }

    for (const line of nextLines) {
      const old = prevById.get(line.id);
      if (!old) continue;
      if (lineSignature(old) === lineSignature(line)) continue;
      const { id, sampleRule: _s, ...patch } = line as OtkShipmentLineUi;
      void _s;
      scheduleLinePatch(id, patch);
    }
  };

  const handleWriteToOneC = () => {
    if (!selectedId) return;
    writeTo1C.mutate(selectedId, {
      onSuccess: (result) => setStubMessage(result.message),
      onError: () =>
        setStubMessage("Не удалось вызвать заглушку записи в 1С. Проверьте доступ и API.")
    });
  };

  const resetLocalSyncState = () => {
    for (const t of lineTimers.current.values()) clearTimeout(t);
    lineTimers.current.clear();
    inflightLineIds.current.clear();
    lineEpochs.current.clear();
    headerPending.current = false;
    if (headerTimer.current) clearTimeout(headerTimer.current);
    syncingRef.current = false;
  };

  const listError = listQuery.isError
    ? "Не удалось загрузить список предъявлений."
    : null;
  const detailError = detailQuery.isError ? "Не удалось загрузить карточку." : null;
  const listBusy = listQuery.isLoading;
  const detailBusy = Boolean(selectedId) && detailQuery.isLoading && !selected;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2>Работник ОТК</h2>
        <div className={styles.summaryStats} aria-label="Сводка по проверкам">
          <div className={styles.summaryStat}>
            <span>Количество требуемых проверок</span>
            <strong>{listBusy ? "…" : pendingCount}</strong>
          </div>
          <div className={styles.summaryStat}>
            <span>Самый ранний срок исполнения</span>
            <strong>
              {listBusy ? "…" : earliestDueAt ? formatDateTime(earliestDueAt) : "—"}
            </strong>
          </div>
        </div>
      </header>

      {listError ? (
        <div className={styles.toast} role="alert">
          <AlertTriangle size={16} />
          <span>{listError}</span>
        </div>
      ) : null}

      <div className={styles.workspace}>
        <section className={styles.listPanel} aria-label="Список предъявлений">
          <div className={styles.panelTitle}>
            <h3>Предъявления</h3>
            <span className={styles.badge}>{visibleItems.length}</span>
          </div>
          <div className={styles.listControls}>
            <div className={styles.listControl}>
              <label htmlFor="otk-list-filter">Фильтр</label>
              <select
                id="otk-list-filter"
                className={styles.listControlSelect}
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value as OtkListFilter)}
              >
                {FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.listControl}>
              <label htmlFor="otk-list-sort">Сортировка</label>
              <select
                id="otk-list-sort"
                className={styles.listControlSelect}
                value={listSort}
                onChange={(e) => setListSort(e.target.value as OtkListSort)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.cardList}>
            {listBusy ? (
              <div className={styles.emptyState}>Загрузка…</div>
            ) : items.length === 0 ? (
              <div className={styles.emptyState}>Нет предъявлений.</div>
            ) : visibleItems.length === 0 ? (
              <div className={styles.emptyState}>Нет предъявлений по фильтру.</div>
            ) : (
              visibleItems.map((card) => {
                const active = card.id === selectedId;
                const check = presentationCheckMark(card);
                const dueMuted = isEffectivelyCompleted(card);
                const dueStyle = {
                  color: urgencyColor(card.due_at, { muted: dueMuted })
                };
                const itemClass = [
                  active ? styles.cardItemActive : styles.cardItem,
                  CHECK_CARD_CLASS[check]
                ].join(" ");
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={itemClass}
                    onClick={() => {
                      resetLocalSyncState();
                      setSelectedId(card.id);
                      setStubMessage(null);
                      setLocalCard(null);
                    }}
                  >
                    <strong>
                      {card.invoice_number} · {card.purchase_order}
                    </strong>
                    <span>
                      {card.supplier} · {card.lines_count} поз.
                    </span>
                    <div className={styles.cardMetaRow}>
                      <span className={styles.cardDue} style={dueStyle}>
                        Срок: {formatDateTime(card.due_at)}
                      </span>
                      <span className={`${styles.statusChip} ${CHECK_CHIP_CLASS[check]}`}>
                        {STATUS_LABELS[card.status]}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className={styles.detailPanel} aria-label="Карточка предъявления">
          {!selectedId ? (
            <div className={styles.emptyState}>Выберите предъявление слева.</div>
          ) : detailBusy ? (
            <div className={styles.emptyState}>Загрузка карточки…</div>
          ) : detailError ? (
            <div className={styles.emptyState}>{detailError}</div>
          ) : !selected ? (
            <div className={styles.emptyState}>Выберите предъявление слева.</div>
          ) : (
            <>
              <div className={styles.panelTitle}>
                <h3>Карточка · {selected.invoiceNumber}</h3>
                <span
                  className={`${styles.statusChip} ${CHECK_CHIP_CLASS[presentationCheckMark(selected)]}`}
                >
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>

              <OtkPresentationCardView
                card={selected}
                workers={workers}
                onChange={scheduleHeaderPatch}
              />

              <h4 className={styles.sectionTitle}>Элементы в поставке</h4>
              <OtkShipmentLines lines={selected.lines} onChange={handleLinesChange} />

              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleWriteToOneC}
                  disabled={writeTo1C.isPending}
                >
                  <Database size={16} />
                  Записать проверку в 1С
                </button>
              </div>

              {stubMessage ? (
                <div className={styles.toast} role="status">
                  <AlertTriangle size={16} />
                  <span>{stubMessage}</span>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
