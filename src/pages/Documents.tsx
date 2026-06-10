import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent
} from "react";
import { useMutation } from "@tanstack/react-query";
import { CloudUpload, Info, Upload, X } from "lucide-react";
import { documentsApi } from "@/api/endpoints";
import { FormSelect } from "@/components/form-controls";
import { collectDroppedSourceFiles } from "@/utils/collectDroppedEntries";
import { createId } from "@/utils/createId";
import type { Document, DocumentProcessingStatus, DocumentType } from "@/types";
import styles from "./Documents.module.css";

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: "other", label: "Прочее" },
  { value: "regulation", label: "Регламент" },
  { value: "tz", label: "ТЗ" },
  { value: "contract", label: "Договор" },
  { value: "specification", label: "Спецификация" }
];

const acceptExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"];
const acceptAttr = acceptExtensions.join(",");

const processingStatusLabels: Record<DocumentProcessingStatus, string> = {
  uploaded: "Загружен",
  text_extraction_pending: "Извлечение текста",
  text_extracted: "Текст извлёчен",
  indexing_pending: "Индексация",
  indexed: "Обработан",
  failed: "Ошибка"
};

interface StagedFile {
  id: string;
  file: File;
  relativePath: string;
}

function getExtension(name: string) {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
}

function isAcceptedFile(file: File) {
  return acceptExtensions.includes(getExtension(file.name));
}

