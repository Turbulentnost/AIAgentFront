import { useEffect, useMemo } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, OctagonAlert } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  useOmtoSupportManagerCase,
  useOmtoSupportManagerDashboard,
  useOmtoSupportManagerPermissions
} from "@/hooks/useProcurementDashboard";
import type { ProcurementCaseSummary } from "@/types/procurement";
import { CaseListPanel } from "./procurement/CaseListPanel";
import { OmtoSupportManagerResultPanel } from "./procurement/OmtoSupportManagerResultPanel";
import styles from "./ProcurementAgent.module.css";

const AGENT_ID = "omto_support_manager_agent";
type OmtoBucket = "success" | "attention" | "critical";

type CaseWithOmtoBucket = ProcurementCaseSummary & {
  omto_bucket: OmtoBucket;
  omto_bucket_reason: string;
};

const BUCKETS: Array<{
  id: OmtoBucket;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
}> = [
  {
    id: "success",
    label: "Успешные",
    description: "Обязательные поля заполнены, DATA_CHECK не требуется",
    icon: CheckCircle2
  },
  {
    id: "attention",
    label: "Требуют внимания",
    description: "Неполные данные или ожидается уточнение (DATA_CHECK)",
    icon: CircleAlert
  },
  {
    id: "critical",
    label: "Критические",
    description: "Критические замечания, блокировка или ошибка обработки",
    icon: OctagonAlert
  }
];

function deriveOmtoBucket(item: ProcurementCaseSummary): Pick<
  CaseWithOmtoBucket,
  "omto_bucket" | "omto_bucket_reason"
> {
  const summary = (item.summary || "").trim();
  const status = item.status;

  if (status === "failed" || status === "blocked") {
    return {
      omto_bucket: "critical",
      omto_bucket_reason: summary || "Обработка остановлена из-за ошибки или блокировки."
    };
  }

  if (
    item.requires_human_review ||
    status === "data_check" ||
    status === "human_required" ||
    status === "agent_waiting"
  ) {
    const isCritical =
      /критич/i.test(summary) ||
      status === "human_required";
    return {
      omto_bucket: isCritical ? "critical" : "attention",
      omto_bucket_reason:
        summary ||
        (isCritical
          ? "Критические замечания по обязательным полям."
          : "Требуется DATA_CHECK / уточнение данных.")
    };
  }

  if (status === "closed" || (!item.requires_human_review && /корректн/i.test(summary))) {
    return {
      omto_bucket: "success",
      omto_bucket_reason: summary || "Обязательные поля заполнены корректно."
    };
  }

  return {
    omto_bucket: "attention",
    omto_bucket_reason: summary || "Кейс в обработке или ожидает проверки."
  };
}

export default function OmtoSupportManagerAgent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissionsQuery = useOmtoSupportManagerPermissions();
  const canAccess =
    permissionsQuery.data?.accessible_role_agents?.includes(AGENT_ID) ?? false;
  const dashboardQuery = useOmtoSupportManagerDashboard(canAccess);
  const cases = useMemo<CaseWithOmtoBucket[]>(
    () =>
      (dashboardQuery.data?.groups.flatMap((group) => group.cases) ?? []).map((item) => ({
        ...item,
        ...deriveOmtoBucket(item)
      })),
    [dashboardQuery.data]
  );
  const requestedBucket = searchParams.get("bucket");
  const activeBucket: OmtoBucket =
    requestedBucket === "success" ||
    requestedBucket === "attention" ||
    requestedBucket === "critical"
      ? requestedBucket
      : "critical";
  const bucketCases = useMemo(
    () => cases.filter((item) => item.omto_bucket === activeBucket),
    [activeBucket, cases]
  );
  const bucketCounts = useMemo(
    () =>
      cases.reduce<Record<OmtoBucket, number>>(
        (counts, item) => {
          counts[item.omto_bucket] += 1;
          return counts;
        },
        { success: 0, attention: 0, critical: 0 }
      ),
    [cases]
  );
  const selectedCaseId = searchParams.get("case") || "";
  const detailQuery = useOmtoSupportManagerCase(selectedCaseId || null, canAccess);

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

  const selectBucket = (bucket: OmtoBucket) => {
    const next = new URLSearchParams(searchParams);
    next.set("bucket", bucket);
    next.delete("case");
    setSearchParams(next);
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

  if (permissionsQuery.isError) {
    return (
      <div className={styles.page}>
        <div className={styles.forbidden}>
          <AlertTriangle size={18} /> Не удалось проверить права доступа.
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <div className={styles.forbidden}>
          <AlertTriangle size={18} />
          Рабочее место менеджера по сопровождению ОМТО недоступно для вашей учётной записи.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Менеджер по сопровождению ОМТО</h2>
          <p>Контроль обязательных полей поставки и DATA_CHECK</p>
        </div>
      </div>

      {dashboardQuery.isError ? (
        <div className={styles.warningBox}>
          <AlertTriangle size={16} /> Не удалось загрузить кейсы ОМТО.
        </div>
      ) : null}

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
            emptyText={`В разделе «${BUCKETS.find((item) => item.id === activeBucket)?.label}» кейсов нет.`}
            onSelect={selectCase}
            selectedCaseId={selectedCaseId}
            showOmtoMeta
            title={BUCKETS.find((item) => item.id === activeBucket)?.label || "Кейсы ОМТО"}
          />
        )}

        {!selectedCaseId ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>Выберите кейс для просмотра результата.</div>
          </section>
        ) : detailQuery.isLoading ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка результата проверки...
            </div>
          </section>
        ) : detailQuery.isError || !detailQuery.data ? (
          <section className={styles.detailsPanel}>
            <div className={styles.warningBox}>
              <AlertTriangle size={16} /> Не удалось загрузить результат проверки.
            </div>
          </section>
        ) : (
          <OmtoSupportManagerResultPanel detail={detailQuery.data} />
        )}
      </div>
    </div>
  );
}
