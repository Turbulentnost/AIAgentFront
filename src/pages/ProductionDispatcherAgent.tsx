import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ListChecks,
  Loader2,
  OctagonAlert,
  Search,
  X
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  useProductionDispatcherCase,
  useProductionDispatcherDashboard,
  useProductionDispatcherPermissions
} from "@/hooks/useProcurementDashboard";
import { CaseListPanel } from "./procurement/CaseListPanel";
import { ProductionDispatcherResultPanel } from "./procurement/ProductionDispatcherResultPanel";
import styles from "./ProcurementAgent.module.css";

const AGENT_ID = "production_dispatcher_agent";
type DispatcherBucket = "success" | "attention" | "critical";
type AttentionSection = "processing" | "awaiting";
type StreamFilter = "all" | "reorder_point" | "after_engineer";

const BUCKETS: Array<{
  id: DispatcherBucket;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
}> = [
  {
    id: "success",
    label: "Успешные",
    description: "Запас покрывает потребность",
    icon: CheckCircle2
  },
  {
    id: "attention",
    label: "Требуют внимания",
    description: "Нужно подтвердить способ обеспечения",
    icon: CircleAlert
  },
  {
    id: "critical",
    label: "Критические",
    description: "Недостаточно данных или критический дефицит",
    icon: OctagonAlert
  }
];

