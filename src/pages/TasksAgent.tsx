import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  formatPorucheniyaIntegrationError,
  getPorucheniyaRequestError,
  isPorucheniyaDashboardForbidden,
  usePorucheniyaDashboard,
  usePorucheniyaPermissions,
  useRefreshPorucheniyaDashboard
} from "@/hooks/usePorucheniyaDashboard";
import { exportTableToExcel } from "@/utils/exportTableToExcel";
import {
  buildRegisterEmptyMessage,
  formatMetricsNote,
  formatPorucheniyaDateTime,
  formatPorucheniyaPeriod,
  getRegisterCellValue,
  getRegisterColumns
} from "@/utils/porucheniyaDashboard";
import type { TasksMetricsRow } from "@/types/porucheniya";
import TasksRegisterTable from "@/pages/TasksRegisterTable";
import styles from "./TasksAgent.module.css";

const summaryColumns = [
  { key: "title", title: "Показатель" },
  { key: "count", title: "Количество" },
  { key: "note", title: "Примечание" }
] as const;

export default function TasksAgent() {
  const permissionsQuery = usePorucheniyaPermissions();
  const canAccessAgent = permissionsQuery.data?.can_access_agent ?? false;
  const dashboardQuery = usePorucheniyaDashboard(canAccessAgent);
  const refreshDashboard = useRefreshPorucheniyaDashboard();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [extraColumnsExpanded, setExtraColumnsExpanded] = useState(false);

  const dashboard = dashboardQuery.data;
  const registerColumns = useMemo(
    () => (dashboard ? getRegisterColumns(dashboard.tasks_table.columns) : []),
    [dashboard]
  );
  const registerRows = dashboard?.tasks_table.rows ?? [];
  const metricsRows = dashboard?.metrics.rows ?? [];

  async function handleRefreshDashboard() {
    if (isRefreshing) return;
    setRefreshError(null);
    setIsRefreshing(true);
    try {
      await refreshDashboard();
    } catch (error) {
      setRefreshError(getPorucheniyaRequestError(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  const isDashboardFetching = dashboardQuery.isFetching || isRefreshing;

  if (permissionsQuery.isLoading) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>Проверяем доступ…</div>
      </section>
    );
  }

  if (!permissionsQuery.data?.can_access_agent) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>Нет доступа к агенту контроля поручений.</div>
      </section>
    );
  }

  if (dashboardQuery.isLoading && !dashboard) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>
          <Loader2 size={18} className={styles.spinner} aria-hidden="true" />
          Загружаем данные из 1С…
        </div>
      </section>
    );
  }

  if (dashboardQuery.isError && isPorucheniyaDashboardForbidden(dashboardQuery.error)) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>Нет доступа к данным по поручениям.</div>
      </section>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>
          {getPorucheniyaRequestError(dashboardQuery.error)}
          <button type="button" className={styles.retryButton} onClick={() => void dashboardQuery.refetch()}>
            Повторить
          </button>
        </div>
      </section>
    );
  }

  if (!dashboard) {
    return (
      <section className={styles.page}>
        <div className={styles.stateMessage}>Нет данных по поручениям.</div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {refreshError ? (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{refreshError}</span>
        </div>
      ) : null}

      {dashboard.error ? (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{formatPorucheniyaIntegrationError(dashboard.error)}</span>
        </div>
      ) : null}

      <header className={styles.pageHead}>
        <div className={styles.pageMeta}>
          <p>
            Период: <strong>{formatPorucheniyaPeriod(dashboard.period_start, dashboard.period_end)}</strong>
          </p>
          <p>
            Руководитель: <strong>{dashboard.author_fio}</strong>
          </p>
          <p className={styles.pageMetaCounts}>
            Поручений: {dashboard.counts.porucheniya_documents} ({dashboard.counts.porucheniya_tasks}{" "}
            мероприятий) · Протоколов: {dashboard.counts.protocol_documents} ({dashboard.counts.protocol_tasks}{" "}
            задач) · Всего задач: {dashboard.counts.total_tasks}
          </p>
          {dashboard.fetched_at ? (
            <p className={styles.pageMetaMuted}>
              Обновлено: {formatPorucheniyaDateTime(dashboard.fetched_at)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={`${styles.refreshButton} ${isDashboardFetching ? styles.refreshButtonSpinning : ""}`}
          onClick={() => void handleRefreshDashboard()}
          disabled={isDashboardFetching}
          aria-label="Обновить данные"
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </header>

      <section className={styles.section} aria-label="Реестр ежедневного контроля">
        <TasksRegisterTable
          columns={dashboard.tasks_table.columns}
          rows={registerRows}
          emptyMessage={buildRegisterEmptyMessage(dashboard)}
          extraColumnsExpanded={extraColumnsExpanded}
          onToggleExtraColumns={() => setExtraColumnsExpanded((value) => !value)}
        />

        <button
          type="button"
          className={styles.exportButton}
          onClick={() => exportRegisterTable(registerColumns, registerRows)}
          disabled={!registerRows.length}
        >
          Экспортировать в Excel
        </button>
      </section>

      <section className={styles.section} aria-label="Ежедневная сводка">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {summaryColumns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricsRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.title}</td>
                  <td>{row.count}</td>
                  <td>{formatMetricsNote(row.note)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className={styles.exportButton}
          onClick={() => exportSummaryTable(metricsRows)}
        >
          Экспортировать в Excel
        </button>
      </section>
    </section>
  );
}

function exportSummaryTable(rows: TasksMetricsRow[]) {
  exportTableToExcel(
    "ejednevnaya-svodka.csv",
    [...summaryColumns],
    rows.map((row) => ({
      title: row.title,
      count: row.count,
      note: formatMetricsNote(row.note)
    }))
  );
}

function exportRegisterTable(
  columns: { key: string; title: string }[],
  rows: Record<string, string | number>[]
) {
  exportTableToExcel(
    "reestr-ezhednevnogo-kontrolya.csv",
    columns,
    rows.map((row) => {
      const exportRow: Record<string, unknown> = {};
      for (const column of columns) {
        exportRow[column.key] = getRegisterCellValue(row, column.key);
      }
      return exportRow;
    })
  );
}
