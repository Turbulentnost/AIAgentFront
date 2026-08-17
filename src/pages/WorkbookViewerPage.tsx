import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { agentsApi } from "@/api/endpoints";
import { getWorkbookFile } from "@/utils/workbookPreviewStore";
import styles from "./WorkbookViewerPage.module.css";

type SheetPreview = {
  name: string;
  values: string[][];
  row_count: number;
  truncated_rows: boolean;
  truncated_cols: boolean;
};

const ROW_BATCH = 80;

function columnLetter(index: number): string {
  let value = index;
  let label = "";
  while (value >= 0) {
    label = String.fromCharCode((value % 26) + 65) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForStoredFile(id: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const stored = await getWorkbookFile(id);
    if (stored) return stored;
    await sleep(40);
  }
  return null;
}

function downloadStoredFile(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function WorkbookViewerPage() {
  const { previewId = "" } = useParams();
  const [fileName, setFileName] = useState("Книга Excel");
  const [sheets, setSheets] = useState<SheetPreview[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [visibleRows, setVisibleRows] = useState(ROW_BATCH);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!previewId) {
        setError("Не указан файл.");
        setLoading(false);
        return;
      }
      try {
        const stored = await waitForStoredFile(previewId);
        if (!stored) {
          throw new Error("Файл не найден. Откройте его снова из списка загруженных.");
        }
        if (cancelled) return;
        setFileName(stored.fileName);
        setSourceBlob(stored.blob);
        document.title = stored.fileName;
        const file = new File([stored.blob], stored.fileName, { type: stored.mime });
        const preview = await agentsApi.previewWorkbookForTab(file);
        if (cancelled) return;
        setSheets(preview.sheets ?? []);
        setActiveSheet(0);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Не удалось открыть книгу");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [previewId]);

  const sheet = sheets[activeSheet] ?? null;
  const values = sheet?.values ?? [];
  const columnCount = useMemo(
    () => values.reduce((max, row) => Math.max(max, row.length), 0),
    [values]
  );

  useEffect(() => {
    setVisibleRows(ROW_BATCH);
  }, [activeSheet, previewId]);

  useEffect(() => {
    if (visibleRows >= values.length) return undefined;
    const timer = window.setTimeout(() => {
      setVisibleRows((current) => Math.min(current + ROW_BATCH, values.length));
    }, 16);
    return () => window.clearTimeout(timer);
  }, [visibleRows, values.length]);

  const renderedRows = values.slice(0, visibleRows);

  return (
    <div className={styles.page}>
      <header className={styles.ribbon}>
        <div className={styles.ribbonTitle}>
          <span className={styles.appMark}>Excel</span>
          <strong>{fileName}</strong>
        </div>
        <div className={styles.ribbonActions}>
          {sheet ? (
            <span className={styles.meta}>
              {sheet.row_count} строк
              {sheet.truncated_rows || sheet.truncated_cols ? " · показана часть листа" : ""}
            </span>
          ) : null}
          <button
            type="button"
            className={styles.downloadBtn}
            disabled={!sourceBlob}
            onClick={() => {
              if (sourceBlob) downloadStoredFile(fileName, sourceBlob);
            }}
          >
            <Download size={15} strokeWidth={2.1} aria-hidden />
            Скачать
          </button>
        </div>
      </header>

      <div className={styles.formulaBar}>
        <span className={styles.formulaName}>{sheet ? sheet.name : "—"}</span>
        <span className={styles.formulaValue}>
          {loading ? "Загрузка книги…" : error ? error : "Готово"}
        </span>
      </div>

      <div className={styles.gridWrap}>
        {loading ? (
          <div className={styles.state}>
            <Loader2 size={22} className={styles.spin} aria-hidden />
            Открываем книгу…
          </div>
        ) : error ? (
          <div className={styles.state}>{error}</div>
        ) : !sheet || !values.length ? (
          <div className={styles.state}>Лист пуст</div>
        ) : (
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.corner} />
                {Array.from({ length: columnCount }, (_, index) => (
                  <th key={index} className={styles.colHead}>
                    {columnLetter(index)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderedRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th className={styles.rowHead}>{rowIndex + 1}</th>
                  {Array.from({ length: columnCount }, (_, colIndex) => (
                    <td key={colIndex} title={row[colIndex] || undefined}>
                      {row[colIndex] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <nav className={styles.sheetBar} aria-label="Листы книги">
        {sheets.map((item, index) => (
          <button
            key={`${item.name}-${index}`}
            type="button"
            className={`${styles.sheetTab} ${index === activeSheet ? styles.sheetTabActive : ""}`}
            onClick={() => setActiveSheet(index)}
          >
            {item.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
