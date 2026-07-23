import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  LoaderCircle,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { emailMessagesApi } from "@/api/endpoints";
import { FormAutocomplete, FormSelect } from "@/components/form-controls";
import controlStyles from "@/components/form-controls/form-controls.module.css";
import LoadingPanel from "@/components/LoadingPanel";
import type { DocumentXml, EmailAttachment, EmailMessage, EmailMessageStatus } from "@/types";
import styles from "./IncomingMail.module.css";
import IncomingMailTable, {
  isSpamMarkDisabled,
  normalizeOperatorReviewState,
  spamMarkAvailability,
  spamSelectClass,
  type InlineFieldSavePayload,
  type OperatorReviewStateFilter,
  type TableDateSort
} from "./IncomingMailTable";
import tableStyles from "./IncomingMailTable.module.css";

const AGENT_TITLE = "Входящая корреспонденция";
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 450;
const VIEW_MODE_STORAGE_KEY = "incoming-mail-view-mode";
const AGENT_DESCRIPTION =
  "ИИ-агент обрабатывает входящую почту: фильтрует спам, определяет отправителя и отдел, формирует обзор и создаёт задачу в 1С:ERP.";

type StatusFilter = "all" | EmailMessageStatus;
type ViewMode = "cards" | "table";

const REVIEW_STATE_TABS: Array<{
  id: OperatorReviewStateFilter;
  label: string;
  tone: "all" | "verified" | "corrected" | "pending";
}> = [
  { id: "all", label: "Все", tone: "all" },
  { id: "verified", label: "Одобренные", tone: "verified" },
  { id: "corrected", label: "Доработанные", tone: "corrected" },
  { id: "pending", label: "Непроверенные", tone: "pending" }
];

function readStoredViewMode(): ViewMode {
  try {
    const value = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return value === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "done", label: "Обработано" },
  { id: "spam", label: "Спам" },
  { id: "awaiting_human", label: "На проверке" },
  { id: "processing", label: "В работе" },
  { id: "error", label: "Ошибки" }
];

const STATUS_LABELS: Record<EmailMessageStatus, string> = {
  processing: "В работе",
  done: "Обработано",
  spam: "Спам",
  error: "Ошибка",
  awaiting_human: "На проверке",
  dialog: "Диалог"
};

const PROCESS_OPTIONS = [
  { value: "рассмотрение", label: "Рассмотрение — решение / согласование" },
  { value: "исполнение", label: "Исполнение — требуется действие" },
  { value: "ознакомление", label: "Ознакомление — только информация" }
] as const;

const PIPELINE_STEPS = [
  { id: "imap_listener", label: "IMAP", hint: "Получение письма" },
  { id: "spam_filter", label: "Спам-фильтр", hint: "Правила + LLM" },
  { id: "identify_sender", label: "Отправитель", hint: "RAG contractors" },
  { id: "process_content", label: "Контент", hint: "Текст вложений" },
  { id: "route_department", label: "Отдел", hint: "RAG + LLM" },
  { id: "summarize", label: "Обзор", hint: "Краткое резюме" },
  { id: "create_erp_task", label: "1С", hint: "Задача в ERP" },
  { id: "finalize", label: "Финал", hint: "Запись в БД" }
] as const;

const PIPELINE_BLOCK_WIDTH = 104;
const PIPELINE_ARROW_WIDTH = 16;
const PIPELINE_GAP = 16;
const PIPELINE_CARD_PADDING_X = 32;
const PIPELINE_WIDTH_SAFETY_BUFFER = 16;

function pipelineRowWidth(blockCount: number): number {
  if (blockCount <= 0) return 0;
  const arrowCount = blockCount - 1;
  const segmentCount = blockCount;
  const rowGapCount = segmentCount - 1;
  const segmentGapCount = arrowCount;
  return (
    blockCount * PIPELINE_BLOCK_WIDTH +
    arrowCount * PIPELINE_ARROW_WIDTH +
    rowGapCount * PIPELINE_GAP +
    segmentGapCount * PIPELINE_GAP
  );
}

function maxBlocksPerRow(containerWidth: number): number {
  const availableWidth = Math.floor(containerWidth) - PIPELINE_WIDTH_SAFETY_BUFFER;
  if (availableWidth < PIPELINE_BLOCK_WIDTH) return 1;

  for (let count = PIPELINE_STEPS.length; count >= 1; count -= 1) {
    if (pipelineRowWidth(count) <= availableWidth) return count;
  }
  return 1;
}

function estimateInitialPipelineMaxPerRow(): number {
  if (typeof window === "undefined") return 4;
  const contentPadding = 104;
  const estimatedListWidth =
    Math.min(1380, window.innerWidth - contentPadding) - PIPELINE_CARD_PADDING_X;
  return maxBlocksPerRow(estimatedListWidth);
}

function splitBalancedRows(total: number, maxPerRow: number): number[] {
  if (total <= maxPerRow) return [total];

  let rowCount = Math.ceil(total / maxPerRow);
  while (rowCount > 1 && total % rowCount === 1) rowCount += 1;

  const base = Math.floor(total / rowCount);
  const extra = total % rowCount;
  return Array.from({ length: rowCount }, (_, index) => base + (index < extra ? 1 : 0));
}

function extractError(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return error instanceof Error ? error.message : "Не удалось выполнить операцию";
}

function formatMessagesLoadError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return (
        "Не удалось связаться с API agent-pochta (порт 8080). " +
        "Проверьте docker compose up или python scripts/run_api.py."
      );
    }
    const status = error.response.status;
    const detail = error.response.data?.detail;
    if (status >= 500) {
      const hint =
        typeof detail === "string" && detail.trim()
          ? ` ${detail.trim()}`
          : " Ошибка на сервере — см. docker compose logs api.";
      return `API agent-pochta вернул ${status}.${hint}`;
    }
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    return `API agent-pochta вернул ${status}.`;
  }
  return extractError(error);
}

async function extractBlobError(error: unknown): Promise<string> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const parsed = JSON.parse(text) as { detail?: string };
      if (typeof parsed.detail === "string") return parsed.detail;
    } catch {
      // fall through
    }
  }
  return extractError(error);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function attachmentIndex(att: EmailAttachment, fallback: number): number {
  return typeof att.index === "number" ? att.index : fallback;
}

