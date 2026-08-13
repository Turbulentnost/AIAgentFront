import { type ReactNode, useState } from "react";
import {
  ArrowLeft,
  Boxes,
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
import styles from "./SummaryReferencePanel.module.css";

type ReferenceModal =
  | "productionPlan"
  | "chinaSheets"
  | "russiaShipment"
  | "resourceSpecs"
  | "stockBalances"
  | null;

type Props = {
  cache: ReferenceCacheState;
  children: ReactNode;
};

type MenuItem = {
  id: ReferenceModal;
  label: string;
  hint: string;
  icon: typeof Package;
};

const MENU_ITEMS: MenuItem[] = [
  {
    id: "productionPlan",
    label: "План производства на месяц",
    hint: "Изделия × даты · БД 1С",
    icon: ClipboardList,
  },
  {
    id: "chinaSheets",
    label: "График комплектующих · Китай",
    hint: "Лист «ИТЦ В РАБОТЕ» · Google Sheets",
    icon: FileSpreadsheet,
  },
  {
    id: "russiaShipment",
    label: "График комплектующих · Россия",
    hint: "Актуальная версия из БД",
    icon: Truck,
  },
  {
    id: "resourceSpecs",
    label: "Спецификации",
    hint: "Материалы по выбранной спеке",
    icon: Boxes,
  },
  {
    id: "stockBalances",
    label: "Остатки на складах",
    hint: "Таблица остатков из БД 1С",
    icon: Package,
  },
];

export default function SummaryReferencePanel({ cache, children }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [activeModal, setActiveModal] = useState<ReferenceModal>(null);

  function openModal(id: ReferenceModal) {
    setActiveModal(id);
  }

  function closeModal() {
    setActiveModal(null);
  }

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Сводка</h2>
          <button
            type="button"
            className={`${styles.gearBtn} ${flipped ? styles.gearBtnActive : ""}`}
            aria-expanded={flipped}
            aria-label={flipped ? "Вернуться к сводке" : "Справочники и данные из БД"}
            title={flipped ? "Назад к сводке" : "Справочники из БД"}
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
                  <p className={styles.backTitle}>Справочники</p>
                  <p className={styles.backHint}>
                    Данные загружены один раз при открытии агента. Модалки открываются без повторной
                    загрузки.
                  </p>
                  {cache.loading ? (
                    <p className={styles.backStatus}>
                      <Loader2 className={styles.backSpinner} size={14} aria-hidden />
                      Обновление справочников…
                    </p>
                  ) : cache.errors.length ? (
                    <p className={styles.backStatusWarn}>
                      Часть данных недоступна: {cache.errors.join(", ")}
                    </p>
                  ) : cache.loaded ? (
                    <p className={styles.backStatusOk}>Справочники готовы</p>
                  ) : null}
                </div>

                <div className={styles.menuList} role="list">
                  {MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={styles.menuBtn}
                        role="listitem"
                        disabled={cache.loading}
                        onClick={() => openModal(item.id)}
                      >
                        <span className={styles.menuBtnIcon} aria-hidden>
                          <Icon size={18} strokeWidth={2} />
                        </span>
                        <span className={styles.menuBtnText}>
                          <span className={styles.menuBtnLabel}>{item.label}</span>
                          <span className={styles.menuBtnHint}>{item.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

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
