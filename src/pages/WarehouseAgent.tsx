import { useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  Clock3,
  Factory,
  FileText,
  LayoutGrid,
  Loader2,
  MapPin,
  Package,
  PackageSearch,
  QrCode,
  Receipt,
  RefreshCw,
  Scale,
  ScrollText,
  Settings,
  Tag,
  Tags,
  Truck,
  Warehouse
} from "lucide-react";
import {
  mockWarehouseAgent,
  warehouseAgentCardSubtitle,
  warehouseAgentSubtitle,
  warehouseDecisions,
  warehouseLastUpdated,
  warehouseNavItems,
  warehouseOperations,
  warehouseOperationStatusLabels,
  warehousePriorityLabels,
  warehouseQuickActions,
  warehouseStats,
  type WarehouseIconKey,
  type WarehouseNavId,
  type WarehouseOperationStatus,
  type WarehousePriority,
  type WarehouseTone
} from "@/mock-data/warehouseAgent";
import styles from "./WarehouseAgent.module.css";

const warehouseIcons: Record<WarehouseIconKey, LucideIcon> = {
  overview: LayoutGrid,
  incoming: PackageSearch,
  stock: Boxes,
  picking: ClipboardList,
  issue: Factory,
  deficit: AlertTriangle,
  deadstock: Archive,
  transfer: ArrowRightLeft,
  reports: BarChart3,
  settings: Settings,
  journal: ScrollText,
  truck: Truck,
  clipboard: ClipboardList,
  package: Package,
  alert: AlertTriangle,
  tag: Tag,
  receipt: Receipt,
  warehouse: Warehouse,
  demand: PackageSearch,
  "issue-doc": FileText,
  "stock-item": Boxes,
  scale: Scale,
  clock: Clock3,
  archive: Archive,
  qr: QrCode,
  boxes: Boxes,
  file: FileText,
  labels: Tags,
  "map-pin": MapPin,
  chart: BarChart3,
  "truck-out": Truck
};

const operationStatusTone: Record<WarehouseOperationStatus, WarehouseTone> = {
  awaiting_acceptance: "blue",
  picking: "violet",
  partial_picking: "amber",
  below_min: "red"
};

const priorityTone: Record<WarehousePriority, WarehouseTone> = {
  high: "red",
  medium: "amber",
  low: "blue"
};

