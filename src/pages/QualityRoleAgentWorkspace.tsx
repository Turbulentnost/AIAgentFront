import { useEffect, useMemo } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, OctagonAlert } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  useQualityRoleCase,
  useQualityRoleDashboard,
  useQualityRolePermissions
} from "@/hooks/useProcurementDashboard";
import type { ProcurementCaseSummary } from "@/types/procurement";
import { CaseListPanel } from "./procurement/CaseListPanel";
import { QualityRoleResultPanel } from "./procurement/QualityRoleResultPanel";
import styles from "./ProcurementAgent.module.css";

type Bucket = "success" | "attention" | "critical";

type Props = {
  agentId: string;
  title: string;
  description: string;
  forbiddenText: string;
};

const BUCKETS: Array<{
  id: Bucket;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
}> = [
  {
    id: "success",
    label: "Готово / релиз",
    description: "Разрешающий статус или завершённый шаг",
    icon: CheckCircle2
  },
  {
    id: "attention",
    label: "Требуют внимания",
    description: "Ожидание HITL, назначение, проверка docs",
    icon: CircleAlert
  },
  {
    id: "critical",
    label: "Критические",
    description: "Несоответствие, изолятор, блокировка",
    icon: OctagonAlert
  }
];

function deriveBucket(item: ProcurementCaseSummary): Bucket {
  const status = item.status;
  if (status === "failed" || status === "blocked" || status === "isolated" || status === "nonconformity") {
    return "critical";
  }
  if (status === "quality_released" || status === "closed" || status === "posted") {
    return "success";
  }
  if (
    item.requires_human_review ||
    status === "agent_waiting" ||
    status === "human_required" ||
    status.startsWith("quality_")
  ) {
    return "attention";
  }
  return "attention";
}

export default function QualityRoleAgentWorkspace({
  agentId,
  title,
  description,
  forbiddenText
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissionsQuery = useQualityRolePermissions(agentId);
  const canAccess =
    permissionsQuery.data?.accessible_role_agents?.includes(agentId) ?? false;
  const dashboardQuery = useQualityRoleDashboard(agentId, canAccess);
  const cases = useMemo(
    () =>
      (dashboardQuery.data?.groups.flatMap((group) => group.cases) ?? []).map((item) => ({
        ...item,
        quality_bucket: deriveBucket(item)
      })),
    [dashboardQuery.data]
  );
  const requestedBucket = searchParams.get("bucket");
  const activeBucket: Bucket =
    requestedBucket === "success" ||
    requestedBucket === "attention" ||
    requestedBucket === "critical"
      ? requestedBucket
      : "attention";
  const bucketCases = useMemo(
    () => cases.filter((item) => item.quality_bucket === activeBucket),
    [activeBucket, cases]
  );
  const bucketCounts = useMemo(
    () =>
      cases.reduce<Record<Bucket, number>>(
        (counts, item) => {
          counts[item.quality_bucket] += 1;
          return counts;
        },
        { success: 0, attention: 0, critical: 0 }
      ),
    [cases]
  );
  const selectedCaseId = searchParams.get("case") || "";
  const detailQuery = useQualityRoleCase(agentId, selectedCaseId || null, canAccess);

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
          {forbiddenText}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {dashboardQuery.isError ? (
        <div className={styles.warningBox}>
          <AlertTriangle size={16} /> Не удалось загрузить кейсы.
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
            title={BUCKETS.find((item) => item.id === activeBucket)?.label || title}
          />
        )}

        {!selectedCaseId ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>Выберите кейс для просмотра результата.</div>
          </section>
        ) : detailQuery.isLoading ? (
          <section className={styles.detailsPanel}>
            <div className={styles.emptyState}>
              <Loader2 className={styles.spin} size={16} /> Загрузка результата...
            </div>
          </section>
        ) : detailQuery.isError || !detailQuery.data ? (
          <section className={styles.detailsPanel}>
            <div className={styles.warningBox}>
              <AlertTriangle size={16} /> Не удалось загрузить результат.
            </div>
          </section>
        ) : (
          <QualityRoleResultPanel
            agentId={agentId}
            detail={detailQuery.data}
            subtitle={description}
          />
        )}
      </div>
    </div>
  );
}
