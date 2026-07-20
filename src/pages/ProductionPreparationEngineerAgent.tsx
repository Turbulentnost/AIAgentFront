import { useEffect, useMemo } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, OctagonAlert } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  useProductionPreparationEngineerCase,
  useProductionPreparationEngineerDashboard,
  useProductionPreparationEngineerPermissions
} from "@/hooks/useProcurementDashboard";
import { CaseListPanel } from "./procurement/CaseListPanel";
import { ProductionPreparationEngineerResultPanel } from "./procurement/ProductionPreparationEngineerResultPanel";
import styles from "./ProcurementAgent.module.css";

const AGENT_ID = "production_preparation_engineer_agent";
type EngineerBucket = "success" | "attention" | "critical";

const BUCKETS: Array<{
  id: EngineerBucket;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
}> = [
  {
    id: "success",
    label: "Успешные",
    description: "Данные прочитаны, потребность рассчитана и обеспечена",
    icon: CheckCircle2
  },
  {
    id: "attention",
    label: "Требуют внимания",
    description: "Расчёт выполнен, но подтверждённого остатка недостаточно",
    icon: CircleAlert
  },
  {
    id: "critical",
    label: "Критические",
    description: "Обработка остановлена из-за ошибки или недостающих данных",
    icon: OctagonAlert
  }
];

export default function ProductionPreparationEngineerAgent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissionsQuery = useProductionPreparationEngineerPermissions();
  const canAccess =
    permissionsQuery.data?.accessible_role_agents?.includes(AGENT_ID) ?? false;
  const dashboardQuery = useProductionPreparationEngineerDashboard(canAccess);
  const cases = useMemo(
    () => dashboardQuery.data?.groups.flatMap((group) => group.cases) ?? [],
    [dashboardQuery.data]
  );
  const requestedBucket = searchParams.get("bucket");
  const activeBucket: EngineerBucket =
    requestedBucket === "success" ||
    requestedBucket === "attention" ||
    requestedBucket === "critical"
      ? requestedBucket
      : "critical";
  const bucketCases = useMemo(
    () => cases.filter((item) => (item.engineer_bucket || "attention") === activeBucket),
    [activeBucket, cases]
  );
  const bucketCounts = useMemo(
    () =>
      cases.reduce<Record<EngineerBucket, number>>(
        (counts, item) => {
          counts[item.engineer_bucket || "attention"] += 1;
          return counts;
        },
        { success: 0, attention: 0, critical: 0 }
      ),
    [cases]
  );
  const selectedCaseId = searchParams.get("case") || "";
  const detailQuery = useProductionPreparationEngineerCase(selectedCaseId || null, canAccess);

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

  const selectBucket = (bucket: EngineerBucket) => {
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
          Рабочее место инженера по подготовке производства недоступно для вашей учётной записи.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Инженер по подготовке производства</h2>
          <p>Расчёты обеспеченности по производственным заказам</p>
        </div>
      </div>

      {dashboardQuery.isError ? (
        <div className={styles.warningBox}>
          <AlertTriangle size={16} /> Не удалось загрузить производственные кейсы.
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
            showEngineerMeta
            title={BUCKETS.find((item) => item.id === activeBucket)?.label || "Производственные кейсы"}
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
          <ProductionPreparationEngineerResultPanel detail={detailQuery.data} />
        )}
      </div>
    </div>
  );
}
