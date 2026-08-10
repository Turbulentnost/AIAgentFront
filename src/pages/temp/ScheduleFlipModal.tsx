/**
 * TEMP(Aveon) — flip-модалка: сменное задание ↔ объединённый график отгрузок.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import TempShiftAssignmentViewer from "./TempShiftAssignmentViewer";
import TempMergedShipmentViewer, { type MergedShipmentStats } from "./TempMergedShipmentViewer";
import type { ShiftAssignmentMeta, ShiftAssignmentPriority, ShiftAssignmentRowKind } from "./shiftAssignmentTypes";
import type { ShiftResultEvalState } from "./shiftAssignmentProgress";
import type { Dispatch, SetStateAction } from "react";
import styles from "./ScheduleFlipModal.module.css";

export type ScheduleFlipFace = "shift" | "shipment";

type ShiftProps = {
  loading: boolean;
  error: string | null;
  values: string[][];
  rowPriorities: Array<ShiftAssignmentPriority | null>;
  rowKinds: ShiftAssignmentRowKind[];
  meta: ShiftAssignmentMeta | null;
  fileName: string;
  resultTexts?: Record<string, string>;
  onResultTextsChange?: Dispatch<SetStateAction<Record<string, string>>>;
  resultEvals?: Record<string, ShiftResultEvalState>;
  onResultEvalsChange?: Dispatch<SetStateAction<Record<string, ShiftResultEvalState>>>;
  onExport: () => void;
  onManagerResultEvaluated?: (
    context: { taskType: string; problem: string; solution: string; nomenclature: string },
    managerResult: string
  ) => Promise<void> | void;
};

type ShipmentProps = {
  loading?: boolean;
  error?: string | null;
  values: string[][];
  fileName: string;
  fileBase64: string;
  stats?: MergedShipmentStats | null;
  sourceCount?: number;
  changedCells?: Array<{ row: number; col: number }>;
  onExport: () => void;
};

type Props = {
  open: boolean;
  face: ScheduleFlipFace;
  onFaceChange?: (face: ScheduleFlipFace) => void;
  onClose: () => void;
  shift: ShiftProps | null;
  shipment: ShipmentProps | null;
};

type ShiftPanelProps = {
  shift: ShiftProps;
  onClose: () => void;
  onFlipToShipment?: () => void;
  onPrefetchShipment?: () => void;
  shipmentAvailable: boolean;
};

type ShipmentPanelProps = {
  shipment: ShipmentProps;
  onClose: () => void;
  onFlipToShift?: () => void;
  onPrefetchShipment?: () => void;
};

const ShiftPanel = memo(function ShiftPanel({
  shift,
  onClose,
  onFlipToShipment,
  onPrefetchShipment,
  shipmentAvailable,
}: ShiftPanelProps) {
  return (
    <TempShiftAssignmentViewer
      embedded
      open
      loading={shift.loading}
      error={shift.error}
      values={shift.values}
      rowPriorities={shift.rowPriorities}
      rowKinds={shift.rowKinds}
      meta={shift.meta}
      fileName={shift.fileName}
      resultTexts={shift.resultTexts}
      onResultTextsChange={shift.onResultTextsChange}
      resultEvals={shift.resultEvals}
      onResultEvalsChange={shift.onResultEvalsChange}
      onExport={shift.onExport}
      onManagerResultEvaluated={shift.onManagerResultEvaluated}
      onClose={onClose}
      onOpenShipmentSchedule={onFlipToShipment}
      onOpenShipmentScheduleHover={onPrefetchShipment}
      shipmentScheduleAvailable={shipmentAvailable}
    />
  );
});

const ShipmentPanel = memo(function ShipmentPanel({
  shipment,
  onClose,
  onFlipToShift,
  onPrefetchShipment,
}: ShipmentPanelProps) {
  return (
    <TempMergedShipmentViewer
      embedded
      open
      loading={shipment.loading}
      error={shipment.error}
      values={shipment.values}
      fileName={shipment.fileName}
      stats={shipment.stats}
      sourceCount={shipment.sourceCount}
      changedCells={shipment.changedCells}
      onExport={shipment.onExport}
      onClose={onClose}
      onBackToShiftAssignment={onFlipToShift}
      onBackToShiftAssignmentHover={onPrefetchShipment}
    />
  );
});

export default function ScheduleFlipModal({
  open,
  face,
  onFaceChange,
  onClose,
  shift,
  shipment,
}: Props) {
  const flipCardRef = useRef<HTMLDivElement>(null);
  const shipmentMountedRef = useRef(false);
  const [shipmentMounted, setShipmentMounted] = useState(false);

  const showShift = Boolean(shift);
  const showShipment = Boolean(shipment);
  const canFlip = showShift && showShipment;

  useEffect(() => {
    if (open) return;
    shipmentMountedRef.current = false;
    setShipmentMounted(false);
    flipCardRef.current?.classList.remove(styles.flipCardFlipped);
  }, [open]);

  const mountShipmentPanel = useCallback(() => {
    if (!showShipment || shipmentMountedRef.current) return;
    shipmentMountedRef.current = true;
    setShipmentMounted(true);
  }, [showShipment]);

  const applyFlip = useCallback((flipped: boolean) => {
    const card = flipCardRef.current;
    if (!card) return;
    card.classList.toggle(styles.flipCardFlipped, flipped);
  }, []);

  useEffect(() => {
    if (!open || !showShipment || shipmentMountedRef.current) return undefined;
    if (face === "shipment") return undefined;

    let cancelled = false;
    const scheduleMount = () => {
      if (!cancelled) mountShipmentPanel();
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(scheduleMount, { timeout: 250 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(scheduleMount, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [face, mountShipmentPanel, open, showShipment]);

  useLayoutEffect(() => {
    if (!open || !showShipment) return;
    if (!shipmentMountedRef.current) {
      shipmentMountedRef.current = true;
      setShipmentMounted(true);
    }
  }, [open, showShipment]);

  useLayoutEffect(() => {
    if (!open || !canFlip) return;
    if (face === "shipment" && !shipmentMounted) return;
    applyFlip(face === "shipment");
  }, [applyFlip, canFlip, face, open, shipmentMounted]);

  const flipToShipment = useCallback(() => {
    onFaceChange?.("shipment");
    if (!shipmentMountedRef.current) {
      shipmentMountedRef.current = true;
      setShipmentMounted(true);
      requestAnimationFrame(() => applyFlip(true));
      return;
    }
    applyFlip(true);
  }, [applyFlip, onFaceChange]);

  const flipToShift = useCallback(() => {
    onFaceChange?.("shift");
    applyFlip(false);
  }, [applyFlip, onFaceChange]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const shiftPanel =
    showShift && shift ? (
      <ShiftPanel
        shift={shift}
        onClose={onClose}
        onFlipToShipment={canFlip ? flipToShipment : undefined}
        onPrefetchShipment={canFlip ? mountShipmentPanel : undefined}
        shipmentAvailable={showShipment}
      />
    ) : null;

  const shipmentPanel =
    showShipment && shipment && shipmentMounted ? (
      <ShipmentPanel
        shipment={shipment}
        onClose={onClose}
        onFlipToShift={canFlip ? flipToShift : undefined}
        onPrefetchShipment={mountShipmentPanel}
      />
    ) : null;

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  let content: ReactNode;

  if (!canFlip) {
    const singlePanel = face === "shipment" ? shipmentPanel ?? shiftPanel : shiftPanel;
    if (!singlePanel) return null;
    content = (
      <div
        className={styles.overlay}
        data-column-menu-portal
        role="presentation"
        onClick={handleOverlayClick}
      >
        {singlePanel}
      </div>
    );
  } else {
    content = (
      <div
        className={styles.overlay}
        data-column-menu-portal
        role="presentation"
        onClick={handleOverlayClick}
      >
        <div className={styles.flipScene}>
          <div ref={flipCardRef} className={styles.flipCard}>
            <div className={styles.flipFaceFront}>{shiftPanel}</div>
            <div className={styles.flipFaceBack}>{shipmentPanel}</div>
          </div>
        </div>
      </div>
    );
  }

  return createPortal(content, document.body);
}
