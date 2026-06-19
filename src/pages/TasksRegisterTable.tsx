import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  Building2,
  FileText,
  MessageSquareText,
  PanelLeft,
  PanelLeftClose,
  Timer,
  UserCheck,
  UserRound
} from "lucide-react";
import {
  buildRegisterTableLayout,
  formatOverdueDaysValue,
  formatPersonShortFio,
  getRegisterCellValue,
  getRegisterColumns,
  getTaskStatusVisual,
  type RegisterOverdueKeys,
  type RegisterParticipantKeys,
  type RegisterPostponeKeys,
  type RegisterTableColumn,
  type RegisterTableLayout
} from "@/utils/porucheniyaDashboard";
import type { PorucheniyaTableColumn } from "@/types/porucheniya";
import styles from "./TasksAgent.module.css";

type Props = {
  columns: PorucheniyaTableColumn[];
  rows: Record<string, string | number>[];
  emptyMessage: string;
  extraColumnsExpanded: boolean;
  onToggleExtraColumns: () => void;
};

type ParticipantLine = {
  role: keyof RegisterParticipantKeys;
  label: string;
  Icon: LucideIcon;
};

const PARTICIPANT_LINES: ParticipantLine[] = [
  { role: "executor", label: "Исполнитель", Icon: UserRound },
  { role: "reviewer", label: "Проверяющий", Icon: UserCheck },
  { role: "department", label: "Подразделение", Icon: Building2 }
];

type OverdueLine = {
  field: keyof RegisterOverdueKeys;
  label: string;
  Icon: LucideIcon;
  format?: (value: string) => string;
};

const OVERDUE_LINES: OverdueLine[] = [
  { field: "days", label: "Дней просрочки", Icon: Timer, format: formatOverdueDaysValue },
  { field: "reason", label: "Причина просрочки", Icon: MessageSquareText }
];

type PostponeLine = {
  field: keyof RegisterPostponeKeys;
  label: string;
  Icon: LucideIcon;
};

const POSTPONE_LINES: PostponeLine[] = [
  { field: "request", label: "Запрос переноса", Icon: ArrowRightLeft },
  { field: "basis", label: "Основание переноса", Icon: FileText }
];

