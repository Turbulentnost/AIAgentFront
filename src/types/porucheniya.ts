export interface PorucheniyaPermissions {
  can_access_agent: boolean;
}

export interface PorucheniyaDashboardParams {
  period_start?: string;
  period_end?: string;
  limit?: number;
}

export interface PorucheniyaDashboardRefreshPayload {
  period_start?: string;
  period_end?: string;
  limit?: number;
}

export interface PorucheniyaTableColumn {
  key: string;
  title: string;
}

export interface PorucheniyaTasksTable {
  columns: PorucheniyaTableColumn[];
  rows: Record<string, string | number>[];
  row_count: number;
}

export interface PorucheniyaDashboardCounts {
  porucheniya_documents: number;
  porucheniya_tasks: number;
  protocol_documents: number;
  protocol_tasks: number;
  total_tasks: number;
}

export interface TasksMetricsRow {
  key: string;
  title: string;
  count: number;
  note: string | null;
}

export interface TasksMetrics {
  report_day: string;
  rows: TasksMetricsRow[];
}

export interface TasksDashboardRead {
  author_fio: string;
  manager_fio_source: string;
  period_start: string;
  period_end: string;
  counts: PorucheniyaDashboardCounts;
  priority_summary: Record<string, number>;
  metrics: TasksMetrics;
  tasks_table: PorucheniyaTasksTable;
  summary: string;
  fetched_at: string;
  error: string | null;
}