function WarehouseIcon({
  icon,
  size = 16,
  strokeWidth = 2
}: {
  icon: WarehouseIconKey;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = warehouseIcons[icon];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export default function WarehouseAgent() {
  const [activeNav, setActiveNav] = useState<WarehouseNavId>("overview");
  const [lastUpdated, setLastUpdated] = useState(warehouseLastUpdated);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(now);
    setLastUpdated(formatted.replace(",", ""));
    setIsRefreshing(false);
  }

  return (
    <section className={styles.page}>
      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Навигация агента склада">
          <Link className={styles.backLink} to="/agents">
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
            <span>К списку агентов</span>
          </Link>

          <div className={styles.agentCard}>
            <span className={`${styles.agentCardIcon} ${styles.toneBlue}`} aria-hidden="true">
              <Truck size={18} strokeWidth={2} />
            </span>
            <div className={styles.agentCardBody}>
              <strong>{mockWarehouseAgent.name}</strong>
              <p>{warehouseAgentCardSubtitle}</p>
              <span className={styles.agentStatus}>
                <span className={styles.agentStatusDot} aria-hidden="true" />
                Активен
              </span>
            </div>
          </div>

          <nav className={styles.navList} aria-label="Разделы агента">
            {warehouseNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ""}`}
                aria-current={activeNav === item.id ? "page" : undefined}
                onClick={() => setActiveNav(item.id)}
              >
                <span className={styles.navItemIcon} aria-hidden="true">
                  <WarehouseIcon icon={item.icon} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <button type="button" className={styles.journalButton}>
            <span className={styles.journalButtonIcon} aria-hidden="true">
              <WarehouseIcon icon="journal" />
            </span>
            <span>Журнал операций</span>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </aside>

        <div className={styles.main}>
          <header className={styles.pageHeader}>
            <h1>{mockWarehouseAgent.name}</h1>
            <p>{warehouseAgentSubtitle}</p>
          </header>

          <div className={styles.statsRow}>
            {warehouseStats.map((stat) => (
              <article key={stat.id} className={styles.statCard}>
                <span className={`${styles.statIcon} ${styles[`tone_${stat.tone}`]}`} aria-hidden="true">
                  <WarehouseIcon icon={stat.icon} size={18} strokeWidth={2} />
                </span>
                <div className={styles.statBody}>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <strong className={`${styles.statValue} ${styles[`value_${stat.tone}`]}`}>
                    {stat.value}
                  </strong>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.middleGrid}>
            <section className={styles.panel} aria-labelledby="warehouse-operations-title">
              <div className={styles.panelHead}>
                <h2 id="warehouse-operations-title">Очередь складских операций</h2>
                <button type="button" className={styles.panelLink}>
                  Все операции
                  <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Объект</th>
                      <th scope="col">Источник</th>
                      <th scope="col">Статус</th>
                      <th scope="col">Срок</th>
                      <th scope="col">Ответственный</th>
                      <th scope="col">Следующее действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseOperations.map((row) => (
                      <tr key={row.id} className={styles.tableRowInteractive}>
                        <td>
                          <div className={styles.objectCell}>
                            <span className={styles.objectIcon} aria-hidden="true">
                              <WarehouseIcon icon={row.objectIcon} size={14} />
                            </span>
                            <span>{row.objectTitle}</span>
                          </div>
                        </td>
                        <td>{row.source}</td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${styles[`badge_${operationStatusTone[row.status]}`]}`}
                          >
                            {warehouseOperationStatusLabels[row.status]}
                          </span>
                        </td>
                        <td>{row.deadline}</td>
                        <td>{row.responsible}</td>
                        <td>{row.nextAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="warehouse-decisions-title">
              <div className={styles.panelHead}>
                <h2 id="warehouse-decisions-title">Требуют решения</h2>
                <button type="button" className={styles.panelLink}>
                  Все задачи
                  <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.decisionList}>
                {warehouseDecisions.map((item) => (
                  <button key={item.id} type="button" className={styles.decisionItem}>
                    <span className={`${styles.decisionIcon} ${styles[`tone_${item.tone}`]}`} aria-hidden="true">
                      <WarehouseIcon icon={item.icon} size={16} />
                    </span>
                    <span className={styles.decisionBody}>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                      <span className={styles.decisionTime}>{item.time}</span>
                    </span>
                    <span className={`${styles.priorityBadge} ${styles[`badge_${priorityTone[item.priority]}`]}`}>
                      {warehousePriorityLabels[item.priority]}
                    </span>
                  </button>
                ))}
              </div>

              <button type="button" className={styles.showAllLink}>
                Показать все (18)
                <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </section>
          </div>

          <section className={styles.quickActionsSection} aria-labelledby="warehouse-quick-actions-title">
            <h2 id="warehouse-quick-actions-title">Быстрые действия</h2>
            <div className={styles.quickActionsGrid}>
              {warehouseQuickActions.map((action) => (
                <button key={action.id} type="button" className={styles.quickActionCard}>
                  <span className={`${styles.quickActionIcon} ${styles[`tone_${action.tone}`]}`} aria-hidden="true">
                    <WarehouseIcon icon={action.icon} size={18} />
                  </span>
                  <span className={styles.quickActionBody}>
                    <strong>{action.title}</strong>
                    <span>{action.description}</span>
                  </span>
                  <ChevronRight size={16} strokeWidth={2} className={styles.quickActionChevron} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <footer className={styles.footer}>
            <span>Данные обновлены {lastUpdated}</span>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 size={14} strokeWidth={2.2} className={styles.spinner} aria-hidden="true" />
              ) : (
                <RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />
              )}
              Обновить
            </button>
          </footer>
        </div>
      </div>
    </section>
  );
}
