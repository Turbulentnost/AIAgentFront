import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Loader2,
  OctagonAlert
} from "lucide-react";
import {
  useQualityKpiDashboard,
  useQualityKpiPermissions
} from "@/hooks/useProcurementDashboard";
import type { KpiMetric } from "@/types/procurement";
import styles from "./ProcurementAgent.module.css";

function toneBucket(tone: KpiMetric["tone"]): "success" | "attention" | "critical" {
  if (tone === "bad") return "critical";
  if (tone === "warn" || tone === "unknown") return "attention";
  return "success";
}

function toneIcon(tone: KpiMetric["tone"]) {
  if (tone === "ok") return CheckCircle2;
  if (tone === "warn") return CircleAlert;
  if (tone === "bad") return OctagonAlert;
  return CircleHelp;
}

function toneHint(tone: KpiMetric["tone"]) {
  if (tone === "ok") return "Цель достигнута";
  if (tone === "warn") return "Отклонение в пределах допуска (±5 п.п.)";
  if (tone === "bad") return "Цель не достигнута (СТО / §12)";
  return "Нет выполненных / измеренных работ";
}

function MetricCard({ metric }: { metric: KpiMetric }) {
  const Icon = toneIcon(metric.tone);
  const valueLabel =
    metric.value === null || metric.value === undefined
      ? "—"
      : `${metric.value}${metric.unit ?? ""}`;
  return (
    <div
      className={styles.engineerBucket}
      data-bucket={toneBucket(metric.tone)}
      title={toneHint(metric.tone)}
    >
      <Icon size={18} />
      <span>
        <strong>{metric.title}</strong>
        <small>
          Цель: {metric.target_label}
          {metric.sample_size ? ` · n=${metric.sample_size}` : " · нет выборки"}
        </small>
      </span>
      <b>{valueLabel}</b>
    </div>
  );
}

function summaryTone(report: { system: KpiMetric[]; agents: { common: KpiMetric[]; special: KpiMetric[] }[] }) {
  const tones = [
    ...report.system.map((m) => m.tone),
    ...report.agents.flatMap((block) => [...block.common, ...block.special].map((m) => m.tone))
  ];
  if (tones.includes("bad")) return "critical" as const;
  if (tones.includes("warn") || tones.includes("unknown")) return "attention" as const;
  return "success" as const;
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

  const bannerTone = report ? summaryTone(report) : "success";
  const BannerIcon =
    bannerTone === "critical" ? OctagonAlert : bannerTone === "attention" ? CircleAlert : CheckCircle2;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Агент качества (KPI)</h2>
          <p>
            Оценка работы ИИ-агентов по §12 ТЗ: общие KPI, специальные KPI должностей и сквозные
            показатели; SLA входного контроля — по СТО-10-095
          </p>
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
          <div
            className={bannerTone === "critical" ? styles.criticalBox : styles.resultStatus}
            data-bucket={bannerTone}
          >
            <BannerIcon size={16} />
            <div>
              <strong>{report.summary}</strong>
              <span>
                {report.period_from || "—"} — {report.period_to || "сейчас"}
                {report.calculated_at ? ` · ${report.calculated_at}` : ""}
              </span>
            </div>
          </div>

          <h3>Сквозные KPI системы (§12.3)</h3>
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
                  <small> · ниже цели / нет данных: {block.below_target.join(", ")}</small>
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
