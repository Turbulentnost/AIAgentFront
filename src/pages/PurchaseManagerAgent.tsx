import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleAlert,
  ListChecks,
  Loader2,
  OctagonAlert,
  Search,
  X
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  usePurchaseManagerCase,
  usePurchaseManagerDashboard,
  usePurchaseManagerPermissions
} from "@/hooks/useProcurementDashboard";
import { CaseListPanel } from "./procurement/CaseListPanel";
import { PurchaseManagerResultPanel } from "./procurement/PurchaseManagerResultPanel";
import styles from "./ProcurementAgent.module.css";

const AGENT_ID = "purchase_manager_agent";
type Bucket = "success" | "attention" | "critical";

const BUCKETS: Array<{
  id: Bucket;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
}> = [
  {
    id: "success",
    label: "Сверено",
    description: "Потребность покрыта заказами поставщикам",
    icon: CheckCircle2
  },
  {
    id: "attention",
    label: "Требуют внимания",
    description: "Нужно подтвердить сверку или создать заказ",
    icon: CircleAlert
  },
  {
    id: "critical",
    label: "Критические",
    description: "Недостаточно данных для сопоставления",
    icon: OctagonAlert
  }
];

export default function PurchaseManagerAgent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [documentSearch, setDocumentSearch] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const permissionsQuery = usePurchaseManagerPermissions();
  const canAccess =
    permissionsQuery.data?.accessible_role_agents?.includes(AGENT_ID) ?? false;
  const activeView = searchParams.get("view") === "archive" ? "archive" : "active";
  const activeDashboardQuery = usePurchaseManagerDashboard(canAccess, "active");
  const archiveDashboardQuery = usePurchaseManagerDashboard(canAccess, "archive");
  const dashboardQuery =
    activeView === "archive" ? archiveDashboardQuery : activeDashboardQuery;
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
  const bucketCases = useMemo(
    () =>
      activeView === "archive"
        ? cases
        : cases.filter(
            (item) => (item.purchase_manager_bucket || "attention") === activeBucket
          ),
    [activeBucket, activeView, cases]
  );
  const bucketCounts = useMemo(
    () =>
      cases.reduce<Record<Bucket, number>>(
        (counts, item) => {
          counts[item.purchase_manager_bucket || "attention"] += 1;
          return counts;
        },
        { success: 0, attention: 0, critical: 0 }
      ),
    [cases]
  );
  const selectedCaseId = searchParams.get("case") || "";
  const detailQuery = usePurchaseManagerCase(selectedCaseId || null, canAccess);

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
    const found =
      activeCases.find((item) => matches(item.source_number) || matches(item.source_1c_ref)) ||
      archiveCases.find((item) => matches(item.source_number) || matches(item.source_1c_ref));
    if (!found) {
      setSearchMessage(`Документ «${documentSearch.trim()}» не найден.`);
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (archiveCases.some((item) => item.id === found.id)) next.set("view", "archive");
    else {
      next.delete("view");
      next.set("bucket", found.purchase_manager_bucket || "attention");
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
          Рабочее место менеджера по закупкам недоступно для вашей учётной записи.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>ИИ-агент менеджера по закупкам</h2>
          <p>Сверка потребности с открытыми заказами поставщикам</p>
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
          <button className={styles.documentSearchSubmit} type="submit">Найти</button>
        </form>
      </div>
      {searchMessage ? <div className={styles.documentSearchMessage}>{searchMessage}</div> : null}

      {activeView === "active" ? (
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
                <span><strong>{bucket.label}</strong><small>{bucket.description}</small></span>
                <b>{bucketCounts[bucket.id]}</b>
              </button>
            );
          })}
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
            emptyText={activeView === "archive" ? "Архивных кейсов нет." : "В выбранном разделе кейсов нет."}
            onSelect={selectCase}
            selectedCaseId={selectedCaseId}
            showArchiveMeta={activeView === "archive"}
            showPurchaseManagerMeta
            title={activeView === "archive" ? "Архив" : "Сверка заказов"}
          />
        )}

        {!selectedCaseId ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>Выберите кейс для просмотра сверки.</div>
          </section>
        ) : detailQuery.isLoading ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка сверки...
            </div>
          </section>
        ) : detailQuery.isError || !detailQuery.data ? (
          <section className={styles.detailsPanel}>
            <div className={styles.warningBox}>
              <AlertTriangle size={16} /> Не удалось загрузить результат сверки.
            </div>
          </section>
        ) : (
          <PurchaseManagerResultPanel detail={detailQuery.data} />
        )}
      </div>
    </div>
  );
}