function formatBytes(size: number | null | undefined) {
  if (!size) return "—";
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function defaultTitleFromFile(file: File, customTitle: string) {
  const trimmed = customTitle.trim();
  if (trimmed) return trimmed;
  const name = file.name;
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
}

function documentTypeLabel(type: DocumentType) {
  return documentTypes.find((item) => item.value === type)?.label ?? type;
}

export default function Documents() {
  const formId = useId();
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("other");
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploadingStagedIds, setUploadingStagedIds] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (payload: { file: File; title?: string; document_type: DocumentType }) =>
      documentsApi.upload(payload.file, {
        title: payload.title,
        document_type: payload.document_type
      }),
    onSuccess: (doc) => {
      setUploaded(doc);
      setError(null);
      setFile(null);
      setTitle("");
    },
    onError: () => setError("Не удалось загрузить документ")
  });

  const stageDroppedEntries = useCallback((entries: Array<{ file: File; relativePath: string }>) => {
    setStagedFiles((current) => {
      const existing = new Set(current.map((item) => `${item.relativePath}:${item.file.size}:${item.file.lastModified}`));
      const next = [...current];
      for (const entry of entries) {
        const key = `${entry.relativePath}:${entry.file.size}:${entry.file.lastModified}`;
        if (existing.has(key)) continue;
        existing.add(key);
        next.push({
          id: `${key}-${createId()}`,
          file: entry.file,
          relativePath: entry.relativePath
        });
      }
      return next;
    });
    setError(null);
  }, []);

  const handleDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    if (event.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);

      void (async () => {
        try {
          const dropped = await collectDroppedSourceFiles(event.dataTransfer, isAcceptedFile);
          if (dropped.length) {
            stageDroppedEntries(dropped);
          } else {
            setError("Нет подходящих файлов. Поддерживаются PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT.");
          }
        } catch {
          setError("Не удалось обработать перетаскивание");
        }
      })();
    },
    [stageDroppedEntries]
  );

  useEffect(() => {
    const resetDragState = () => {
      dragDepthRef.current = 0;
      setIsDragOver(false);
    };
    window.addEventListener("dragend", resetDragState);
    return () => window.removeEventListener("dragend", resetDragState);
  }, []);

  const removeStaged = useCallback((id: string) => {
    setStagedFiles((current) => current.filter((item) => item.id !== id));
  }, []);

  const uploadStagedFile = useCallback(
    async (id: string) => {
      const staged = stagedFiles.find((item) => item.id === id);
      if (!staged || uploadingStagedIds.includes(id)) return;

      setUploadingStagedIds((ids) => [...ids, id]);
      setError(null);

      try {
        const doc = await documentsApi.upload(staged.file, {
          title: defaultTitleFromFile(staged.file, title),
          document_type: documentType
        });
        setUploaded(doc);
        setStagedFiles((current) => current.filter((item) => item.id !== id));
      } catch {
        setError("Не удалось загрузить документ");
      } finally {
        setUploadingStagedIds((ids) => ids.filter((item) => item !== id));
      }
    },
    [documentType, stagedFiles, title, uploadingStagedIds]
  );

  const uploadAllStaged = useCallback(async () => {
    for (const staged of stagedFiles) {
      if (!uploadingStagedIds.includes(staged.id)) {
        await uploadStagedFile(staged.id);
      }
    }
  }, [stagedFiles, uploadStagedFile, uploadingStagedIds]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Выберите файл или перетащите его в область загрузки");
      return;
    }
    setError(null);
    uploadMutation.mutate({
      file,
      title: defaultTitleFromFile(file, title),
      document_type: documentType
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Загрузка документов</h1>
        <p>PDF, DOCX, XLSX — хранение исходных файлов в реестре. В базу знаний документ добавляется отдельно после обработки.</p>
      </header>

      <div className={styles.layout}>
        <form id={formId} className={styles.uploadCard} onSubmit={handleSubmit}>
          <div>
            <h2>Новый документ</h2>
            <p className={styles.uploadIntro}>Перетащите файлы или папку в область ниже либо выберите файл вручную.</p>
          </div>

          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneDragOver : ""}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isDragOver ? (
              <div className={styles.dropOverlay} aria-hidden="true">
                <span className={styles.dropOverlayIcon}>
                  <Upload size={28} strokeWidth={2} />
                </span>
                <strong>Отпустите файлы или папку для добавления</strong>
                <span>PDF, DOCX, XLSX, PPTX, TXT — с сохранением вложенных папок</span>
              </div>
            ) : null}
            <div className={styles.dropZoneInner}>
              <span className={styles.dropZoneIcon}>
                <CloudUpload size={24} strokeWidth={2} />
              </span>
              <strong>Перетащите файлы сюда</strong>
              <span>или выберите файл кнопкой ниже</span>
            </div>
          </div>

          <div className={styles.uploadForm}>
            <div className={styles.formGrid}>
              <label className={`${styles.field} ${styles.wideField}`}>
                <span className={styles.fieldLabel}>Название</span>
                <input
                  className={styles.control}
                  placeholder="Необязательно — по умолчанию из имени файла"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Тип документа</span>
                <FormSelect
                  value={documentType}
                  onChange={(value) => setDocumentType(value as DocumentType)}
                  options={documentTypes}
                  ariaLabel="Тип документа"
                />
              </div>
            </div>

            <div className={styles.uploadActions}>
              <label className={styles.fileButton}>
                Выбрать файл
                <input
                  type="file"
                  accept={acceptAttr}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError(null);
                  }}
                />
              </label>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={!file || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Загружаем..." : "Загрузить"}
              </button>
            </div>

            {file ? <p className={styles.selectedFileName}>Выбран файл: {file.name}</p> : null}
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
          </div>

          {stagedFiles.length > 0 ? (
            <section className={styles.stagedSection} aria-label="Файлы для загрузки">
              <div className={styles.stagedHeader}>
                <h3>Добавленные файлы ({stagedFiles.length})</h3>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={uploadAllStaged}
                  disabled={stagedFiles.every((item) => uploadingStagedIds.includes(item.id))}
                >
                  Загрузить все
                </button>
              </div>
              <div className={styles.stagedList}>
                {stagedFiles.map((staged) => {
                  const extKey = getExtension(staged.file.name).replace(".", "") || "file";
                  const uploading = uploadingStagedIds.includes(staged.id);
                  return (
                    <article key={staged.id} className={styles.stagedCard}>
                      <span className={styles.stagedIcon}>{extKey.slice(0, 4)}</span>
                      <div className={styles.stagedCopy}>
                        <strong title={staged.relativePath}>{staged.relativePath}</strong>
                        <small>{formatBytes(staged.file.size)}</small>
                      </div>
                      <button
                        type="button"
                        className={styles.stagedUpload}
                        onClick={() => uploadStagedFile(staged.id)}
                        disabled={uploading}
                        aria-label={`Загрузить ${staged.file.name}`}
                      >
                        {uploading ? "…" : "Загрузить"}
                      </button>
                      <button
                        type="button"
                        className={styles.stagedRemove}
                        onClick={() => removeStaged(staged.id)}
                        disabled={uploading}
                        aria-label={`Удалить ${staged.file.name}`}
                      >
                        <X size={14} />
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className={styles.callout}>
            <Info size={16} strokeWidth={2} aria-hidden="true" />
            <span>После загрузки документ будет обработан. Добавьте его как источник в разделе «База знаний», когда текст будет извлечён.</span>
          </div>
        </form>

        <aside className={styles.summaryCard} aria-live="polite">
          <h2>Последняя загрузка</h2>
          {!uploaded ? (
            <p className={styles.summaryEmpty}>После успешной загрузки здесь появятся метаданные документа.</p>
          ) : (
            <div className={styles.summaryBlock}>
              <div className={styles.summaryRows}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Название</span>
                  <span className={styles.summaryValue}>{uploaded.title}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Файл</span>
                  <span className={styles.summaryValue}>{uploaded.original_filename || "—"}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Тип</span>
                  <span className={styles.summaryValue}>{documentTypeLabel(uploaded.document_type)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Статус</span>
                  <span className={styles.summaryValue}>
                    {processingStatusLabels[uploaded.processing_status] ?? uploaded.processing_status}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Размер</span>
                  <span className={styles.summaryValue}>{formatBytes(uploaded.file_size)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Индексация</span>
                  <span className={styles.summaryValue}>{uploaded.is_indexed ? "Да" : "Нет"}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
