import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, OctagonAlert } from "lucide-react";
import {
  useQualityKpiDashboard,
  useQualityKpiPermissions
} from "@/hooks/useProcurementDashboard";
import type { KpiMetric } from "@/types/procurement";
import styles from "./ProcurementAgent.module.css";

function toneIcon(tone: KpiMetric["tone"]) {
  if (tone === "ok") return CheckCircle2;
  if (tone === "warn") return CircleAlert;
  if (tone === "bad") return OctagonAlert;
  return CircleAlert;
}

function MetricCard({ metric }: { metric: KpiMetric }) {
  const Icon = toneIcon(metric.tone);
  const valueLabel =
    metric.value === null || metric.value === undefined
      ? "—"
      : `${metric.value}${metric.unit ?? ""}`;
  return (
    <div className={styles.engineerBucket} data-bucket={metric.tone === "bad" ? "critical" : metric.tone === "warn" ? "attention" : "success"}>
      <Icon size={18} />
      <span>
        <strong>{metric.title}</strong>
        <small>
          Цель: {metric.target_label}
          {metric.sample_size ? ` · n=${metric.sample_size}` : ""}
        </small>
      </span>
      <b>{valueLabel}</b>
    </div>
  );
}

export default function QualityKpiAgent() {
  const permissionsQuery = useQualityKpiPermissions();
  const canAccess =
    permissionsQuery.data?.accessible_role_agents?.includes("quality_kpi_agent") ?? false;
  const dashboardQuery = useQualityKpiDashboard(canAccess);
  const report = dashboardQuery.data;

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
          Рабочее место KPI-агента качества недоступно для вашей учётной записи.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Агент качества (KPI)</h2>
          <p>Оценка работы ИИ-агентов и расчёт KPI по §12 ТЗ</p>
        </div>
      </div>

      {dashboardQuery.isLoading ? (
        <div className={styles.emptyState}>
          <Loader2 className={styles.spin} size={16} /> Считаем KPI...
        </div>
      ) : dashboardQuery.isError || !report ? (
        <div className={styles.warningBox}>
          <AlertTriangle size={16} /> Не удалось загрузить KPI-отчёт.
        </div>
      ) : (
        <>
          <div className={styles.resultStatus}>
            <CheckCircle2 size={16} />
            <div>
              <strong>{report.summary}</strong>
              <span>
                {report.period_from || "—"} — {report.period_to || "сейчас"}
                {report.calculated_at ? ` · ${report.calculated_at}` : ""}
              </span>
            </div>
          </div>

          <h3>Сквозные KPI системы</h3>
          <div className={styles.engineerBuckets}>
            {report.system.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>

          {report.agents.map((block) => (
            <div key={block.agent_id}>
              <h3>
                {block.agent_label}
                {block.below_target.length ? (
                  <small> · ниже цели: {block.below_target.join(", ")}</small>
                ) : null}
              </h3>
              <div className={styles.engineerBuckets}>
                {[...block.common, ...block.special].map((metric) => (
                  <MetricCard key={`${block.agent_id}-${metric.id}`} metric={metric} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
