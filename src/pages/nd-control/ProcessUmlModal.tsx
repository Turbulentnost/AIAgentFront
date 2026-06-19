import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, Download, Loader2, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { ndControlApi } from "@/api/endpoints";
import { sanitizeMermaidCode } from "@/utils/sanitizeMermaid";
import { cleanupMermaidDomArtifacts, renderMermaidSafe } from "@/utils/renderMermaid";
import type { DepartmentProcessItem, ProcessUmlDetailLevel, ProcessUmlSchemaComposition } from "@/types";
import styles from "../NdControlAgent.module.css";

type Props = {
  process: DepartmentProcessItem;
  onClose: () => void;
};

function extractErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (error instanceof Error && error.message) return error.message;
  return "Не удалось построить диаграмму процесса";
}

const DETAIL_LEVEL_OPTIONS: { value: ProcessUmlDetailLevel; label: string }[] = [
  { value: "compact", label: "Кратко" },
  { value: "standard", label: "Стандартно" },
  { value: "detailed", label: "Подробно" }
];

function schemaItems(composition?: ProcessUmlSchemaComposition) {
  if (!composition) return [];
  return [
    { label: "Начало / конец", value: composition.start_end },
    { label: "Операции", value: composition.operations },
    { label: "Условия", value: composition.decisions },
    { label: "Документы", value: composition.documents },
    { label: "Роли", value: composition.roles },
    { label: "Формы", value: composition.forms },
    { label: "Системы", value: composition.systems },
    { label: "Связанные процессы", value: composition.related_processes },
    { label: "Критерии результативности", value: composition.effectiveness_criteria ?? 0 },
    { label: "Ресурсы", value: composition.resources ?? 0 },
    { label: "Риски", value: composition.risks ?? 0 },
    { label: "Архивирование", value: composition.archive_items ?? 0 }
  ].filter((item) => item.value > 0 || ["Начало / конец", "Операции"].includes(item.label));
}