export default function TasksRegisterTable({
  columns,
  rows,
  emptyMessage,
  extraColumnsExpanded,
  onToggleExtraColumns
}: Props) {
  const registerColumns = getRegisterColumns(columns);
  const layout = buildRegisterTableLayout(registerColumns);
  const headerColumns = layout.columns.filter(
    (column) => column.type !== "collapsible" || extraColumnsExpanded
  );
  const visibleColumnCount = headerColumns.length;

  return (
    <div className={styles.tableWrap}>
      <table
        className={`${styles.table} ${styles.registerTable}`}
      >
        <thead>
          <tr>
            {layout.columns.map((column) =>
              renderHeaderCell(column, extraColumnsExpanded, onToggleExtraColumns)
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={`${row.document_number ?? "row"}-${index}`}>
                {layout.columns.map((column) =>
                  renderBodyCell(column, row, layout, extraColumnsExpanded)
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td className={styles.emptyCell} colSpan={visibleColumnCount || 1}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function renderHeaderCell(
  column: RegisterTableColumn,
  extraColumnsExpanded: boolean,
  onToggleExtraColumns: () => void
) {
  if (column.type === "collapsible" && !extraColumnsExpanded) {
    return null;
  }

  if (column.type === "toggle") {
    return (
      <th key={column.key} scope="col" className={styles.toggleColumnHead}>
        <button
          type="button"
          className={styles.columnsToggleButton}
          onClick={onToggleExtraColumns}
          aria-expanded={extraColumnsExpanded}
          aria-label={extraColumnsExpanded ? "Скрыть дополнительные колонки" : "Показать дополнительные колонки"}
          title={extraColumnsExpanded ? "Скрыть дополнительные колонки" : "Показать дополнительные колонки"}
        >
          {extraColumnsExpanded ? (
            <PanelLeftClose size={16} strokeWidth={2} aria-hidden="true" />
          ) : (
            <PanelLeft size={16} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </th>
    );
  }

  return (
    <th
      key={column.key}
      scope="col"
      className={getHeaderClassName(column, extraColumnsExpanded) || undefined}
      style={getCollapsibleStyle(column, extraColumnsExpanded)}
    >
      {column.title}
    </th>
  );
}

function renderBodyCell(
  column: RegisterTableColumn,
  row: Record<string, string | number>,
  layout: RegisterTableLayout,
  extraColumnsExpanded: boolean
) {
  if (column.type === "collapsible" && !extraColumnsExpanded) {
    return null;
  }

  if (column.type === "toggle") {
    return <td key={column.key} className={styles.toggleColumnCell} aria-hidden="true" />;
  }

  if (column.type === "participants") {
    return (
      <td key={column.key} className={styles.stackedColumn}>
        <div className={styles.stackedLines}>
          {PARTICIPANT_LINES.map(({ role, label, Icon }) => {
            const sourceKey = layout.participantKeys[role];
            if (!sourceKey) return null;
            const rawValue = getRegisterCellValue(row, sourceKey);
            const value = role === "department" ? rawValue : formatPersonShortFio(rawValue);
            return (
              <div className={styles.stackedLine} key={role} title={`${label}: ${rawValue}`}>
                <span className={styles.stackedIcon} aria-hidden="true">
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span className={styles.stackedText}>{value}</span>
              </div>
            );
          })}
        </div>
      </td>
    );
  }

  if (column.type === "overdue") {
    return (
      <td key={column.key} className={styles.stackedColumn}>
        <div className={styles.stackedLines}>
          {OVERDUE_LINES.map(({ field, label, Icon, format }) => {
            const sourceKey = layout.overdueKeys[field];
            if (!sourceKey) return null;
            const rawValue = getRegisterCellValue(row, sourceKey);
            const value = format ? format(rawValue) : rawValue;
            return (
              <div className={styles.stackedLine} key={field} title={`${label}: ${rawValue}`}>
                <span className={styles.stackedIcon} aria-hidden="true">
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span className={styles.stackedText}>{value}</span>
              </div>
            );
          })}
        </div>
      </td>
    );
  }

  if (column.type === "postpone") {
    return (
      <td key={column.key} className={styles.stackedColumn}>
        <div className={styles.stackedLines}>
          {POSTPONE_LINES.map(({ field, label, Icon }) => {
            const sourceKey = layout.postponeKeys[field];
            if (!sourceKey) return null;
            const rawValue = getRegisterCellValue(row, sourceKey);
            return (
              <div className={styles.stackedLine} key={field} title={`${label}: ${rawValue}`}>
                <span className={styles.stackedIcon} aria-hidden="true">
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span className={styles.stackedText}>{rawValue}</span>
              </div>
            );
          })}
        </div>
      </td>
    );
  }

  if (column.type === "status") {
    const rawValue = getRegisterCellValue(row, column.key);
    if (rawValue === "—") {
      return (
        <td key={column.key} className={styles.statusColumn}>
          {rawValue}
        </td>
      );
    }

    const statusVisual = getTaskStatusVisual(rawValue);
    const StatusIcon = statusVisual.Icon;

    return (
      <td key={column.key} className={styles.statusColumn}>
        <span className={`${styles.statusBadge} ${styles[`statusTone_${statusVisual.tone}`]}`}>
          <StatusIcon size={14} strokeWidth={2.2} aria-hidden="true" />
          <span>{statusVisual.label}</span>
        </span>
      </td>
    );
  }

  return (
    <td
      key={column.key}
      className={getBodyClassName(column, extraColumnsExpanded) || undefined}
      style={getCollapsibleStyle(column, extraColumnsExpanded)}
    >
      {getRegisterCellValue(row, column.key)}
    </td>
  );
}

function getHeaderClassName(column: RegisterTableColumn, extraColumnsExpanded: boolean): string {
  return [
    column.key === "task_text" ? styles.taskColumn : "",
    column.type === "collapsible" ? styles.collapsibleColumnHead : "",
    column.type === "collapsible" && extraColumnsExpanded ? styles.collapsibleColumnHeadVisible : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function getBodyClassName(column: RegisterTableColumn, extraColumnsExpanded: boolean): string {
  return [
    column.key === "task_text" ? styles.taskColumn : "",
    column.type === "collapsible" ? styles.collapsibleColumnCell : "",
    column.type === "collapsible" && extraColumnsExpanded ? styles.collapsibleColumnCellVisible : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function getCollapsibleStyle(
  column: RegisterTableColumn,
  extraColumnsExpanded: boolean
): CSSProperties | undefined {
  if (column.type !== "collapsible" || !extraColumnsExpanded) return undefined;
  return { "--collapse-min-width": `${column.minWidth}px` } as CSSProperties;
}
