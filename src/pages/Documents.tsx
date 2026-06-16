import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CloudUpload, Download, ExternalLink, Info, Lock, Search, Upload, X } from "lucide-react";
import { departmentsApi, documentsApi } from "@/api/endpoints";
import { FormSelect } from "@/components/form-controls";
import { collectDroppedSourceFiles } from "@/utils/collectDroppedEntries";
import { createId } from "@/utils/createId";
import type {
  Department,
  Document,
  DocumentListItem,
  DocumentProcessingStatus,
  DocumentType
} from "@/types";
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
const previewExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
const REGISTRY_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

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

function isPreviewableDocument(document: Pick<DocumentListItem, "original_filename">) {
  return previewExtensions.includes(getExtension(document.original_filename ?? ""));
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

async function openBlobUrlInNewTab(url: string) {
  const link = window.document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadDocumentFile(document: DocumentListItem) {
  const blob = await documentsApi.file(document.id, "attachment");
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.original_filename || `${document.title}.bin`;
  link.click();
  URL.revokeObjectURL(url);
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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function departmentName(departments: Department[], departmentId: string | null | undefined) {
  if (!departmentId) return "—";
  return departments.find((item) => item.id === departmentId)?.name ?? departmentId.slice(0, 8);
}

function documentAccessLabel(document: DocumentListItem) {
  if (!document.can_access) return "Нет доступа";
  const metadata = document.metadata;
  const access =
    metadata && typeof metadata === "object" && "access_scope" in metadata
      ? String(metadata.access_scope)
      : metadata && typeof metadata === "object" && "access" in metadata
        ? String(metadata.access)
        : null;
  if (access) return access;
  return document.department_id ? "Подразделение" : "Общий";
}

export default function Documents() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [registrySearch, setRegistrySearch] = useState("");
  const [debouncedRegistrySearch, setDebouncedRegistrySearch] = useState("");
  const [registryPage, setRegistryPage] = useState(1);
  const [selectedDocumentSnapshot, setSelectedDocumentSnapshot] = useState<DocumentListItem | null>(null);
  const [fileActionError, setFileActionError] = useState<string | null>(null);
  const [fileActionPending, setFileActionPending] = useState<"open" | "download" | null>(null);
  const [documentPreview, setDocumentPreview] = useState<{
    url: string;
    title: string;
    filename: string;
    isPdf: boolean;
  } | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(searchParams.get("document"));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedRegistrySearch(registrySearch.trim());
      setRegistryPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [registrySearch]);

  const documentsQuery = useQuery({
    queryKey: ["documents", registryPage, debouncedRegistrySearch],
    queryFn: () =>
      documentsApi.list({
        page: registryPage,
        size: REGISTRY_PAGE_SIZE,
        query: debouncedRegistrySearch || undefined
      }),
    placeholderData: (previous) => previous
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list
  });

  const departments = departmentsQuery.data ?? [];
  const registryDocuments = documentsQuery.data?.items ?? [];
  const registryTotal = documentsQuery.data?.total ?? 0;
  const registryTotalPages = Math.max(1, Math.ceil(registryTotal / REGISTRY_PAGE_SIZE));
  const registryPageNumbers = useMemo(
    () => buildPageNumbers(registryPage, registryTotalPages),
    [registryPage, registryTotalPages]
  );
  const registryRangeStart = registryTotal ? (registryPage - 1) * REGISTRY_PAGE_SIZE + 1 : 0;
  const registryRangeEnd = registryTotal ? Math.min(registryPage * REGISTRY_PAGE_SIZE, registryTotal) : 0;

  const selectedDocument = useMemo(() => {
    const fromPage = registryDocuments.find((item) => item.id === selectedDocumentId);
    if (fromPage) return fromPage;
    if (selectedDocumentSnapshot?.id === selectedDocumentId) return selectedDocumentSnapshot;
    return null;
  }, [registryDocuments, selectedDocumentId, selectedDocumentSnapshot]);

  useEffect(() => {
    const requestedId = searchParams.get("document");
    if (requestedId) setSelectedDocumentId(requestedId);
  }, [searchParams]);

  const closeDocumentPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setDocumentPreview(null);
  }, []);

  useEffect(() => () => closeDocumentPreview(), [closeDocumentPreview]);

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
      setSelectedDocumentId(doc.id);
      setSelectedDocumentSnapshot({ ...doc, can_access: true });
      setRegistryPage(1);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("document", doc.id);
          return next;
        },
        { replace: true }
      );
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
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
        void queryClient.invalidateQueries({ queryKey: ["documents"] });
      } catch {
        setError("Не удалось загрузить документ");
      } finally {
        setUploadingStagedIds((ids) => ids.filter((item) => item !== id));
      }
    },
    [documentType, queryClient, stagedFiles, title, uploadingStagedIds]
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

  function selectDocument(document: DocumentListItem) {
    setSelectedDocumentId(document.id);
    setSelectedDocumentSnapshot(document);
    setFileActionError(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("document", document.id);
        return next;
      },
      { replace: true }
    );
  }

  function handleOpenDocument(document: DocumentListItem) {
    if (!document.can_access) return;

    setFileActionPending("open");
    setFileActionError(null);
    void (async () => {
      try {
        const blob = await documentsApi.file(document.id, "inline");
        closeDocumentPreview();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;

        const extension = getExtension(document.original_filename ?? "");
        const filename = document.original_filename || `${document.title}.bin`;
        const isPdf = extension === ".pdf";

        if (isPdf) {
          setDocumentPreview({
            url,
            title: document.title,
            filename,
            isPdf: true
          });
          return;
        }

        openBlobUrlInNewTab(url);
        window.setTimeout(() => {
          if (previewUrlRef.current === url) {
            URL.revokeObjectURL(url);
            previewUrlRef.current = null;
          }
        }, 120_000);
      } catch {
        setFileActionError("Не удалось открыть файл. Попробуйте скачать документ.");
      } finally {
        setFileActionPending(null);
      }
    })();
  }

  function handleOpenPreviewInNewTab() {
    if (!documentPreview) return;
    openBlobUrlInNewTab(documentPreview.url);
  }

  async function handleDownloadDocument(document: DocumentListItem) {
    if (!document.can_access) return;
    setFileActionPending("download");
    setFileActionError(null);
    try {
      await downloadDocumentFile(document);
    } catch {
      setFileActionError("Не удалось скачать файл.");
    } finally {
      setFileActionPending(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Документы</h1>
        <p>
          Реестр всех загруженных файлов системы. Содержимое доступно для чтения только по вашему подразделению,
          загруженным вами документам или общим документам.
        </p>
      </header>

      <section className={styles.registryPanel}>
        <div className={styles.registryToolbar}>
          <label className={styles.registrySearch}>
            <Search size={15} />
            <input
              value={registrySearch}
              onChange={(event) => setRegistrySearch(event.target.value)}
              placeholder="Поиск по названию или файлу"
            />
          </label>
          <span className={styles.registryCount}>
            {registryTotal
              ? `${registryRangeStart}–${registryRangeEnd} из ${registryTotal}`
              : documentsQuery.isLoading
                ? "Загрузка..."
                : "0 документов"}
          </span>
        </div>

        <div className={styles.registryWorkspace}>
          <div className={styles.registryListColumn}>
            <div className={styles.registryTableWrap}>
              <table className={styles.registryTable}>
                <thead>
                  <tr>
                    <th>Документ</th>
                    <th>Тип</th>
                    <th>Статус</th>
                    <th>Подразделение</th>
                    <th>Доступ</th>
                    <th>Обновлено</th>
                  </tr>
                </thead>
                <tbody>
                  {registryDocuments.map((document) => {
                    const isSelected = selectedDocumentId === document.id;
                    const isDisabled = !document.can_access;
                    return (
                      <tr
                        key={document.id}
                        className={[
                          isSelected ? styles.registryRowSelected : "",
                          isDisabled ? styles.registryRowLocked : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => selectDocument(document)}
                        title={isDisabled ? "Документ виден в реестре, но содержимое недоступно для чтения" : undefined}
                      >
                        <td>
                          <strong>{document.title}</strong>
                          <small>{document.original_filename || "—"}</small>
                        </td>
                        <td>{documentTypeLabel(document.document_type)}</td>
                        <td>{processingStatusLabels[document.processing_status] ?? document.processing_status}</td>
                        <td>{departmentName(departments, document.department_id)}</td>
                        <td>
                          {isDisabled ? (
                            <span className={styles.accessLocked}>
                              <Lock size={13} />
                              {documentAccessLabel(document)}
                            </span>
                          ) : (
                            documentAccessLabel(document)
                          )}
                        </td>
                        <td>{formatDate(document.updated_at)}</td>
                      </tr>
                    );
                  })}
                  {!registryDocuments.length && (
                    <tr>
                      <td colSpan={6} className={styles.registryEmpty}>
                        {documentsQuery.isLoading ? "Загружаем реестр..." : "Документы не найдены."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {registryTotalPages > 1 ? (
              <nav className={styles.registryPagination} aria-label="Страницы реестра документов">
                <button
                  type="button"
                  className={styles.paginationButton}
                  disabled={registryPage <= 1 || documentsQuery.isFetching}
                  onClick={() => setRegistryPage((current) => Math.max(1, current - 1))}
                >
                  Назад
                </button>
                <div className={styles.paginationPages}>
                  {registryPageNumbers.map((pageNumber, index) => {
                    const previous = registryPageNumbers[index - 1];
                    const needsGap = previous !== undefined && pageNumber - previous > 1;
                    return (
                      <span key={pageNumber} className={styles.paginationPageGroup}>
                        {needsGap ? <span className={styles.paginationGap}>…</span> : null}
                        <button
                          type="button"
                          className={`${styles.paginationButton} ${pageNumber === registryPage ? styles.paginationButtonActive : ""}`.trim()}
                          disabled={documentsQuery.isFetching}
                          onClick={() => setRegistryPage(pageNumber)}
                          aria-current={pageNumber === registryPage ? "page" : undefined}
                        >
                          {pageNumber}
                        </button>
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={styles.paginationButton}
                  disabled={registryPage >= registryTotalPages || documentsQuery.isFetching}
                  onClick={() => setRegistryPage((current) => Math.min(registryTotalPages, current + 1))}
                >
                  Вперёд
                </button>
              </nav>
            ) : null}
          </div>

          <aside className={styles.registryDetail}>
            {!selectedDocument ? (
              <p className={styles.registryDetailEmpty}>Выберите документ в таблице, чтобы посмотреть сведения.</p>
            ) : !selectedDocument.can_access ? (
              <div className={styles.registryDetailLocked}>
                <Lock size={18} />
                <strong>{selectedDocument.title}</strong>
                <p>Документ отображается в общем реестре, но у вас нет прав на чтение его содержимого.</p>
                <small>Подразделение: {departmentName(departments, selectedDocument.department_id)}</small>
              </div>
            ) : (
              <div className={styles.registryDetailBody}>
                <h2>{selectedDocument.title}</h2>
                <div className={styles.registryDetailActions}>
                  {isPreviewableDocument(selectedDocument) ? (
                    <button
                      type="button"
                      className={styles.detailActionButton}
                      disabled={fileActionPending !== null}
                      onClick={() => handleOpenDocument(selectedDocument)}
                    >
                      <ExternalLink size={15} />
                      {fileActionPending === "open" ? "Открываем..." : "Открыть"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.detailActionButton}
                    disabled={fileActionPending !== null}
                    onClick={() => void handleDownloadDocument(selectedDocument)}
                  >
                    <Download size={15} />
                    {fileActionPending === "download" ? "Скачиваем..." : "Скачать"}
                  </button>
                </div>
                {fileActionError ? (
                  <p className={styles.fileActionError} role="alert">
                    {fileActionError}
                  </p>
                ) : null}
                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Файл</span>
                    <span className={styles.summaryValue}>{selectedDocument.original_filename || "—"}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Тип</span>
                    <span className={styles.summaryValue}>{documentTypeLabel(selectedDocument.document_type)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Статус</span>
                    <span className={styles.summaryValue}>
                      {processingStatusLabels[selectedDocument.processing_status] ?? selectedDocument.processing_status}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Подразделение</span>
                    <span className={styles.summaryValue}>
                      {departmentName(departments, selectedDocument.department_id)}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Размер</span>
                    <span className={styles.summaryValue}>{formatBytes(selectedDocument.file_size)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Версия</span>
                    <span className={styles.summaryValue}>{selectedDocument.version || 1}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Индексация</span>
                    <span className={styles.summaryValue}>{selectedDocument.is_indexed ? "Да" : "Нет"}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Загружен</span>
                    <span className={styles.summaryValue}>{formatDate(selectedDocument.created_at)}</span>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

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
            <span>После загрузки документ появится в реестре. Добавьте его как источник в разделе «База знаний», когда текст будет извлечён.</span>
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

      {documentPreview ? (
        <div className={styles.previewOverlay} role="dialog" aria-modal="true" aria-label={`Просмотр: ${documentPreview.title}`}>
          <div className={styles.previewPanel}>
            <header className={styles.previewHeader}>
              <div className={styles.previewHeaderCopy}>
                <strong>{documentPreview.title}</strong>
                <span>{documentPreview.filename}</span>
              </div>
              <div className={styles.previewHeaderActions}>
                <button type="button" className={styles.detailActionButton} onClick={handleOpenPreviewInNewTab}>
                  <ExternalLink size={15} />
                  Новая вкладка
                </button>
                <button type="button" className={styles.previewCloseButton} onClick={closeDocumentPreview} aria-label="Закрыть просмотр">
                  <X size={18} />
                </button>
              </div>
            </header>
            <iframe className={styles.previewFrame} src={documentPreview.url} title={documentPreview.title} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