async function svgToPng(svg: string, fileName: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось преобразовать SVG"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = Math.max(image.width, 800) * scale;
    canvas.height = Math.max(image.height, 600) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `${fileName}.png`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ProcessUmlModal({ process, onClose }: Props) {
  const renderId = useId().replace(/:/g, "");
  const viewportRef = useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailLevel, setDetailLevel] = useState<ProcessUmlDetailLevel>("standard");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [displayCode, setDisplayCode] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const umlQuery = useQuery({
    queryKey: ["nd-control", "process-uml", process.process_id, detailLevel, refreshKey],
    queryFn: () =>
      ndControlApi.getProcessUml(process.process_id, {
        force: refreshKey > 0,
        detail_level: detailLevel
      }),
    retry: false
  });

  const umlCode = displayCode ?? (umlQuery.data?.uml_code ? sanitizeMermaidCode(umlQuery.data.uml_code) : null);
  const processTitle = umlQuery.data?.process_name ?? process.name;
  const needsReview = umlQuery.data?.validation_status && umlQuery.data.validation_status !== "valid";
  const compositionItems = schemaItems(umlQuery.data?.schema_composition);

  useEffect(() => {
    cleanupMermaidDomArtifacts();
    return () => {
      cleanupMermaidDomArtifacts();
    };
  }, []);

  useEffect(() => {
    if (!umlQuery.data?.uml_code) {
      setSvgMarkup(null);
      setDisplayCode(null);
      setRenderError(null);
      return;
    }
    let cancelled = false;
    setRenderError(null);
    setDisplayCode(null);

    void renderMermaidSafe(umlQuery.data.uml_code, `uml-${renderId}-${Date.now()}`).then(
      (result) => {
        if (cancelled) return;
        cleanupMermaidDomArtifacts();
        if ("svg" in result) {
          setSvgMarkup(result.svg);
          setDisplayCode(result.code);
          setRenderError(null);
        } else {
          setSvgMarkup(null);
          setDisplayCode(null);
          setRenderError(result.error);
        }
      }
    );

    return () => {
      cancelled = true;
      cleanupMermaidDomArtifacts();
    };
  }, [umlQuery.data?.uml_code, renderId]);

  const handleClose = useCallback(() => {
    cleanupMermaidDomArtifacts();
    onClose();
  }, [onClose]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((value) => Math.min(2.5, Math.max(0.4, Number((value + delta).toFixed(2)))));
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!viewportRef.current) return;
      setIsPanning(true);
      panStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      viewportRef.current.setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isPanning) return;
      setPan({
        x: panStart.current.panX + (event.clientX - panStart.current.x),
        y: panStart.current.panY + (event.clientY - panStart.current.y)
      });
    },
    [isPanning]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    setIsPanning(false);
    viewportRef.current?.releasePointerCapture(event.pointerId);
  }, []);

  const handleCopy = async () => {
    if (!umlCode) return;
    await navigator.clipboard.writeText(umlCode);
    setCopyDone(true);
    window.setTimeout(() => setCopyDone(false), 2000);
  };

  const handleDownload = async () => {
    if (!svgMarkup) return;
    const safeName = processTitle.replace(/[^\wа-яА-ЯёЁ\s-]+/gi, "").trim() || "process-uml";
    await svgToPng(svgMarkup, safeName);
  };

  const handleRegenerate = () => {
    setRefreshKey((value) => value + 1);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const isLoading = umlQuery.isLoading || umlQuery.isFetching;
  const apiError = umlQuery.isError ? extractErrorMessage(umlQuery.error) : null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose} role="dialog" aria-modal="true">
      <div className={styles.umlModalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2>{processTitle}</h2>
            {umlQuery.data?.cached ? <p className={styles.umlModalMeta}>Из кеша</p> : null}
          </div>
          <button type="button" className={styles.iconBtn} onClick={handleClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <p className={styles.umlStoNotice}>
          Диаграмма построена по правилам СТО-34-003 / ГОСТ 19.701-90 на основании карточки процесса и связей.
        </p>

        {umlQuery.data?.source_document_type_label ? (
          <div className={styles.umlDocumentProfile}>
            <div>
              <span>Тип документа:</span> <strong>{umlQuery.data.source_document_type_label}</strong>
            </div>
            {umlQuery.data.qms_level_label ? (
              <div>
                <span>Уровень СМК:</span> <strong>{umlQuery.data.qms_level_label}</strong>
              </div>
            ) : null}
            {umlQuery.data.diagram_profile_label ? (
              <div>
                <span>Профиль диаграммы:</span> <strong>{umlQuery.data.diagram_profile_label}</strong>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.umlDetailLevelBar}>
          <span className={styles.umlDetailLevelLabel}>Уровень детализации:</span>
          <div className={styles.umlDetailLevelOptions} role="radiogroup" aria-label="Уровень детализации">
            {DETAIL_LEVEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={detailLevel === option.value}
                className={
                  detailLevel === option.value
                    ? `${styles.umlDetailLevelBtn} ${styles.umlDetailLevelBtnActive}`
                    : styles.umlDetailLevelBtn
                }
                disabled={isLoading}
                onClick={() => setDetailLevel(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {needsReview ? (
          <div className={styles.umlWarningBanner}>
            Диаграмма требует проверки: найдены несвязанные или спорные блоки.
            {umlQuery.data?.validation_errors?.length ? (
              <div>{umlQuery.data.validation_errors.slice(0, 2).join("; ")}</div>
            ) : null}
          </div>
        ) : null}

        {compositionItems.length ? (
          <div className={styles.umlSchemaComposition}>
            <h3>Состав схемы</h3>
            <div className={styles.umlSchemaGrid}>
              {compositionItems.map((item) => (
                <div key={item.label}>
                  {item.label}: <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className={styles.umlLoadingState}>
            <Loader2 size={36} className={styles.spinIcon} aria-hidden />
            <p>Генерация блок-схемы процесса…</p>
            <small>Анализ карточки, связей и классификация блоков СМК</small>
          </div>
        ) : apiError ? (
          <div className={styles.umlErrorState}>
            <AlertTriangle size={28} />
            <p>Не удалось построить диаграмму процесса</p>
            <small>Причина: {apiError}</small>
          </div>
        ) : renderError ? (
          <div className={styles.umlErrorState}>
            <AlertTriangle size={28} />
            <p>Не удалось отобразить диаграмму</p>
            <small>{renderError}</small>
          </div>
        ) : (
          <>
            <div className={styles.umlToolbar}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setZoom((v) => Math.max(0.4, v - 0.1))}>
                <ZoomOut size={16} /> Уменьшить
              </button>
              <span className={styles.umlZoomLabel}>{Math.round(zoom * 100)}%</span>
              <button type="button" className={styles.secondaryBtn} onClick={() => setZoom((v) => Math.min(2.5, v + 0.1))}>
                <ZoomIn size={16} /> Увеличить
              </button>
            </div>
            <div
              ref={viewportRef}
              className={styles.umlViewport}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <div
                className={styles.umlCanvas}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                dangerouslySetInnerHTML={svgMarkup ? { __html: svgMarkup } : undefined}
              />
            </div>
          </>
        )}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryBtn} disabled={!umlCode} onClick={handleCopy}>
            <Copy size={16} />
            {copyDone ? "Скопировано" : "Скопировать Mermaid"}
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={!svgMarkup} onClick={handleDownload}>
            <Download size={16} />
            Скачать PNG
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={isLoading} onClick={handleRegenerate}>
            <RefreshCw size={16} />
            Сгенерировать заново по СТО
          </button>
          <button type="button" className={styles.primaryBtn} onClick={handleClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