function attachmentPreviewKind(att: EmailAttachment): "image" | "pdf" | null {
  const mime = String(att.mime_type || "").toLowerCase();
  const name = String(att.filename || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) {
    return "image";
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  return null;
}

function statusTone(status: EmailMessageStatus): string {
  if (status === "done") return styles.statusDone;
  if (status === "spam") return styles.statusSpam;
  if (status === "awaiting_human") return styles.statusReview;
  if (status === "error") return styles.statusError;
  return styles.statusProgress;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatConfidence(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function confidenceLevelFromRatio(value: number) {
  const pct = Math.round(value * 100);
  if (pct >= 80) return "ВЫСОКАЯ";
  if (pct >= 50) return "СРЕДНЯЯ";
  return "НИЗКАЯ";
}

function formatDeptConfidence(message: EmailMessage) {
  const conf = message.dept_confidence;
  if (conf != null && !Number.isNaN(conf) && conf > 0) {
    const pct = formatConfidence(conf);
    const level = confidenceLevelFromRatio(conf);
    return `${pct} (${level})`;
  }
  const level = message.route_confidence_level?.trim();
  const score = message.route_confidence_score;
  if (level && score != null) return `${score}% (${level})`;
  if (level) return level;
  return "—";
}

function formatBool(value: boolean | null | undefined) {
  if (value == null) return "—";
  return value ? "Да" : "Нет";
}

function documentXmlValue(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : "—";
}

function serviceFieldLabel(base: string, index: number, total: number) {
  return total > 1 ? `${base} ${index + 1}` : base;
}

function isSpamMessage(message: EmailMessage): boolean {
  return (
    message.is_spam ||
    message.status === "spam" ||
    message.document_xml?.spam === true
  );
}

function xmlDownloadFilename(messageId: string): string {
  const short = messageId.replace(/-/g, "").slice(0, 8) || "document";
  return `incoming_${short}.xml`;
}

function DocumentXmlSummary({
  document,
  onDownloadXml,
  downloadingXml,
  downloadDisabled
}: {
  document: DocumentXml | null | undefined;
  onDownloadXml?: () => void;
  downloadingXml?: boolean;
  downloadDisabled?: boolean;
}) {
  if (!document) {
    return (
      <div className={styles.summaryBlock}>
        <div className={styles.summaryRows}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>XML</span>
            <span className={styles.summaryValue}>XML не сформирован</span>
          </div>
        </div>
      </div>
    );
  }

  const services = document.services?.length ? document.services : [];

  return (
    <div className={styles.summaryBlock}>
      <div className={styles.summaryRows}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Организация</span>
          <span className={styles.summaryValue}>{documentXmlValue(document.organization)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Тема</span>
          <span className={styles.summaryValue}>{documentXmlValue(document.theme)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Направление</span>
          <span className={styles.summaryValue}>{documentXmlValue(document.direction)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Претензия</span>
          <span className={styles.summaryValue}>{formatBool(document.claim)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Партнёр</span>
          <span className={styles.summaryValue}>{documentXmlValue(document.partner)}</span>
        </div>
        {services.length ? (
          services.map((service, index) => (
            <div key={`${service.name}-${index}`} className={styles.summaryServiceGroup}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>
                  {serviceFieldLabel("Код подразделения", index, services.length)}
                </span>
                <span className={styles.summaryValue}>{documentXmlValue(service.name)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>
                  {serviceFieldLabel("Подразделение", index, services.length)}
                </span>
                <span className={styles.summaryValue}>{documentXmlValue(service.title)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>
                  {serviceFieldLabel("Процесс подразделения", index, services.length)}
                </span>
                <span className={styles.summaryValue}>{documentXmlValue(service.process)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>
                  {serviceFieldLabel("Обоснование", index, services.length)}
                </span>
                <span className={styles.summaryValue}>{documentXmlValue(service.reasoning)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Назначения / Отделы</span>
            <span className={styles.summaryValue}>—</span>
          </div>
        )}
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Отправитель (email)</span>
          <span className={styles.summaryValue}>{documentXmlValue(document.email_sender)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Получатель (email)</span>
          <span className={styles.summaryValue}>{documentXmlValue(document.email_recipient)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Дата письма</span>
          <span className={styles.summaryValue}>{documentXmlValue(document.mail_datetime)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Процесс документа</span>
          <span className={styles.summaryValue}>{documentXmlValue(document.process)}</span>
        </div>
      </div>
      {onDownloadXml ? (
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={downloadDisabled || downloadingXml}
          onClick={onDownloadXml}
        >
          {downloadingXml ? (
            <LoaderCircle size={16} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
          ) : (
            <Download size={16} strokeWidth={2.2} aria-hidden="true" />
          )}
          Скачать XML
        </button>
      ) : null}
    </div>
  );
}

function MessageSummaryBody({
  message,
  onDownloadXml,
  downloadingXml,
  downloadDisabled
}: {
  message: EmailMessage;
  onDownloadXml?: () => void;
  downloadingXml?: boolean;
  downloadDisabled?: boolean;
}) {
  return (
    <>
      <div className={styles.summaryBlock}>
        <div className={styles.summaryRows}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Статус</span>
            <span className={`${styles.statusBadge} ${statusTone(message.status)}`}>
              {STATUS_LABELS[message.status]}
            </span>
          </div>
          {message.operator_verified ? (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Проверка</span>
              <span className={styles.verifiedBadge}>
                <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                Проверено оператором
              </span>
            </div>
          ) : null}
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>От кого</span>
            <span className={styles.summaryValue}>{formatSenderLine(message)}</span>
          </div>
          {formatRecipientAddress(message) ? (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Кому</span>
              <span className={styles.summaryValue}>{formatRecipientAddress(message)}</span>
            </div>
          ) : null}
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Наш ящик</span>
            <span className={styles.summaryValue}>{message.mailbox}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Получено</span>
            <span className={styles.summaryValue}>{formatDate(message.received_at)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Обработано</span>
            <span className={styles.summaryValue}>{formatDate(message.processed_at)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Вложения</span>
            <span className={styles.summaryValue}>{message.attachments_count ?? 0}</span>
          </div>
        </div>
      </div>

      <div className={styles.summaryBlock}>
        <div className={styles.summaryRows}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Отдел</span>
            <span className={styles.summaryValue}>{message.department_name ?? "—"}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Уверенность отдела</span>
            <span className={styles.summaryValue}>{formatDeptConfidence(message)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Приоритет</span>
            <span className={styles.summaryValue}>{message.priority ?? "—"}</span>
          </div>
        </div>
      </div>

      {!isSpamMessage(message) ? (
        <DocumentXmlSummary
          document={message.document_xml}
          onDownloadXml={
            message.document_xml || message.xml_document ? onDownloadXml : undefined
          }
          downloadingXml={downloadingXml}
          downloadDisabled={downloadDisabled}
        />
      ) : null}
    </>
  );
}

const BODY_NOT_STORED = "Текст не хранится";

function isBodyMissing(body: string | null | undefined): boolean {
  const text = body?.trim();
  return !text || text === BODY_NOT_STORED;
}

function messagePreview(message: EmailMessage) {
  return message.subject?.trim() || message.message_id;
}

function senderShortName(message: EmailMessage) {
  const name = message.sender_name?.trim();
  if (name) return name;
  const email = message.sender_email.trim();
  const at = email.indexOf("@");
  if (at > 0) return email.slice(0, at);
  return email;
}

function formatSenderLine(message: EmailMessage) {
  return message.sender_name
    ? `${message.sender_name} · ${message.sender_email}`
    : message.sender_email;
}

function formatRecipientAddress(message: EmailMessage) {
  if (message.routing_recipient?.trim()) return message.routing_recipient.trim();
  const recipients = (message.to ?? []).map((item) => item.trim()).filter(Boolean);
  if (recipients.length) return recipients.join(", ");
  return null;
}

function formatMailHeaderLine(message: EmailMessage) {
  const parts = [formatSenderLine(message)];
  const recipient = formatRecipientAddress(message);
  if (recipient) parts.push(recipient);
  parts.push(message.mailbox);
  return parts.join(" → ");
}

function pipelineIndexForStatus(status: EmailMessageStatus): number {
  if (status === "spam") return 1;
  if (status === "processing") return 2;
  if (status === "awaiting_human") return 4;
  if (status === "error") return 6;
  return PIPELINE_STEPS.length - 1;
}

function canChangeDepartment(status: EmailMessageStatus): boolean {
  return status === "awaiting_human" || status === "done" || status === "error";
}

function resolveRoutingFromMessage(message: EmailMessage): {
  department_id?: string;
  department_name?: string;
  partner_name?: string;
  organization?: string;
} {
  const department_id =
    message.department_id?.trim() ||
    message.document_xml?.services?.[0]?.name?.trim() ||
    undefined;
  const department_name =
    message.department_name?.trim() ||
    message.document_xml?.services?.[0]?.title?.trim() ||
    undefined;
  const partner_name =
    partnerDisplayValue(message.partner_name ?? message.document_xml?.partner) || undefined;
  const organization =
    message.organization?.trim() ||
    message.document_xml?.organization?.trim() ||
    undefined;
  return { department_id, department_name, partner_name, organization };
}

function partnerDisplayValue(partner: string | null | undefined): string {
  const value = partner?.trim();
  if (!value || value === "-") return "";
  return value;
}

function departmentActionLabel(status: EmailMessageStatus): string {
  return status === "awaiting_human" ? "Подтвердить отдел" : "Сохранить изменения";
}

function localDayKey(value: string | null | undefined): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayHeader(dayKey: string): string {
  if (dayKey === "unknown") return "Без даты";
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  if (sameDay(date, today)) return "Сегодня";
  if (sameDay(date, yesterday)) return "Вчера";
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function groupMessagesByDay(messages: EmailMessage[]) {
  const groups = new Map<string, EmailMessage[]>();
  for (const message of messages) {
    const key = localDayKey(message.received_at);
    const bucket = groups.get(key);
    if (bucket) bucket.push(message);
    else groups.set(key, [message]);
  }
  return Array.from(groups.entries()).map(([dayKey, items]) => ({
    dayKey,
    label: formatDayHeader(dayKey),
    messages: items
  }));
}

function messageTableDateTime(message: EmailMessage): number {
  const raw = message.received_at ?? message.mail_date;
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function IncomingMail() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [infoRecipientOnly, setInfoRecipientOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readStoredViewMode());
  const [reviewStateFilter, setReviewStateFilter] = useState<OperatorReviewStateFilter>("all");
  const [tableDateSort, setTableDateSort] = useState<TableDateSort>("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hitlDepartmentId, setHitlDepartmentId] = useState("");
  const [hitlPartnerName, setHitlPartnerName] = useState("");
  const [hitlContractorId, setHitlContractorId] = useState("");
  const [hitlProcess, setHitlProcess] = useState("исполнение");
  const [hitlOrganization, setHitlOrganization] = useState("НП");
  const [contractorSearchQuery, setContractorSearchQuery] = useState("");
  const [debouncedContractorSearch, setDebouncedContractorSearch] = useState("");
  const [partnerSuggestionsOpen, setPartnerSuggestionsOpen] = useState(true);
  const [emailBodyExpanded, setEmailBodyExpanded] = useState(false);
  const [emailBodyText, setEmailBodyText] = useState<string | null>(null);
  const [emailBodyLoading, setEmailBodyLoading] = useState(false);
  const [emailBodyError, setEmailBodyError] = useState<string | null>(null);
  const [downloadingAttachmentIndex, setDownloadingAttachmentIndex] = useState<number | null>(null);
  const [downloadingXml, setDownloadingXml] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{
    filename: string;
    kind: "image" | "pdf";
    blobUrl: string;
  } | null>(null);
  const [attachmentPreviewLoading, setAttachmentPreviewLoading] = useState(false);
  const [attachmentPreviewError, setAttachmentPreviewError] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState("");
  const [previewingAttachmentIndex, setPreviewingAttachmentIndex] = useState<number | null>(null);
  const [drawerSpamValue, setDrawerSpamValue] = useState<"" | "confirm" | "reject">("");
  const attachmentPreviewLoadIdRef = useRef(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const pipelineListRef = useRef<HTMLDivElement>(null);
  const listSentinelRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollSnapshotRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const tableScrollToBottomRef = useRef(true);
  const tableScrollToTopRef = useRef(false);
  const hitlFormRef = useRef<HTMLDivElement>(null);
  const attachmentsSectionRef = useRef<HTMLDivElement>(null);
  const attachmentsFocusRef = useRef<string | null>(null);
  const [pipelineMaxPerRow, setPipelineMaxPerRow] = useState<number>(estimateInitialPipelineMaxPerRow);


  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    attachmentPreviewLoadIdRef.current += 1;
    setAttachmentPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
    setAttachmentPreviewLoading(false);
    setAttachmentPreviewError(null);
    setPreviewFilename("");
    setPreviewingAttachmentIndex(null);
  }, [selectedId]);

  const attachmentPreviewVisible =
    attachmentPreviewLoading || attachmentPreview != null || attachmentPreviewError != null;

  useEffect(() => {
    if (viewMode !== "table" || !selectedId || attachmentPreviewVisible) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewMode, selectedId, attachmentPreviewVisible]);

  useEffect(() => {
    if (!attachmentPreviewVisible) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAttachmentPreview();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attachmentPreviewVisible]);

  const listFilters = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      q: debouncedSearch || undefined,
      info_recipient_only: infoRecipientOnly || undefined
    }),
    [statusFilter, dateFrom, dateTo, debouncedSearch, infoRecipientOnly]
  );

  const messagesQuery = useInfiniteQuery({
    queryKey: ["email-messages", "list", listFilters],
    queryFn: ({ pageParam = 0 }) =>
      emailMessagesApi.list({ ...listFilters, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    staleTime: 10_000
  });

  const statsQuery = useQuery({
    queryKey: ["email-messages", "stats", listFilters],
    queryFn: () => emailMessagesApi.stats(listFilters),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    staleTime: 10_000
  });

  const messages = useMemo(
    () => messagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [messagesQuery.data]
  );

  const tableMessages = useMemo(
    () =>
      [...messages].sort((a, b) => {
        const delta = messageTableDateTime(a) - messageTableDateTime(b);
        return tableDateSort === "asc" ? delta : -delta;
      }),
    [messages, tableDateSort]
  );

  const handleTableDateSortToggle = useCallback(() => {
    setTableDateSort((prev) => {
      const next = prev === "asc" ? "desc" : "asc";
      tableScrollToBottomRef.current = next === "asc";
      tableScrollToTopRef.current = next === "desc";
      tableScrollSnapshotRef.current = null;
      return next;
    });
  }, []);

  const totalCount = messagesQuery.data?.pages[0]?.total ?? 0;
  const loadedCount = messages.length;
  const hasMore = loadedCount < totalCount;

  const operatorReviewCounts = useMemo(() => {
    const counts = statsQuery.data?.operator_review_counts;
    if (counts) {
      return {
        all: counts.all,
        verified: counts.verified,
        corrected: counts.corrected,
        pending: counts.pending
      };
    }
    return { all: totalCount, verified: 0, corrected: 0, pending: 0 };
  }, [statsQuery.data?.operator_review_counts, totalCount]);

  const filteredTableMessages = useMemo(() => {
    if (reviewStateFilter === "all") return tableMessages;
    return tableMessages.filter(
      (message) =>
        normalizeOperatorReviewState(message.operator_review_state) === reviewStateFilter
    );
  }, [tableMessages, reviewStateFilter]);

  const stats = useMemo(() => {
    const data = statsQuery.data;
    if (!data) {
      return {
        total: 0,
        done: 0,
        spam: 0,
        review: 0,
        approvalsSaved: 0,
        approvalsChanged: 0,
        approvalsRate: null as number | null
      };
    }
    const approvals = data.operator_approvals;
    return {
      total: data.total,
      done: data.by_status.done ?? 0,
      spam: data.by_status.spam ?? 0,
      review: data.by_status.awaiting_human ?? 0,
      approvalsSaved: approvals?.saved ?? 0,
      approvalsChanged: approvals?.changed ?? 0,
      approvalsRate: approvals?.rate ?? null
    };
  }, [statsQuery.data]);

  const groupedMessages = useMemo(() => groupMessagesByDay(messages), [messages]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedContractorSearch(contractorSearchQuery.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [contractorSearchQuery]);

  const departmentsQuery = useQuery({
    queryKey: ["email-messages", "departments"],
    queryFn: emailMessagesApi.listDepartments
  });

  const organizationsQuery = useQuery({
    queryKey: ["email-messages", "organizations"],
    queryFn: emailMessagesApi.listOrganizations
  });

  const contractorsQuery = useQuery({
    queryKey: ["email-messages", "contractors", debouncedContractorSearch],
    queryFn: () => emailMessagesApi.searchContractors(debouncedContractorSearch),
    enabled: debouncedContractorSearch.length >= 2,
    staleTime: 30_000
  });

  useEffect(() => {
    tableScrollToBottomRef.current = true;
    tableScrollSnapshotRef.current = null;
  }, [listFilters]);

  useEffect(() => {
    if (viewMode === "table") {
      tableScrollToBottomRef.current = true;
    }
  }, [viewMode]);

  useEffect(() => {
    if (!selectedId || messagesQuery.isFetching || messagesQuery.isPlaceholderData) return;
    if (!messages.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [messages, selectedId, messagesQuery.isFetching, messagesQuery.isPlaceholderData]);

  useEffect(() => {
    if (viewMode !== "table") return;

    const scrollEl = tableScrollRef.current;
    if (!scrollEl || messagesQuery.isLoading || messagesQuery.isPlaceholderData) return;

    const snapshot = tableScrollSnapshotRef.current;
    if (snapshot) {
      if (!messagesQuery.isFetchingNextPage) {
        const heightDelta = scrollEl.scrollHeight - snapshot.scrollHeight;
        scrollEl.scrollTop = snapshot.scrollTop + heightDelta;
        tableScrollSnapshotRef.current = null;
      }
      return;
    }

    if (tableScrollToBottomRef.current && !messagesQuery.isFetchingNextPage && tableMessages.length) {
      requestAnimationFrame(() => {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      });
      tableScrollToBottomRef.current = false;
    }

    if (tableScrollToTopRef.current && tableMessages.length) {
      requestAnimationFrame(() => {
        scrollEl.scrollTop = 0;
      });
      tableScrollToTopRef.current = false;
    }
  }, [
    viewMode,
    tableMessages,
    tableDateSort,
    messagesQuery.isLoading,
    messagesQuery.isPlaceholderData,
    messagesQuery.isFetchingNextPage
  ]);

  useEffect(() => {
    if (viewMode === "table") return;
    const sentinel = listSentinelRef.current;
    if (!sentinel || !hasMore) return;

    const root = sentinel.closest(`.${styles.requestList}`);
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          messagesQuery.hasNextPage &&
          !messagesQuery.isFetchingNextPage
        ) {
          void messagesQuery.fetchNextPage();
        }
      },
      { root, rootMargin: "120px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    hasMore,
    messagesQuery.hasNextPage,
    messagesQuery.isFetchingNextPage,
    messagesQuery.fetchNextPage,
    loadedCount,
    viewMode
  ]);

  const selectedDetailQuery = useQuery({
    queryKey: ["email-messages", "detail", selectedId],
    queryFn: () => emailMessagesApi.get(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 30_000
  });

  const selectedMessage = useMemo(() => {
    const detail = selectedDetailQuery.data;

    if (selectedId) {
      const fromList = messages.find((item) => item.id === selectedId);
      if (fromList) {
        return detail && detail.id === fromList.id ? { ...fromList, ...detail } : fromList;
      }
      if (detail && detail.id === selectedId) {
        return detail;
      }
      return null;
    }

    if (viewMode === "table" || !messages.length) return null;
    const first = messages[0];
    return detail && detail.id === first.id ? { ...first, ...detail } : first;
  }, [messages, selectedId, selectedDetailQuery.data, viewMode]);

  const tableDrawerOpen = viewMode === "table" && selectedId != null;

  useEffect(() => {
    if (!selectedMessage) return;
    setHitlDepartmentId(selectedMessage.department_id ?? "");
    setHitlPartnerName(
      partnerDisplayValue(selectedMessage.partner_name ?? selectedMessage.document_xml?.partner)
    );
    setHitlContractorId(selectedMessage.contractor_id ?? "");
    setHitlProcess(selectedMessage.document_xml?.process?.trim() || "исполнение");
    setHitlOrganization(selectedMessage.document_xml?.organization?.trim() || "НП");
    setContractorSearchQuery(
      partnerDisplayValue(selectedMessage.partner_name ?? selectedMessage.document_xml?.partner)
    );
    setPartnerSuggestionsOpen(true);

    const openAttachmentsView = attachmentsFocusRef.current === selectedMessage.id;
    if (openAttachmentsView) {
      setEmailBodyExpanded(true);
    } else {
      setEmailBodyExpanded(false);
    }
    setEmailBodyText(null);
    setEmailBodyLoading(false);
    setEmailBodyError(null);
    setDownloadingAttachmentIndex(null);
  }, [selectedMessage?.id, selectedMessage?.department_id, selectedMessage?.partner_name, selectedMessage?.contractor_id, selectedMessage?.document_xml?.partner, selectedMessage?.document_xml?.process, selectedMessage?.document_xml?.organization]);

  useEffect(() => {
    setDrawerSpamValue("");
  }, [selectedMessage?.id]);

  useEffect(() => {
    if (!selectedMessage || attachmentsFocusRef.current !== selectedMessage.id) return;
    if (selectedDetailQuery.isFetching) return;

    const message = selectedMessage;
    attachmentsFocusRef.current = null;

    void loadEmailBodyIfMissing(message);

    window.setTimeout(() => {
      attachmentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [selectedMessage?.id, selectedDetailQuery.isFetching, selectedDetailQuery.dataUpdatedAt]);

  useEffect(() => {
    const element = pipelineListRef.current;
    if (!element) return;

    const updateLayout = () => {
      setPipelineMaxPerRow(maxBlocksPerRow(element.getBoundingClientRect().width));
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pipelineRows = useMemo(() => {
    const rowSizes = splitBalancedRows(PIPELINE_STEPS.length, pipelineMaxPerRow);
    const rows: Array<{ steps: (typeof PIPELINE_STEPS)[number][]; startIndex: number }> = [];
    let offset = 0;

    for (const size of rowSizes) {
      rows.push({
        steps: PIPELINE_STEPS.slice(offset, offset + size),
        startIndex: offset
      });
      offset += size;
    }

    return rows;
  }, [pipelineMaxPerRow]);

  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data ?? []).map((department) => ({
        value: department.id,
        label: `${department.id} · ${department.name}`
      })),
    [departmentsQuery.data]
  );

  const organizationOptions = useMemo(
    () =>
      (organizationsQuery.data ?? []).map((organization) => ({
        value: organization.id,
        label: `${organization.id} · ${organization.name}`
      })),
    [organizationsQuery.data]
  );

  const contractorOptions = useMemo(
    () =>
      (contractorsQuery.data ?? []).map((contractor) => ({
        value: contractor.contractor_id,
        name: contractor.name,
        label: contractor.email ? `${contractor.name} · ${contractor.email}` : contractor.name
      })),
    [contractorsQuery.data]
  );

  const invalidateMessages = async (messageId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["email-messages"] });
    if (messageId) {
      await queryClient.refetchQueries({ queryKey: ["email-messages", "detail", messageId] });
    }
  };

  const restoreMutation = useMutation({
    mutationFn: (id: string) => emailMessagesApi.restoreFromSpam(id),
    onSuccess: async (_data, id) => {
      setFeedback({
        type: "success",
        text: "Письмо восстановлено и отправлено на доппроверку."
      });
      setStatusFilter("awaiting_human");
      setSelectedId(id);
      await invalidateMessages(id);
    },
    onError: (error) => setFeedback({ type: "error", text: extractError(error) })
  });

  const retryErpMutation = useMutation({
    mutationFn: (id: string) => emailMessagesApi.retryErp(id),
    onSuccess: async () => {
      setFeedback({ type: "success", text: "Повторная отправка в 1С поставлена в очередь." });
      await invalidateMessages();
    },
    onError: (error) => setFeedback({ type: "error", text: extractError(error) })
  });

  const reanalyzeMutation = useMutation({
    mutationFn: (id: string) => emailMessagesApi.reanalyze(id),
    onSuccess: async (_data, id) => {
      setFeedback({
        type: "success",
        text: "Письмо отправлено на повторный анализ партнёра, отдела и организации."
      });
      setStatusFilter("processing");
      setSelectedId(id);
      await invalidateMessages(id);
    },
    onError: (error) => setFeedback({ type: "error", text: extractError(error) })
  });

  const resolveMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      decision: "approve_routing" | "mark_verified" | "mark_spam" | "mark_not_spam";
      department_id?: string;
      department_name?: string;
      partner_name?: string;
      contractor_id?: string;
      process?: string;
      organization?: string;
      status?: EmailMessageStatus;
    }) =>
      emailMessagesApi.resolveHuman(payload.id, {
        decision: payload.decision,
        department_id: payload.department_id,
        department_name: payload.department_name,
        partner_name: payload.partner_name,
        contractor_id: payload.contractor_id,
        process: payload.process,
        organization: payload.organization
      }),
    onSuccess: async (_data, variables) => {
      const text =
        variables.decision === "mark_verified"
          ? "Письмо отмечено как проверенное оператором."
          : variables.decision === "approve_routing"
            ? variables.status === "awaiting_human"
              ? "Отдел подтверждён. Коррекция сохранена для обучения маршрутизации."
              : "Отдел изменён. Коррекция сохранена для обучения маршрутизации."
            : variables.decision === "mark_spam"
              ? "Письмо отмечено как спам. Паттерн сохранён для обучения фильтра."
              : "Решение офис-менеджера сохранено.";
      setFeedback({ type: "success", text });
      await invalidateMessages(variables.id);
    },
    onError: (error) => setFeedback({ type: "error", text: extractError(error) })
  });

  const isBusy =
    restoreMutation.isPending ||
    retryErpMutation.isPending ||
    reanalyzeMutation.isPending ||
    resolveMutation.isPending;

  const processingLabel = restoreMutation.isPending
    ? "Восстанавливаем письмо из спама…"
    : retryErpMutation.isPending
      ? "Планируем повтор отправки в 1С…"
      : reanalyzeMutation.isPending
        ? "Отправляем письмо на повторный анализ…"
        : resolveMutation.isPending
          ? "Сохраняем решение human-in-the-loop…"
          : null;

  const pipelineProgress = selectedMessage
    ? pipelineIndexForStatus(selectedMessage.status)
    : -1;

  const drawerSpamMarks = selectedMessage
    ? spamMarkAvailability(selectedMessage.status, selectedMessage.is_spam)
    : { confirm: false, reject: false };
  const drawerSpamDisabled = isSpamMarkDisabled(drawerSpamMarks, isBusy);

  function handleRefreshList() {
    void messagesQuery.refetch();
    void statsQuery.refetch();
  }

  function handleClearDateFilters() {
    setDateFrom("");
    setDateTo("");
  }

  const isSearchDebouncing = searchQuery.trim() !== debouncedSearch;
  const isListQueryFetching =
    messagesQuery.isFetching && !messagesQuery.isFetchingNextPage;
  const isListBackgroundFetching =
    isListQueryFetching || statsQuery.isFetching || isSearchDebouncing;
  const isListFetching = isListBackgroundFetching;
  const isListDimmed = isListQueryFetching;

  function handleSelectMessage(message: EmailMessage) {
    setSelectedId(message.id);
    setFeedback(null);
  }

  function scrollToAttachmentsSection() {
    window.setTimeout(() => {
      attachmentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  async function loadEmailBodyIfMissing(message: EmailMessage) {
    const currentBody = message.body_text;
    if (!isBodyMissing(currentBody)) return;

    setEmailBodyLoading(true);
    setEmailBodyError(null);
    try {
      const result = await emailMessagesApi.fetchBody(message.id);
      setEmailBodyText(result.body_text);
      queryClient.setQueryData(
        ["email-messages", "detail", message.id],
        (old: EmailMessage | undefined) =>
          old ? { ...old, body_text: result.body_text } : old
      );
    } catch (error) {
      setEmailBodyError(extractError(error));
    } finally {
      setEmailBodyLoading(false);
    }
  }

  function handleOpenMessageAttachments(message: EmailMessage) {
    const isSameMessage = selectedId === message.id;
    attachmentsFocusRef.current = message.id;
    setSelectedId(message.id);
    setFeedback(null);

    if (isSameMessage) {
      attachmentsFocusRef.current = null;
      setEmailBodyExpanded(true);
      void loadEmailBodyIfMissing(message);
      scrollToAttachmentsSection();
    }
  }

  function handleTableLoadMore() {
    const scrollEl = tableScrollRef.current;
    if (scrollEl) {
      tableScrollSnapshotRef.current = {
        scrollTop: scrollEl.scrollTop,
        scrollHeight: scrollEl.scrollHeight
      };
    }
    void messagesQuery.fetchNextPage();
  }

  function handleCloseDrawer() {
    setSelectedId(null);
  }

  function handleToggleViewMode() {
    setViewMode((current) => (current === "cards" ? "table" : "cards"));
  }

  function handleTableOperatorApprove(message: EmailMessage) {
    const routing = resolveRoutingFromMessage(message);
    if (!routing.department_id) {
      setSelectedId(message.id);
      setFeedback({
        type: "error",
        text: "У письма не указан отдел для подтверждения. Выберите отдел в таблице или в форме справа."
      });
      return;
    }
    setSelectedId(message.id);
    setFeedback(null);
    const decision =
      message.status === "done" || message.status === "error" ? "mark_verified" : "approve_routing";
    resolveMutation.mutate({
      id: message.id,
      decision,
      department_id: routing.department_id,
      department_name: routing.department_name,
      partner_name: routing.partner_name,
      organization: routing.organization,
      status: message.status
    });
  }

  function handleTableOperatorCorrect(message: EmailMessage) {
    setSelectedId(message.id);
    setFeedback(null);
    window.setTimeout(() => {
      hitlFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }

  function handleTableSpamConfirm(message: EmailMessage) {
    setSelectedId(message.id);
    setFeedback(null);
    resolveMutation.mutate({ id: message.id, decision: "mark_spam" });
  }

  function handleTableSpamReject(message: EmailMessage) {
    setSelectedId(message.id);
    setFeedback(null);
    if (message.status === "spam" || message.is_spam) {
      restoreMutation.mutate(message.id);
      return;
    }
    if (message.status === "awaiting_human") {
      resolveMutation.mutate({ id: message.id, decision: "mark_not_spam" });
    }
  }

  function handleDrawerSpamChange(value: "" | "confirm" | "reject") {
    if (!selectedMessage || !value) return;
    setDrawerSpamValue("");
    if (value === "confirm") {
      handleTableSpamConfirm(selectedMessage);
      return;
    }
    handleTableSpamReject(selectedMessage);
  }

  function handleTableInlineFieldSave(message: EmailMessage, payload: InlineFieldSavePayload) {
    if (!canChangeDepartment(message.status)) return;

    const routing = resolveRoutingFromMessage(message);
    const departmentId =
      payload.field === "department_id"
        ? payload.department_id ?? payload.value
        : routing.department_id;
    const departmentName =
      payload.field === "department_id"
        ? payload.department_name ??
          (departmentsQuery.data ?? []).find((item) => item.id === departmentId)?.name
        : routing.department_name;
    const partnerName =
      payload.field === "partner" ? payload.value : routing.partner_name;
    const organization =
      payload.field === "organization" ? payload.value : routing.organization;

    if (payload.field === "department_id" && !departmentId) {
      setFeedback({ type: "error", text: "Выберите отдел для маршрутизации." });
      return;
    }

    const decision =
      message.status === "done" || message.status === "error" ? "mark_verified" : "approve_routing";

    resolveMutation.mutate({
      id: message.id,
      decision,
      department_id: departmentId,
      department_name: departmentName,
      partner_name: partnerName?.trim() || undefined,
      organization,
      status: message.status
    });
  }

  async function handleToggleEmailBody() {
    const nextExpanded = !emailBodyExpanded;
    setEmailBodyExpanded(nextExpanded);
    if (!nextExpanded || !selectedMessage) return;
    await loadEmailBodyIfMissing(selectedMessage);
  }

  async function handleDownloadAttachment(att: EmailAttachment, fallbackIndex: number) {
    if (!selectedMessage) return;
    const index = attachmentIndex(att, fallbackIndex);
    setDownloadingAttachmentIndex(index);
    setFeedback(null);
    try {
      const blob = await emailMessagesApi.downloadAttachment(selectedMessage.id, index);
      downloadBlob(blob, att.filename || `attachment-${index}`);
    } catch (error) {
      setFeedback({ type: "error", text: await extractBlobError(error) });
    } finally {
      setDownloadingAttachmentIndex(null);
    }
  }

  function closeAttachmentPreview() {
    attachmentPreviewLoadIdRef.current += 1;
    setAttachmentPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
    setAttachmentPreviewLoading(false);
    setAttachmentPreviewError(null);
    setPreviewFilename("");
    setPreviewingAttachmentIndex(null);
  }

  async function handlePreviewAttachment(att: EmailAttachment, fallbackIndex: number) {
    if (!selectedMessage) return;
    const kind = attachmentPreviewKind(att);
    if (!kind) return;

    const index = attachmentIndex(att, fallbackIndex);
    const filename = att.filename || `Файл ${index + 1}`;

    setAttachmentPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
    const loadId = attachmentPreviewLoadIdRef.current + 1;
    attachmentPreviewLoadIdRef.current = loadId;
    setPreviewFilename(filename);
    setAttachmentPreviewLoading(true);
    setAttachmentPreviewError(null);
    setPreviewingAttachmentIndex(index);

    try {
      const blob = await emailMessagesApi.downloadAttachment(selectedMessage.id, index);
      if (loadId !== attachmentPreviewLoadIdRef.current) return;
      const blobUrl = URL.createObjectURL(blob);
      setAttachmentPreview({ filename, kind, blobUrl });
    } catch (error) {
      if (loadId !== attachmentPreviewLoadIdRef.current) return;
      setAttachmentPreviewError(await extractBlobError(error));
    } finally {
      if (loadId === attachmentPreviewLoadIdRef.current) {
        setAttachmentPreviewLoading(false);
        setPreviewingAttachmentIndex(null);
      }
    }
  }

  async function handleDownloadXml() {
    if (!selectedMessage) return;
    setDownloadingXml(true);
    setFeedback(null);
    try {
      const blob = await emailMessagesApi.downloadXml(selectedMessage.id);
      downloadBlob(blob, xmlDownloadFilename(selectedMessage.id));
    } catch (error) {
      setFeedback({ type: "error", text: await extractBlobError(error) });
    } finally {
      setDownloadingXml(false);
    }
  }

  function handleApproveRouting() {
    if (!selectedMessage || !hitlDepartmentId) {
      setFeedback({ type: "error", text: "Выберите отдел для маршрутизации." });
      return;
    }
    const department = (departmentsQuery.data ?? []).find((item) => item.id === hitlDepartmentId);
    const trimmedPartner = hitlPartnerName.trim();
    resolveMutation.mutate({
      id: selectedMessage.id,
      decision: "approve_routing",
      department_id: hitlDepartmentId,
      department_name: department?.name,
      partner_name: trimmedPartner || undefined,
      contractor_id: hitlContractorId || undefined,
      process: hitlProcess,
      organization: hitlOrganization,
      status: selectedMessage.status
    });
  }

  function handleMarkVerified() {
    if (!selectedMessage || !hitlDepartmentId) {
      setFeedback({ type: "error", text: "Выберите отдел для маршрутизации." });
      return;
    }
    const department = (departmentsQuery.data ?? []).find((item) => item.id === hitlDepartmentId);
    const trimmedPartner = hitlPartnerName.trim();
    resolveMutation.mutate({
      id: selectedMessage.id,
      decision: "mark_verified",
      department_id: hitlDepartmentId,
      department_name: department?.name,
      partner_name: trimmedPartner || undefined,
      contractor_id: hitlContractorId || undefined,
      process: hitlProcess,
      organization: hitlOrganization,
      status: selectedMessage.status
    });
  }

  const isInitialLoading =
    messagesQuery.isPending && messagesQuery.data === undefined && !messagesQuery.isPlaceholderData;

  if (isInitialLoading) {
    return <LoadingPanel title="Загружаем входящую корреспонденцию" />;
  }

  if (messagesQuery.isError) {
    return (
      <div className={styles.page} data-incoming-mail-page>
        <header className={styles.header}>
          <Link to="/agents" className={styles.backLink}>
            <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
            Каталог агентов
          </Link>
          <h1>{AGENT_TITLE}</h1>
        </header>
        <div className={styles.errorCallout} role="alert">
          <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
          <p>{formatMessagesLoadError(messagesQuery.error)}</p>
        </div>
        <div className={styles.actionsRow}>
          <button type="button" className={styles.primaryButton} onClick={() => void messagesQuery.refetch()}>
            Повторить загрузку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.page} ${viewMode === "table" ? styles.pageTableMode : ""} ${
        tableDrawerOpen ? styles.pageDrawerOpen : ""
      }`}
      data-incoming-mail-page
      data-table-mode={viewMode === "table" ? "true" : undefined}
    >
      <header className={styles.header}>
        <Link to="/agents" className={styles.backLink}>
          <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
          Каталог агентов
        </Link>
        <div className={styles.headerRow}>
          <div>
            <h1>{AGENT_TITLE}</h1>
            {viewMode !== "table" ? <p>{AGENT_DESCRIPTION}</p> : null}
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.secondaryButton} ${viewMode === "table" ? styles.viewModeActive : ""}`}
              onClick={handleToggleViewMode}
              aria-pressed={viewMode === "table"}
              title="Переключить табличный вид «Таняфикация»"
            >
              Таняфикация
            </button>
            <span className={styles.agentBadge}>
              <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
              agent_pochta · v0.2
            </span>
          </div>
        </div>
      </header>

      {viewMode !== "table" ? (
      <section className={styles.statsRow} aria-label="Сводка по письмам">
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Всего писем</span>
          <strong className={styles.statValue}>{stats.total}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Обработано</span>
          <strong className={styles.statValue}>{stats.done}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Спам</span>
          <strong className={styles.statValue}>{stats.spam}</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>На проверке</span>
          <strong className={styles.statValue}>{stats.review}</strong>
        </article>
        <article
          className={styles.statCard}
          title="Доля сохранений без правок: Saved / (Saved + Changed). Saved — подтверждение без изменения отдела, партнёра или организации; Changed — хотя бы одно поле изменено."
        >
          <span className={styles.statLabel}>Доля без изменений</span>
          <strong className={styles.statValue}>
            {stats.approvalsRate == null ? "—" : `${Math.round(stats.approvalsRate * 100)}%`}
          </strong>
          <span className={styles.statHint}>
            {stats.approvalsSaved} без правок · {stats.approvalsChanged} изменено
          </span>
        </article>
      </section>
      ) : null}

      {viewMode === "cards" ? (
      <section className={styles.pipelineCard} aria-label="Граф обработки">
        <h2>Граф агента</h2>
        <div className={styles.pipelineList} ref={pipelineListRef}>
          <div className={styles.pipelineRows}>
            {pipelineRows.map((row) => (
              <div key={row.startIndex} className={styles.pipelineRow}>
                {row.steps.map((step, columnIndex) => {
                  const index = row.startIndex + columnIndex;
                  const done = selectedMessage ? index <= pipelineProgress : false;
                  const active = selectedMessage ? index === pipelineProgress : false;
                  return (
                    <div key={step.id} className={styles.pipelineSegment}>
                      {columnIndex > 0 ? (
                        <span className={styles.pipelineArrowBetween} aria-hidden="true">
                          <ChevronRight size={16} strokeWidth={2.2} />
                        </span>
                      ) : null}
                      <div className={styles.pipelineNode}>
                        <div
                          className={`${styles.pipelineItem} ${done ? styles.pipelineItemDone : ""} ${
                            active ? styles.pipelineItemActive : ""
                          }`}
                        >
                          <span className={styles.pipelineIndex}>
                            {done ? (
                              <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className={styles.pipelineBody}>
                            <span className={styles.pipelineTitle}>{step.label}</span>
                            <span className={styles.pipelineHint}>{step.hint}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      <div
        className={`${styles.layout} ${viewMode === "table" ? styles.layoutTableFull : ""}`}
      >
        <aside
          className={`${styles.requestsCard} ${viewMode === "table" ? styles.requestsCardTable : ""}`}
          aria-label={viewMode === "table" ? "Таблица писем" : "Список писем"}
        >
          {viewMode === "table" ? (
            <div className={styles.tableToolbar}>
              <h2 className={styles.tableToolbarTitle}>Таняфикация</h2>
              <input
                type="search"
                className={styles.tableToolbarSearch}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск…"
                aria-label="Поиск по теме или отправителю"
              />
              <button
                type="button"
                className={`${styles.tab} ${infoRecipientOnly ? styles.tabActive : ""}`}
                aria-pressed={infoRecipientOnly}
                onClick={() => setInfoRecipientOnly((value) => !value)}
                title="Показать письма, где получатель содержит info"
              >
                Только info
              </button>
              <input
                type="date"
                className={styles.tableToolbarDate}
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                aria-label="Дата с"
                title="Дата с"
              />
              <span className={styles.dateSeparator}>—</span>
              <input
                type="date"
                className={styles.tableToolbarDate}
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                aria-label="Дата по"
                title="Дата по"
              />
              {dateFrom || dateTo ? (
                <button
                  type="button"
                  className={styles.clearFiltersButton}
                  onClick={handleClearDateFilters}
                >
                  Сброс
                </button>
              ) : null}
              <div className={styles.tableToolbarTabs} role="tablist" aria-label="Фильтр по статусу">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === tab.id}
                    className={`${styles.tab} ${statusFilter === tab.id ? styles.tabActive : ""}`}
                    onClick={() => setStatusFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.iconButton}
                disabled={isListFetching}
                onClick={handleRefreshList}
                aria-label="Обновить список писем"
                title="Обновить"
              >
                {isListFetching ? (
                  <LoaderCircle size={16} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
                ) : (
                  <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
                )}
              </button>
            </div>
          ) : (
            <>
              <div className={styles.requestsToolbar}>
                <h2>Входящие письма</h2>
                <button
                  type="button"
                  className={styles.iconButton}
                  disabled={isListFetching}
                  onClick={handleRefreshList}
                  aria-label="Обновить список писем"
                  title="Обновить"
                >
                  {isListFetching ? (
                    <LoaderCircle size={16} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
                  ) : (
                    <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className={styles.filtersRow}>
                <input
                  type="search"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Поиск по теме или отправителю"
                  aria-label="Поиск по теме или отправителю"
                />
                <div className={styles.recipientFilters}>
                  <button
                    type="button"
                    className={`${styles.tab} ${infoRecipientOnly ? styles.tabActive : ""}`}
                    aria-pressed={infoRecipientOnly}
                    onClick={() => setInfoRecipientOnly((value) => !value)}
                    title="Показать письма, где получатель содержит info (info@turbo-don.ru и т.п.)"
                  >
                    Только info
                  </button>
                </div>
                <div className={styles.dateFilters}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    aria-label="Дата с"
                    title="Дата с"
                  />
                  <span className={styles.dateSeparator}>—</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    aria-label="Дата по"
                    title="Дата по"
                  />
                  {dateFrom || dateTo ? (
                    <button
                      type="button"
                      className={styles.clearFiltersButton}
                      onClick={handleClearDateFilters}
                    >
                      Сбросить даты
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={styles.tabs} role="tablist" aria-label="Фильтр по статусу">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === tab.id}
                    className={`${styles.tab} ${statusFilter === tab.id ? styles.tabActive : ""}`}
                    onClick={() => setStatusFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {isListBackgroundFetching ? (
            <div className={styles.listFetchingBar} role="status" aria-live="polite">
              <LoaderCircle size={14} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
              <span>{isSearchDebouncing ? "Ищем…" : "Обновляем список…"}</span>
            </div>
          ) : null}

          {!messages.length ? (
            isListBackgroundFetching || messagesQuery.isPlaceholderData ? (
              <div className={styles.emptyStateCompact}>Загружаем письма…</div>
            ) : (
              <div className={styles.emptyStateCompact}>Писем по выбранному фильтру пока нет.</div>
            )
          ) : viewMode === "table" ? (
            <div className={styles.tableHost}>
            <div
              className={styles.reviewHotbar}
              role="tablist"
              aria-label="Фильтр по проверке оператором"
            >
              {REVIEW_STATE_TABS.map((tab) => {
                const count = operatorReviewCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={reviewStateFilter === tab.id}
                    className={`${styles.reviewHotbarTab} ${styles[`reviewHotbarTab_${tab.tone}`]} ${
                      reviewStateFilter === tab.id ? styles.reviewHotbarTabActive : ""
                    }`}
                    onClick={() => setReviewStateFilter(tab.id)}
                  >
                    <span>{tab.label}</span>
                    <span className={styles.reviewHotbarCount}>{count}</span>
                  </button>
                );
              })}
              {reviewStateFilter !== "all" ? (
                <span className={styles.reviewHotbarHint}>
                  В таблице {filteredTableMessages.length} из {loadedCount} загруженных · в базе{" "}
                  {operatorReviewCounts[reviewStateFilter]}
                </span>
              ) : null}
            </div>
            {filteredTableMessages.length === 0 ? (
              <div className={styles.emptyStateCompact}>
                {messages.length
                  ? "В выбранной категории нет писем среди загруженных."
                  : "Писем по выбранному фильтру пока нет."}
              </div>
            ) : (
            <IncomingMailTable
              messages={filteredTableMessages}
              selectedId={selectedId}
              hasMore={hasMore}
              isLoadingMore={messagesQuery.isFetchingNextPage}
              loadedCount={loadedCount}
              totalCount={totalCount}
              tableScrollRef={tableScrollRef}
              departmentOptions={departmentOptions}
              organizationOptions={organizationOptions}
              canEditRouting={canChangeDepartment}
              onLoadMore={handleTableLoadMore}
              onSelectMessage={handleSelectMessage}
              onOpenMessageAttachments={handleOpenMessageAttachments}
              onOperatorApprove={handleTableOperatorApprove}
              onOperatorCorrect={handleTableOperatorCorrect}
              onSpamConfirm={handleTableSpamConfirm}
              onSpamReject={handleTableSpamReject}
              onInlineFieldSave={handleTableInlineFieldSave}
              onExportError={(text) => setFeedback({ type: "error", text })}
              dateSortOrder={tableDateSort}
              onDateSortToggle={handleTableDateSortToggle}
              isBusy={isBusy}
            />
            )}
            </div>
          ) : (
            <div
              className={`${styles.requestList} ${isListDimmed ? styles.requestListFetching : ""}`}
            >
              {groupedMessages.map((group) => (
                <section key={group.dayKey} className={styles.dateGroup} aria-label={group.label}>
                  <h3 className={styles.dateGroupHeader}>{group.label}</h3>
                  {group.messages.map((message) => {
                    const subject = messagePreview(message);
                    const sender = senderShortName(message);
                    return (
                      <button
                        key={message.id}
                        type="button"
                        className={`${styles.requestItem} ${
                          selectedMessage?.id === message.id ? styles.requestItemActive : ""
                        }`}
                        onClick={() => handleSelectMessage(message)}
                      >
                        <span className={styles.requestSubject} title={subject}>
                          {subject}
                        </span>
                        <span className={styles.requestItemSub}>
                          <span
                            className={styles.requestSender}
                            title={message.sender_name ?? message.sender_email}
                          >
                            {sender}
                          </span>
                          <time className={styles.requestDate} dateTime={message.received_at ?? undefined}>
                            {formatDate(message.received_at)}
                          </time>
                        </span>
                        <span
                          className={`${styles.statusBadge} ${styles.statusBadgeCompact} ${statusTone(message.status)}`}
                        >
                          {STATUS_LABELS[message.status]}
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))}
              <div ref={listSentinelRef} className={styles.listSentinel} aria-hidden="true" />
              <div className={styles.listFooter}>
                {messagesQuery.isFetchingNextPage ? (
                  <span className={styles.listFooterStatus}>
                    <LoaderCircle size={14} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
                    Загружаем ещё…
                  </span>
                ) : hasMore ? (
                  <span className={styles.listFooterStatus}>
                    Показано {loadedCount} из {totalCount}. Прокрутите вниз для загрузки.
                  </span>
                ) : (
                  <span className={styles.listFooterStatus}>
                    Показано {loadedCount} из {totalCount}
                  </span>
                )}
              </div>
            </div>
          )}
        </aside>

        <div
          className={
            viewMode === "table"
              ? `${styles.detailDrawer} ${tableDrawerOpen ? styles.detailDrawerVisible : ""}`
              : styles.detailDrawerInline
          }
        >
        <main className={styles.contentCard}>
          {tableDrawerOpen && selectedMessage ? (
            <div className={styles.detailDrawerHeader}>
              <h2 className={styles.detailDrawerTitle}>{messagePreview(selectedMessage)}</h2>
              <button
                type="button"
                className={styles.detailDrawerClose}
                onClick={handleCloseDrawer}
                aria-label="Закрыть детали"
              >
                ×
              </button>
            </div>
          ) : null}
          {processingLabel ? (
            <div className={styles.processingBanner} role="status" aria-live="polite">
              <LoaderCircle size={18} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
              <span>{processingLabel}</span>
            </div>
          ) : null}

          {feedback?.type === "error" ? (
            <div className={styles.errorCallout} role="alert">
              <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
              <p>{feedback.text}</p>
            </div>
          ) : null}

          {feedback?.type === "success" ? (
            <div className={styles.infoCallout}>
              <CheckCircle2 size={18} strokeWidth={2.1} aria-hidden="true" />
              <p>{feedback.text}</p>
            </div>
          ) : null}

          {!selectedMessage ? (
            viewMode === "table" ? null : (
            <div className={styles.emptyState}>Выберите письмо из списка слева.</div>
            )
          ) : (
            <>
              {viewMode !== "table" ? (
              <div>
                <h2>{messagePreview(selectedMessage)}</h2>
                <p className={styles.contentIntro}>{formatMailHeaderLine(selectedMessage)}</p>
              </div>
              ) : (
              <p className={styles.contentIntro}>{formatMailHeaderLine(selectedMessage)}</p>
              )}

              <div className={styles.detailSection}>
                {selectedMessage.summary_ru ? (
                  <div className={styles.detailBlock}>
                    <span className={styles.detailBlockTitle}>Обзор агента</span>
                    <p className={styles.detailText}>{selectedMessage.summary_ru}</p>
                  </div>
                ) : null}

                <div className={styles.detailBlock}>
                  <span className={styles.detailBlockTitle}>Спам-анализ</span>
                  <p className={styles.detailText}>
                    {selectedMessage.is_spam ? "Спам" : "Не спам"} · вероятность спама{" "}
                    <span className={styles.confidenceBadge}>
                      {formatConfidence(selectedMessage.spam_confidence)}
                    </span>
                    {selectedMessage.spam_reason ? `\nПричина: ${selectedMessage.spam_reason}` : ""}
                  </p>
                  <div className={styles.spamMarkRow}>
                    <label className={styles.spamMarkLabel} htmlFor="drawer-spam-mark">
                      Отметка оператора
                    </label>
                    <select
                      id="drawer-spam-mark"
                      className={`${styles.detailSpamSelect} ${spamSelectClass(selectedMessage)} ${
                        drawerSpamDisabled ? tableStyles.markSelectDisabled : ""
                      }`}
                      aria-label="Отметка спама"
                      title={
                        drawerSpamDisabled
                          ? drawerSpamMarks.disabledReason
                          : "Выберите «Спам» или «Не спам»"
                      }
                      value={drawerSpamValue}
                      disabled={drawerSpamDisabled}
                      onChange={(event) =>
                        handleDrawerSpamChange(event.target.value as "" | "confirm" | "reject")
                      }
                    >
                      <option value="">—</option>
                      {drawerSpamMarks.confirm ? (
                        <option value="confirm" className={tableStyles.markReject}>
                          Спам
                        </option>
                      ) : null}
                      {drawerSpamMarks.reject ? (
                        <option value="reject" className={tableStyles.markOk}>
                          Не спам
                        </option>
                      ) : null}
                    </select>
                  </div>
                </div>

                {selectedMessage.status === "awaiting_human" ? (
                  <div className={styles.warningCallout}>
                    <ShieldAlert size={18} strokeWidth={2.1} aria-hidden="true" />
                    <p>
                      {selectedMessage.hitl_reason?.trim()
                        ? selectedMessage.hitl_reason
                        : "Письмо в серой зоне или с низкой уверенностью маршрутизации. Подтвердите отдел или отметьте как спам."}
                    </p>
                  </div>
                ) : null}

                <div className={styles.detailBlock}>
                  <button
                    type="button"
                    className={styles.detailBlockToggle}
                    aria-expanded={emailBodyExpanded}
                    onClick={() => void handleToggleEmailBody()}
                  >
                    <span className={styles.detailBlockTitle}>Содержимое письма</span>
                    <span className={styles.detailBlockToggleLabel}>
                      {emailBodyExpanded ? "Свернуть" : "Развернуть"}
                      {emailBodyExpanded ? (
                        <ChevronUp size={16} strokeWidth={2.2} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
                      )}
                    </span>
                  </button>
                  {emailBodyExpanded ? (
                    emailBodyLoading ? (
                      <p className={styles.detailTextMuted} role="status" aria-live="polite">
                        <LoaderCircle
                          size={16}
                          strokeWidth={2.2}
                          className={styles.spin}
                          aria-hidden="true"
                        />{" "}
                        Загружаем текст письма из почтового ящика…
                      </p>
                    ) : emailBodyError ? (
                      <p className={styles.detailTextMuted} role="alert">
                        {emailBodyError}
                      </p>
                    ) : (
                      <p className={styles.detailText}>
                        {!isBodyMissing(emailBodyText ?? selectedMessage.body_text) ? (
                          emailBodyText ?? selectedMessage.body_text
                        ) : (
                          <span className={styles.detailTextMuted}>Текст письма недоступен</span>
                        )}
                      </p>
                    )
                  ) : null}
                </div>

                <div ref={attachmentsSectionRef} className={styles.detailBlock}>
                  <span className={styles.detailBlockTitle}>Вложенные файлы</span>
                  {(selectedMessage.attachments?.length ?? 0) > 0 ? (
                    <div className={styles.fileList}>
                      {selectedMessage.attachments!.map((att, idx) => {
                        const index = attachmentIndex(att, idx);
                        const sizeLabel = formatFileSize(att.size_bytes);
                        const previewKind = attachmentPreviewKind(att);
                        const isDownloading = downloadingAttachmentIndex === index;
                        const isPreviewing = previewingAttachmentIndex === index;
                        return (
                          <div key={`${index}-${att.filename}`} className={styles.fileRow}>
                            <div>
                              <div className={styles.fileName}>{att.filename || `Файл ${index + 1}`}</div>
                              {sizeLabel || att.mime_type ? (
                                <div className={styles.fileMeta}>
                                  {[sizeLabel, att.mime_type].filter(Boolean).join(" · ")}
                                </div>
                              ) : null}
                            </div>
                            <div className={styles.fileActions}>
                              {previewKind ? (
                                <button
                                  type="button"
                                  className={styles.primaryButton}
                                  disabled={isBusy || isPreviewing}
                                  onClick={() => void handlePreviewAttachment(att, idx)}
                                >
                                  {isPreviewing ? (
                                    <LoaderCircle
                                      size={16}
                                      strokeWidth={2.2}
                                      className={styles.spin}
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
                                  )}
                                  Просмотр
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                disabled={isBusy || downloadingAttachmentIndex != null || downloadingXml}
                                onClick={() => void handleDownloadAttachment(att, idx)}
                              >
                                {isDownloading ? (
                                  <LoaderCircle
                                    size={16}
                                    strokeWidth={2.2}
                                    className={styles.spin}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Download size={16} strokeWidth={2.2} aria-hidden="true" />
                                )}
                                Скачать
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (selectedMessage.attachments_count ?? 0) > 0 ? (
                    <p className={styles.detailTextMuted}>
                      Список вложений недоступен ({selectedMessage.attachments_count})
                    </p>
                  ) : (
                    <p className={styles.detailTextMuted}>Нет вложений</p>
                  )}
                </div>
              </div>

              <div className={styles.actionsRow}>
                {selectedMessage.status === "spam" ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={isBusy}
                    onClick={() => restoreMutation.mutate(selectedMessage.id)}
                  >
                    <RotateCcw size={16} strokeWidth={2.2} aria-hidden="true" />
                    Восстановить из спама
                  </button>
                ) : null}

                {selectedMessage.status === "done" || selectedMessage.status === "error" ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={isBusy}
                    onClick={() => retryErpMutation.mutate(selectedMessage.id)}
                  >
                    <Mail size={16} strokeWidth={2.2} aria-hidden="true" />
                    Повторить 1С
                  </button>
                ) : null}

                {selectedMessage.status === "awaiting_human" ? (
                  <>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      disabled={isBusy}
                      onClick={() =>
                        resolveMutation.mutate({ id: selectedMessage.id, decision: "mark_spam" })
                      }
                    >
                      Отметить спам
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={isBusy}
                      onClick={() =>
                        resolveMutation.mutate({ id: selectedMessage.id, decision: "mark_not_spam" })
                      }
                    >
                      Не спам, переобработать
                    </button>
                  </>
                ) : null}
              </div>

              {canChangeDepartment(selectedMessage.status) ? (
                <div className={styles.hitlForm} ref={hitlFormRef}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Партнёр (контрагент)</span>
                    <input
                      type="text"
                      className={controlStyles.control}
                      value={hitlPartnerName}
                      placeholder="Введите наименование организации"
                      aria-label="Партнёр (контрагент)"
                      onChange={(event) => {
                        const value = event.target.value;
                        setHitlPartnerName(value);
                        setHitlContractorId("");
                        setContractorSearchQuery(value);
                        setPartnerSuggestionsOpen(true);
                      }}
                    />
                    {partnerSuggestionsOpen && debouncedContractorSearch.length >= 2 ? (
                      <ul className={styles.partnerSuggestions} aria-label="Подсказки из справочника">
                        {contractorsQuery.isFetching ? (
                          <li className={styles.partnerSuggestionHint}>Поиск в справочнике…</li>
                        ) : contractorOptions.length ? (
                          contractorOptions.map((option) => (
                            <li key={option.value}>
                              <button
                                type="button"
                                className={styles.partnerSuggestionButton}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setHitlPartnerName(option.name);
                                  setHitlContractorId(option.value);
                                  setContractorSearchQuery(option.name);
                                  setPartnerSuggestionsOpen(false);
                                }}
                              >
                                {option.label}
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className={styles.partnerSuggestionHint}>
                            В справочнике не найдено — будет сохранено введённое название
                          </li>
                        )}
                      </ul>
                    ) : null}
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Организация</span>
                    <FormSelect
                      value={hitlOrganization}
                      onChange={setHitlOrganization}
                      options={organizationOptions}
                      ariaLabel="Организация"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Отдел для маршрутизации</span>
                    <FormAutocomplete
                      value={hitlDepartmentId}
                      onChange={setHitlDepartmentId}
                      options={departmentOptions}
                      placeholder="Начните вводить код или название отдела"
                      emptyValue=""
                      emptyLabel="Выберите отдел"
                      noResultsText="Отдел не найден"
                      ariaLabel="Отдел для маршрутизации"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Процесс документа</span>
                    <FormSelect
                      value={hitlProcess}
                      onChange={setHitlProcess}
                      options={[...PROCESS_OPTIONS]}
                      ariaLabel="Процесс документа"
                    />
                  </label>
                  <div className={styles.actionsRow}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={isBusy}
                      onClick={() => reanalyzeMutation.mutate(selectedMessage.id)}
                    >
                      <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
                      ПЕРЕДЕЛАТЬ
                    </button>
                    {selectedMessage.status === "done" || selectedMessage.status === "error" ? (
                      selectedMessage.operator_verified ? (
                        <span className={styles.verifiedBadge} title="Письмо проверено оператором">
                          <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                          Проверено оператором
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          disabled={isBusy || !hitlDepartmentId}
                          onClick={handleMarkVerified}
                        >
                          <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden="true" />
                          Проверено
                        </button>
                      )
                    ) : null}
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={isBusy || !hitlDepartmentId}
                      onClick={handleApproveRouting}
                    >
                      <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden="true" />
                      {departmentActionLabel(selectedMessage.status)}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </main>

        {viewMode !== "table" ? (
        <aside className={styles.summaryCard} aria-label="Сводка письма">
          <h2>Сводка</h2>
          {!selectedMessage ? (
            <div className={styles.emptyState}>Нет выбранного письма.</div>
          ) : (
            <MessageSummaryBody
              message={selectedMessage}
              onDownloadXml={() => void handleDownloadXml()}
              downloadingXml={downloadingXml}
              downloadDisabled={isBusy || downloadingAttachmentIndex != null}
            />
          )}
        </aside>
        ) : null}
        </div>
      </div>

      {attachmentPreviewVisible ? (
        <div
          className={styles.attachmentModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="attachmentPreviewTitle"
        >
          <button
            type="button"
            className={styles.attachmentModalBackdrop}
            aria-label="Закрыть просмотр"
            onClick={closeAttachmentPreview}
          />
          <div className={styles.attachmentModalPanel}>
            <div className={styles.attachmentModalHeader}>
              <div id="attachmentPreviewTitle" className={styles.attachmentModalTitle}>
                {attachmentPreview?.filename || previewFilename || "Просмотр вложения"}
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeAttachmentPreview}
              >
                Закрыть
              </button>
            </div>
            <div className={styles.attachmentModalBody}>
              {attachmentPreviewLoading ? (
                <p className={styles.attachmentModalStatus}>
                  <LoaderCircle
                    size={18}
                    strokeWidth={2.2}
                    className={styles.spin}
                    aria-hidden="true"
                  />{" "}
                  Загружаем из IMAP…
                </p>
              ) : attachmentPreviewError ? (
                <p className={styles.attachmentModalError} role="alert">
                  {attachmentPreviewError}
                </p>
              ) : attachmentPreview?.kind === "image" ? (
                <img
                  src={attachmentPreview.blobUrl}
                  alt={attachmentPreview.filename}
                  className={styles.attachmentPreviewImage}
                />
              ) : attachmentPreview?.kind === "pdf" ? (
                <iframe
                  src={attachmentPreview.blobUrl}
                  title={attachmentPreview.filename}
                  className={styles.attachmentPreviewPdf}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
