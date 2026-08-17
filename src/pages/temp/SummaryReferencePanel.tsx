import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  CalendarRange,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Package,
  Settings2,
  Truck,
} from "lucide-react";
import type { ReferenceCacheState } from "./useAveonReferenceCache";
import TempGoogleSheetsViewer from "./TempGoogleSheetsViewer";
import TempProductionPlanModal from "./TempProductionPlanModal";
import TempResourceSpecsModal from "./TempResourceSpecsModal";
import TempRussiaShipmentModal from "./TempRussiaShipmentModal";
import TempStockBalancesModal from "./TempStockBalancesModal";
import TempYearProductionScheduleModal from "./TempYearProductionScheduleModal";
import styles from "./SummaryReferencePanel.module.css";

export type ReferenceModal =
  | "yearProductionSchedule"
  | "productionPlan"
  | "chinaSheets"
  | "russiaShipment"
  | "resourceSpecs"
  | "stockBalances"
  | null;

type Props = {
  cache: ReferenceCacheState;
  children: ReactNode;
  activeModal?: ReferenceModal;
  onActiveModalChange?: (modal: ReferenceModal) => void;
  backFooter?: ReactNode;
};

type MenuItem = {
  id: Exclude<ReferenceModal, null>;
  label: string;
  hint: string;
  icon: typeof Package;
};

const PRIMARY_MENU_ITEMS: MenuItem[] = [
  {
    id: "russiaShipment",
    label: "График комплектующих · Россия",
    hint: "Актуальная версия Excel в БД",
    icon: Truck,
  },
  {
    id: "chinaSheets",
    label: "График комплектующих · Китай",
    hint: "Лист «ИТЦ В РАБОТЕ» · Google Sheets",
    icon: FileSpreadsheet,
  },
  {
    id: "productionPlan",
    label: "План производства на месяц",
    hint: "Дневная/месячная матрица · выгрузка 1С",
    icon: ClipboardList,
  },
  {
    id: "resourceSpecs",
    label: "Спецификации",
    hint: "Материалы по выбранной спеке · 1С → БД",
    icon: Boxes,
  },
  {
    id: "stockBalances",
    label: "Остатки на складах",
    hint: "Остатки по материалам · 1С → БД",
    icon: Package,
  },
];

const EXTRA_MENU_ITEMS: MenuItem[] = [
  {
    id: "yearProductionSchedule",
    label: "График производства на год",
    hint: "Изделия × месяцы · база данных",
    icon: CalendarRange,
  },
];

function MenuSection({
  title,
  items,
  loading,
  onOpen,
}: {
  title: string;
  items: MenuItem[];
  loading: boolean;
  onOpen: (id: Exclude<ReferenceModal, null>) => void;
}) {
  return (
    <section className={styles.menuSection}>
      <p className={styles.menuSectionTitle}>{title}</p>
      <div className={styles.menuList} role="list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={styles.menuBtn}
              role="listitem"
              disabled={loading}
              onClick={() => onOpen(item.id)}
            >
              <span className={styles.menuBtnIcon} aria-hidden>
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className={styles.menuBtnText}>
                <span className={styles.menuBtnLabel}>{item.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function SummaryReferencePanel({
  cache,
  children,
  activeModal: controlledModal,
  onActiveModalChange,
  backFooter,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const [internalModal, setInternalModal] = useState<ReferenceModal>(null);
  const activeModal = controlledModal !== undefined ? controlledModal : internalModal;

  function setActiveModal(id: ReferenceModal) {
    if (onActiveModalChange) {
      onActiveModalChange(id);
    } else {
      setInternalModal(id);
    }
  }

  function openModal(id: Exclude<ReferenceModal, null>) {
    setActiveModal(id);
  }

  function closeModal() {
    setActiveModal(null);
  }

  useEffect(() => {
    if (activeModal) {
      setFlipped(true);
    }
  }, [activeModal]);

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Сводка</h2>
          <button
            type="button"
            className={`${styles.gearBtn} ${flipped ? styles.gearBtnActive : ""}`}
            aria-expanded={flipped}
            aria-label={flipped ? "Вернуться к сводке" : "Сводка файлов"}
            title={flipped ? "Назад к сводке" : "Сводка файлов"}
            onClick={() => setFlipped((value) => !value)}
          >
            <Settings2 size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.flipScene}>
          <div className={`${styles.flipCard} ${flipped ? styles.flipCardFlipped : ""}`}>
            <div className={`${styles.flipFace} ${styles.flipFaceFront}`} aria-hidden={flipped}>
              {children}
            </div>

            <div className={`${styles.flipFace} ${styles.flipFaceBack}`} aria-hidden={!flipped}>
              <div className={styles.backPanel}>
                <div className={styles.backHeader}>
                  {cache.loading ? (
                    <p className={styles.backStatus}>
                      <Loader2 className={styles.backSpinner} size={14} aria-hidden />
                      Обновление данных…
                    </p>
                  ) : cache.errors.length ? (
                    <p className={styles.backStatusWarn}>
                      Часть данных недоступна: {cache.errors.join(", ")}
                    </p>
                  ) : null}
                </div>

                <MenuSection
                  title="Основные файлы"
                  items={PRIMARY_MENU_ITEMS}
                  loading={cache.loading}
                  onOpen={openModal}
                />

                <MenuSection
                  title="Дополнительные файлы"
                  items={EXTRA_MENU_ITEMS}
                  loading={cache.loading}
                  onOpen={openModal}
                />

                {backFooter}

                <button
                  type="button"
                  className={styles.backLink}
                  onClick={() => setFlipped(false)}
                >
                  <ArrowLeft size={16} aria-hidden />
                  Назад к сводке
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TempYearProductionScheduleModal
        open={activeModal === "yearProductionSchedule"}
        loading={cache.loading}
        data={cache.productionPlan}
        onClose={closeModal}
      />

      <TempProductionPlanModal
        open={activeModal === "productionPlan"}
        loading={cache.loading}
        data={cache.productionPlan}
        onClose={closeModal}
      />

      <TempGoogleSheetsViewer
        open={activeModal === "chinaSheets"}
        loading={cache.loading}
        error={cache.googleSheets?.error ?? null}
        sheetTitle={cache.googleSheets?.sheetTitle ?? "ИТЦ В РАБОТЕ"}
        spreadsheetTitle={cache.googleSheets?.spreadsheetTitle}
        values={cache.googleSheets?.values ?? []}
        onClose={closeModal}
      />

      <TempRussiaShipmentModal
        open={activeModal === "russiaShipment"}
        loading={cache.loading}
        data={cache.russiaShipment}
        onClose={closeModal}
      />

      <TempResourceSpecsModal
        open={activeModal === "resourceSpecs"}
        loading={cache.loading}
        data={cache.resourceSpecs}
        onClose={closeModal}
      />

      <TempStockBalancesModal
        open={activeModal === "stockBalances"}
        loading={cache.loading}
        data={cache.stockBalances}
        onClose={closeModal}
      />
    </>
  );
}
