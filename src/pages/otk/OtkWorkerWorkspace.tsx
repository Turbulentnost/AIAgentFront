import { useEffect, useRef, useState } from "react";
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
  useOtkWriteTo1C
} from "@/hooks/useOtkWorker";
import type { OtkPresentationCardUi, OtkShipmentLineUi } from "./otkMappers";
import styles from "./OtkWorker.module.css";

const STATUS_LABELS: Record<OtkPresentationCard["status"], string> = {
  queued: "В очереди",
  in_progress: "В работе",
  done: "Завершено"
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
    supplierQualityRating: line.supplierQualityRating ?? null
  });
}

export default function OtkWorkerWorkspace() {
  const listQuery = useOtkPresentationsList();
  const [selectedId, setSelectedId] = useState<string>("");
  const [stubMessage, setStubMessage] = useState<string | null>(null);
  const [localCard, setLocalCard] = useState<OtkPresentationCardUi | null>(null);
  const headerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const syncingRef = useRef(false);

  const items = listQuery.data?.items ?? [];
  const workers = listQuery.data?.workers ?? [];

  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const detailQuery = useOtkPresentation(selectedId || null);
  const updatePresentation = useOtkUpdatePresentation();
  const addLineMut = useOtkAddLine();
  const updateLineMut = useOtkUpdateLine();
  const deleteLineMut = useOtkDeleteLine();
  const writeTo1C = useOtkWriteTo1C();

  useEffect(() => {
    if (detailQuery.data && !syncingRef.current) {
      setLocalCard(detailQuery.data);
    }
  }, [detailQuery.data]);

  const selected = localCard;
  const pendingCount = listQuery.data?.pendingCount ?? 0;
  const earliestDueAt = listQuery.data?.earliestDueAt ?? null;

  const scheduleHeaderPatch = (patch: Partial<OtkPresentationCardUi>) => {
    if (!selectedId) return;
    setLocalCard((prev) => (prev ? { ...prev, ...patch } : prev));
    if (headerTimer.current) clearTimeout(headerTimer.current);
    headerTimer.current = setTimeout(() => {
      updatePresentation.mutate({ presentationId: selectedId, patch });
    }, 400);
  };

  const scheduleLinePatch = (lineId: string, patch: Partial<OtkShipmentLineUi>) => {
    if (!selectedId) return;
    const timers = lineTimers.current;
    const prev = timers.get(lineId);
    if (prev) clearTimeout(prev);
    timers.set(
      lineId,
      setTimeout(() => {
        updateLineMut.mutate({ presentationId: selectedId, lineId, patch });
        timers.delete(lineId);
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
      syncingRef.current = true;
      deleteLineMut.mutate(
        { presentationId: selectedId, lineId: line.id },
        {
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
          onSuccess: (card) => {
            setLocalCard(card);
          },
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
            <span className={styles.badge}>{items.length}</span>
          </div>
          <div className={styles.cardList}>
            {listBusy ? (
              <div className={styles.emptyState}>Загрузка…</div>
            ) : items.length === 0 ? (
              <div className={styles.emptyState}>Нет предъявлений.</div>
            ) : (
              items.map((card) => {
                const active = card.id === selectedId;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={active ? styles.cardItemActive : styles.cardItem}
                    onClick={() => {
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
                    <span className={styles.statusChip}>{STATUS_LABELS[card.status]}</span>
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
                <span className={styles.statusChip}>{STATUS_LABELS[selected.status]}</span>
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
