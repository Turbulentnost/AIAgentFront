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
  useWarehousePickerCase,
  useWarehousePickerDashboard,
  useWarehousePickerPermissions
} from "@/hooks/useProcurementDashboard";
import { CaseListPanel } from "./procurement/CaseListPanel";
import { WarehousePickerResultPanel } from "./procurement/WarehousePickerResultPanel";
import styles from "./ProcurementAgent.module.css";

type Bucket = "success" | "attention" | "critical";
type AttentionSection = "processing" | "awaiting";

export type WarehouseAvailabilityWorkspaceConfig = {
  agentId: string;
  title: string;
  subtitle: string;
  forbiddenText: string;
  listTitle: string;
  scopeLabel: string;
  roleAccountLabel: string;
  archivedConclusionAgentLabel: string;
};

const BUCKETS: Array<{
  id: Bucket;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
}> = [
  {
    id: "success",
    label: "Успешные",
    description: "Наличие подтверждено, кейс передан в ОМТО",
    icon: CheckCircle2
  },
  {
    id: "attention",
    label: "Требуют внимания",
    description: "Нужно подтвердить выдачу, дефицит или расхождение",
    icon: CircleAlert
  },
  {
    id: "critical",
    label: "Критические",
    description: "Недостаточно данных для заключения по кладовой",
    icon: OctagonAlert
  }
];

export const WAREHOUSE_PICKER_WORKSPACE: WarehouseAvailabilityWorkspaceConfig = {
  agentId: "warehouse_picker_agent",
  title: "ИИ-агент по закупке",
  subtitle: "Для кладовщика-комплектовщика · Монтажный участок №2",
  forbiddenText: "Рабочее место доступно только кладовщику-комплектовщику.",
  listTitle: "Заказы МУ №2",
  scopeLabel: "Монтажный участок №2",
  roleAccountLabel: "кладовщика-комплектовщика",
  archivedConclusionAgentLabel: "ИИ-агентом по закупке"
};

export const WAREHOUSE_COMPLEX_CHIEF_WORKSPACE: WarehouseAvailabilityWorkspaceConfig = {
  agentId: "warehouse_complex_chief_agent",
  title: "ИИ-агент по закупкам",
  subtitle: "Начальник складского комплекса · заказы материалов кроме МУ №2",
  forbiddenText: "Рабочее место доступно только начальнику складского комплекса.",
  listTitle: "Заказы материалов",
  scopeLabel: "кроме МУ №2",
  roleAccountLabel: "начальника складского комплекса",
  archivedConclusionAgentLabel: "ИИ-агентом по закупкам"
};

export function WarehouseAvailabilityWorkspace({
  config
}: {
  config: WarehouseAvailabilityWorkspaceConfig;
}) {
  const { agentId } = config;
  const [searchParams, setSearchParams] = useSearchParams();
  const [documentSearch, setDocumentSearch] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const permissionsQuery = useWarehousePickerPermissions(agentId);
  const canAccess =
    permissionsQuery.data?.accessible_role_agents?.includes(agentId) ?? false;
  const activeView = searchParams.get("view") === "archive" ? "archive" : "active";
  const activeDashboardQuery = useWarehousePickerDashboard(canAccess, "active", agentId);
  const archiveDashboardQuery = useWarehousePickerDashboard(canAccess, "archive", agentId);
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
  const activeBucket: Bucket =
    requestedBucket === "success" ||
    requestedBucket === "attention" ||
    requestedBucket === "critical"
      ? requestedBucket
      : "attention";
  const attentionSection: AttentionSection =
    searchParams.get("attention") === "awaiting" ? "awaiting" : "processing";

  const bucketCases = useMemo(() => {
    if (activeView === "archive") return cases;
    const matching = cases.filter(
      (item) => (item.picker_bucket || "attention") === activeBucket
    );
    if (activeBucket !== "attention") return matching;
    return matching.filter((item) =>
      attentionSection === "processing"
        ? item.picker_work_status === "processing"
        : item.picker_work_status !== "processing"
    );
  }, [activeBucket, activeView, attentionSection, cases]);

  const bucketCounts = useMemo(
    () =>
      cases.reduce<Record<Bucket, number>>(
        (counts, item) => {
          counts[item.picker_bucket || "attention"] += 1;
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
          if ((item.picker_bucket || "attention") !== "attention") return counts;
          if (item.picker_work_status === "processing") counts.processing += 1;
          else counts.awaiting += 1;
          return counts;
        },
        { processing: 0, awaiting: 0 }
      ),
    [cases]
  );
  const selectedCaseId = searchParams.get("case") || "";
  const detailQuery = useWarehousePickerCase(selectedCaseId || null, canAccess, agentId);

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

  const selectBucket = (bucket: Bucket) => {
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
      value
        ?.toLocaleLowerCase("ru-RU")
        .replace(/[\s_-]+/g, "")
        .includes(query.replace(/[\s_-]+/g, "")) ?? false;
    const found =
      activeCases.find(
        (item) =>
          matches(item.source_number) ||
          matches(item.source_1c_ref) ||
          matches(item.id)
      ) ||
      archiveCases.find(
        (item) =>
          matches(item.source_number) ||
          matches(item.source_1c_ref) ||
          matches(item.id)
      );
    if (!found) {
      setSearchMessage(`Документ «${documentSearch.trim()}» не найден.`);
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (archiveCases.some((item) => item.id === found.id)) {
      next.set("view", "archive");
    } else {
      next.delete("view");
      next.set("bucket", found.picker_bucket || "attention");
      if (
        (found.picker_bucket || "attention") === "attention" &&
        found.picker_work_status !== "processing"
      ) {
        next.set("attention", "awaiting");
      } else {
        next.delete("attention");
      }
    }
    next.set("case", found.id);
    setSearchParams(next);
    setSearchMessage("");
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
          {config.forbiddenText}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
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
        <form className={styles.documentSearch} onSubmit={submitDocumentSearch}>
          <Search size={16} />
          <input
            aria-label="Номер документа 1С"
            onChange={(event) => {
              setDocumentSearch(event.target.value);
              setSearchMessage("");
            }}
            placeholder="Номер документа 1С"
            value={documentSearch}
          />
          {documentSearch ? (
            <button
              aria-label="Очистить"
              className={styles.documentSearchClear}
              onClick={() => setDocumentSearch("")}
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
            showPickerMeta
            title={activeView === "archive" ? "Архив" : config.listTitle}
          />
        )}

        {!selectedCaseId ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>Выберите кейс для просмотра заключения.</div>
          </section>
        ) : detailQuery.isLoading ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка...
            </div>
          </section>
        ) : detailQuery.isError || !detailQuery.data ? (
          <section className={styles.detailsPanel}>
            <div className={styles.warningBox}>
              <AlertTriangle size={16} /> Не удалось загрузить заключение.
            </div>
          </section>
        ) : (
          <WarehousePickerResultPanel
            agentSlug={agentId}
            archivedConclusionAgentLabel={config.archivedConclusionAgentLabel}
            detail={detailQuery.data}
            roleAccountLabel={config.roleAccountLabel}
            scopeLabel={config.scopeLabel}
          />
        )}
      </div>
    </div>
  );
}

export default function WarehousePickerAgent() {
  return <WarehouseAvailabilityWorkspace config={WAREHOUSE_PICKER_WORKSPACE} />;
}
