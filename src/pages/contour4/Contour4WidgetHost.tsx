import type { Contour4Widget } from "@/types/contour4";
import { isRegistryLineBlocked } from "./contour4Session";
import styles from "./Contour4Workspace.module.css";
import { formatCell, formatMoney } from "./lib/formatters";
import { statusClass, timelineStatusClassMap } from "./lib/statusClass";

function renderTableCell(
  key: string,
  row: Record<string, string | number | boolean | null | undefined>,
  blocked: boolean
) {
  if (key === "cfo_approved" && blocked) {
    return <span className={styles.badgeBlocked}>без ЦФО</span>;
  }
  if (key === "amount") {
    return formatMoney(row[key] as string | number);
  }
  return formatCell(row[key]);
}

function ChartBars({
  labels,
  values
}: {
  labels: string[];
  values: number[];
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={styles.chartBars}>
      {labels.map((label, i) => {
        const v = values[i] ?? 0;
        const pct = Math.round((Math.abs(v) / max) * 100);
        const over =
          v > (values.find((_, j) => labels[j]?.includes("Лимит")) ?? Infinity);
        return (
          <div key={label} className={styles.chartBarRow}>
            <span className={styles.chartBarLabel}>{label}</span>
            <div className={styles.chartBarTrack}>
              <i
                className={
                  over && label.includes("Сумма")
                    ? styles.chartBarFillBad
                    : styles.chartBarFill
                }
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={styles.chartBarValue}>{formatMoney(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartLine({
  labels,
  values
}: {
  labels: string[];
  values: number[];
}) {
  const max = Math.max(...values, 1);
  const points = values
    .map((v, i) => {
      const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div className={styles.chartLineWrap}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={styles.chartLineSvg}
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
        />
      </svg>
      <div className={styles.chartLineLabels}>
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function WidgetBody({
  widget,
  highlightBlockedRows
}: {
  widget: Contour4Widget;
  highlightBlockedRows?: boolean;
}) {
  const data = widget.data;
  const timelineMap = timelineStatusClassMap(styles);

  if (widget.type === "kpi_cards") {
    return (
      <div className={styles.widgetKpiGrid}>
        {(data.cards ?? []).map((card) => {
          const raw = card.value;
          const display =
            card.format === "money"
              ? formatMoney(raw as string | number)
              : formatCell(raw);
          const negative =
            card.format === "money" &&
            Number(String(raw).replace(/\s/g, "")) < 0;
          return (
            <div
              key={card.key}
              className={
                negative ? styles.widgetKpiCardBad : styles.widgetKpiCard
              }
            >
              <span className={styles.widgetKpiLabel}>{card.label}</span>
              <span className={styles.widgetKpiValue}>{display}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (widget.type === "table") {
    const columns = data.columns ?? [];
    const rows = data.rows ?? [];
    return (
      <div className={styles.widgetTableWrap}>
        <table className={styles.widgetTable}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const blocked = highlightBlockedRows && isRegistryLineBlocked(row);
              return (
                <tr
                  key={String(row.payment_request_id ?? idx)}
                  className={blocked ? styles.widgetRowBlocked : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key}>
                      {renderTableCell(c.key, row, Boolean(blocked))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (widget.type === "chart_bar") {
    const labels = data.labels ?? [];
    const values = data.series?.[0]?.values ?? [];
    return <ChartBars labels={labels} values={values} />;
  }

  if (widget.type === "chart_line") {
    const labels = data.labels ?? [];
    const values = data.series?.[0]?.values ?? [];
    return <ChartLine labels={labels} values={values} />;
  }

  if (widget.type === "timeline") {
    return (
      <ul className={styles.widgetTimeline}>
        {(data.items ?? []).map((item) => (
          <li key={item.label} className={styles.widgetTimelineItem}>
            <span className={statusClass(timelineMap, item.status)} />
            <div>
              <strong>{item.label}</strong>
              <div className={styles.muted}>{item.value}</div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return <p className={styles.widgetNote}>{data.text ?? "—"}</p>;
}

export default function Contour4WidgetHost({
  widgets,
  highlightBlockedRows
}: {
  widgets: Contour4Widget[];
  highlightBlockedRows?: boolean;
}) {
  const visible = [...widgets]
    .filter((w) => w.visible !== false)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  if (!visible.length) {
    return <p className={styles.hitlEmpty}>Нет виджетов для роли</p>;
  }

  return (
    <div className={styles.widgetsSection}>
      <h2 className={styles.sectionTitle}>Рабочие виджеты (MVP)</h2>
      <div className={styles.widgetsGrid}>
        {visible.map((widget) => (
          <article key={widget.id} className={styles.widgetCard}>
            <header className={styles.widgetHead}>
              <span className={styles.kpiId}>{widget.id}</span>
              <h3 className={styles.widgetTitle}>{widget.title}</h3>
            </header>
            <WidgetBody
              widget={widget}
              highlightBlockedRows={highlightBlockedRows}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