export default function ProductionDispatcherAgent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [documentSearch, setDocumentSearch] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const permissionsQuery = useProductionDispatcherPermissions();
  const canAccess =
    permissionsQuery.data?.accessible_role_agents?.includes(AGENT_ID) ?? false;
  const activeView = searchParams.get("view") === "archive" ? "archive" : "active";
  const activeDashboardQuery = useProductionDispatcherDashboard(canAccess, "active");
  const archiveDashboardQuery = useProductionDispatcherDashboard(canAccess, "archive");
  const dashboardQuery = activeView === "archive" ? archiveDashboardQuery : activeDashboardQuery;
  const cases = useMemo(
    () => dashboardQuery.data?.groups.flatMap((group) => group.cases) ?? [],
    [dashboardQuery.data]
  );
  const activeCases = useMemo(
    () => activeDashboardQuery.data?.groups.flatMap((group) => group.cases) ?? [],
    [activeDashboardQuery.data]
  );
  const archiveCases = useMemo(
    () => archiveDashboardQuery.data?.groups.flatMap((group) => group.cases) ?? [],
    [archiveDashboardQuery.data]
  );
  const requestedBucket = searchParams.get("bucket");
  const activeBucket: DispatcherBucket =
    requestedBucket === "success" ||
    requestedBucket === "attention" ||
    requestedBucket === "critical"
      ? requestedBucket
      : "attention";
  const attentionSection: AttentionSection =
    searchParams.get("attention") === "awaiting" ? "awaiting" : "processing";
  const streamFilter: StreamFilter =
    searchParams.get("stream") === "reorder_point" ||
    searchParams.get("stream") === "after_engineer"
      ? (searchParams.get("stream") as StreamFilter)
      : "all";

  const bucketCases = useMemo(() => {
    const byStream =
      streamFilter === "all"
        ? cases
        : cases.filter((item) => item.dispatcher_stream === streamFilter);
    if (activeView === "archive") return byStream;
    const matchingBucket = byStream.filter(
      (item) => (item.dispatcher_bucket || "attention") === activeBucket
    );
    if (activeBucket !== "attention") return matchingBucket;
    return matchingBucket.filter((item) =>
      attentionSection === "processing"
        ? item.dispatcher_work_status === "processing"
        : item.dispatcher_work_status !== "processing"
    );
  }, [activeBucket, activeView, attentionSection, cases, streamFilter]);

  const bucketCounts = useMemo(
    () =>
      cases.reduce<Record<DispatcherBucket, number>>(
        (counts, item) => {
          counts[item.dispatcher_bucket || "attention"] += 1;
          return counts;
        },
        { success: 0, attention: 0, critical: 0 }
      ),
    [cases]
  );
  const attentionCounts = useMemo(
    () =>
      cases.reduce(
        (counts, item) => {
          if ((item.dispatcher_bucket || "attention") !== "attention") return counts;
          if (item.dispatcher_work_status === "processing") counts.processing += 1;
          else counts.awaiting += 1;
          return counts;
        },
        { processing: 0, awaiting: 0 }
      ),
    [cases]
  );
  const selectedCaseId = searchParams.get("case") || "";
  const detailQuery = useProductionDispatcherCase(selectedCaseId || null, canAccess);

  useEffect(() => {
    if (!bucketCases.length) {
      if (selectedCaseId) {
        const next = new URLSearchParams(searchParams);
        next.delete("case");
        setSearchParams(next, { replace: true });
      }
      return;
    }
    if (!bucketCases.some((item) => item.id === selectedCaseId)) {
      const next = new URLSearchParams(searchParams);
      next.set("case", bucketCases[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [bucketCases, searchParams, selectedCaseId, setSearchParams]);

  const selectCase = (caseId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("case", caseId);
    setSearchParams(next);
  };

  const selectBucket = (bucket: DispatcherBucket) => {
    const next = new URLSearchParams(searchParams);
    next.set("bucket", bucket);
    next.delete("case");
    setSearchParams(next);
  };

  const selectAttentionSection = (section: AttentionSection) => {
    const next = new URLSearchParams(searchParams);
    if (section === "awaiting") next.set("attention", "awaiting");
    else next.delete("attention");
    next.delete("case");
    setSearchParams(next);
  };

  const selectStream = (stream: StreamFilter) => {
    const next = new URLSearchParams(searchParams);
    if (stream === "all") next.delete("stream");
    else next.set("stream", stream);
    next.delete("case");
    setSearchParams(next);
  };

  const selectView = (view: "active" | "archive") => {
    const next = new URLSearchParams(searchParams);
    if (view === "archive") next.set("view", "archive");
    else next.delete("view");
    next.delete("case");
    setSearchParams(next);
  };

  const submitDocumentSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = documentSearch.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, "");
    if (!query) {
      setSearchMessage("Введите номер документа 1С.");
      return;
    }
    const matches = (value?: string | null) =>
      value?.toLocaleLowerCase("ru-RU").replace(/\s+/g, "").includes(query) ?? false;
    const exactMatch = (value?: string | null) =>
      value?.toLocaleLowerCase("ru-RU").replace(/\s+/g, "") === query;
    const findCase = (items: typeof activeCases) =>
      items.find((item) => exactMatch(item.source_number)) ||
      items.find((item) => matches(item.source_number) || matches(item.source_1c_ref));

    for (const bucket of ["attention", "critical", "success"] as DispatcherBucket[]) {
      const found = findCase(
        activeCases.filter((item) => (item.dispatcher_bucket || "attention") === bucket)
      );
      if (found) {
        const next = new URLSearchParams(searchParams);
        next.delete("view");
        next.set("bucket", bucket);
        if (bucket === "attention" && found.dispatcher_work_status !== "processing") {
          next.set("attention", "awaiting");
        } else {
          next.delete("attention");
        }
        next.set("case", found.id);
        setSearchParams(next);
        setSearchMessage("");
        return;
      }
    }
    const archived = findCase(archiveCases);
    if (archived) {
      const next = new URLSearchParams(searchParams);
      next.set("view", "archive");
      next.set("case", archived.id);
      setSearchParams(next);
      setSearchMessage("");
      return;
    }
    setSearchMessage(`Документ «${documentSearch.trim()}» не найден.`);
  };

  if (permissionsQuery.isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <Loader2 className={styles.spin} size={18} /> Загрузка прав доступа...
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <div className={styles.forbidden}>
          <AlertTriangle size={18} />
          Рабочее место диспетчера производства недоступно для вашей учётной записи.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>ИИ-агент диспетчера производства</h2>
          <p>Точки заказа и кейсы после инженера СПП</p>
        </div>
      </div>

      <div className={styles.engineerToolbar}>
        <div className={styles.caseViewSwitch}>
          <button
            className={activeView === "active" ? styles.caseViewActive : styles.caseViewBtn}
            onClick={() => selectView("active")}
            type="button"
          >
            <ListChecks size={16} /> Текущие
          </button>
          <button
            className={activeView === "archive" ? styles.caseViewActive : styles.caseViewBtn}
            onClick={() => selectView("archive")}
            type="button"
          >
            <Archive size={16} /> Архив (
            {activeDashboardQuery.data?.counts.archive ?? archiveCases.length})
          </button>
        </div>
        <div className={styles.attentionSectionSwitch}>
          <button
            className={streamFilter === "all" ? styles.caseViewActive : styles.caseViewBtn}
            onClick={() => selectStream("all")}
            type="button"
          >
            Все потоки
          </button>
          <button
            className={
              streamFilter === "reorder_point" ? styles.caseViewActive : styles.caseViewBtn
            }
            onClick={() => selectStream("reorder_point")}
            type="button"
          >
            Точки заказа
          </button>
          <button
            className={
              streamFilter === "after_engineer" ? styles.caseViewActive : styles.caseViewBtn
            }
            onClick={() => selectStream("after_engineer")}
            type="button"
          >
            После инженера
          </button>
        </div>
        <form className={styles.documentSearch} onSubmit={submitDocumentSearch}>
          <Search size={16} />
          <input
            aria-label="Номер документа 1С"
            onChange={(event) => {
              setDocumentSearch(event.target.value);
              if (searchMessage) setSearchMessage("");
            }}
            placeholder="Номер документа 1С"
            value={documentSearch}
          />
          {documentSearch ? (
            <button
              aria-label="Очистить поиск"
              className={styles.documentSearchClear}
              onClick={() => {
                setDocumentSearch("");
                setSearchMessage("");
              }}
              type="button"
            >
              <X size={14} />
            </button>
          ) : null}
          <button className={styles.documentSearchSubmit} type="submit">
            Найти
          </button>
        </form>
      </div>
      {searchMessage ? <div className={styles.documentSearchMessage}>{searchMessage}</div> : null}

      {activeView === "active" ? (
        <div className={styles.engineerBucketArea}>
          <div className={styles.engineerBuckets}>
            {BUCKETS.map((bucket) => {
              const Icon = bucket.icon;
              return (
                <button
                  className={
                    activeBucket === bucket.id
                      ? `${styles.engineerBucket} ${styles.engineerBucketActive}`
                      : styles.engineerBucket
                  }
                  data-bucket={bucket.id}
                  key={bucket.id}
                  onClick={() => selectBucket(bucket.id)}
                  type="button"
                >
                  <Icon size={20} />
                  <span>
                    <strong>{bucket.label}</strong>
                    <small>{bucket.description}</small>
                  </span>
                  <b>{bucketCounts[bucket.id]}</b>
                </button>
              );
            })}
          </div>
          {activeBucket === "attention" ? (
            <div className={styles.attentionSectionSwitch}>
              <button
                className={
                  attentionSection === "processing"
                    ? styles.caseViewActive
                    : styles.caseViewBtn
                }
                onClick={() => selectAttentionSection("processing")}
                type="button"
              >
                <Loader2
                  className={attentionCounts.processing > 0 ? styles.spin : undefined}
                  size={15}
                />
                Рассчитывается ({attentionCounts.processing})
              </button>
              <button
                className={
                  attentionSection === "awaiting"
                    ? styles.caseViewActive
                    : styles.caseViewBtn
                }
                onClick={() => selectAttentionSection("awaiting")}
                type="button"
              >
                <Clock3 size={15} />
                Ожидает решения ({attentionCounts.awaiting})
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.workspace}>
        {dashboardQuery.isLoading ? (
          <section className={styles.queuePanel}>
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка кейсов...
            </div>
          </section>
        ) : (
          <CaseListPanel
            cases={bucketCases}
            emptyText={
              activeView === "archive"
                ? "Архивных кейсов нет."
                : "В выбранном разделе кейсов нет."
            }
            onSelect={selectCase}
            selectedCaseId={selectedCaseId}
            showArchiveMeta={activeView === "archive"}
            showDispatcherMeta
            title={activeView === "archive" ? "Архив" : "Кейсы диспетчера"}
          />
        )}

        {!selectedCaseId ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>Выберите кейс для просмотра результата.</div>
          </section>
        ) : detailQuery.isLoading ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка расчёта...
            </div>
          </section>
        ) : detailQuery.isError || !detailQuery.data ? (
          <section className={styles.detailsPanel}>
            <div className={styles.warningBox}>
              <AlertTriangle size={16} /> Не удалось загрузить результат расчёта.
            </div>
          </section>
        ) : (
          <ProductionDispatcherResultPanel detail={detailQuery.data} />
        )}
      </div>
    </div>
  );
}
