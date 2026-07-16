import { useEffect, useMemo, useRef, useState } from "react";
import {
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
  LoaderCircle,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { emailMessagesApi } from "@/api/endpoints";
import { FormAutocomplete, FormCheckbox, FormSelect } from "@/components/form-controls";
import controlStyles from "@/components/form-controls/form-controls.module.css";
import LoadingPanel from "@/components/LoadingPanel";
import type { DocumentXml, EmailMessage, EmailMessageStatus } from "@/types";
import styles from "./IncomingMail.module.css";

const AGENT_TITLE = "Входящая корреспонденция";
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 450;
const AGENT_DESCRIPTION =
  "ИИ-агент обрабатывает входящую почту: фильтрует спам, определяет отправителя и отдел, формирует обзор и создаёт задачу в 1С:ERP.";

type StatusFilter = "all" | EmailMessageStatus;

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
  awaiting_human: "На проверке"
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

function DocumentXmlSummary({ document }: { document: DocumentXml | null | undefined }) {
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
    </div>
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

function partnerDisplayValue(partner: string | null | undefined): string {
  const value = partner?.trim();
  if (!value || value === "-") return "";
  return value;
}

function departmentActionLabel(status: EmailMessageStatus): string {
  return status === "awaiting_human" ? "Подтвердить отдел" : "Изменить отдел";
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

export default function IncomingMail() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [onlyInfoToTestIi, setOnlyInfoToTestIi] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hitlDepartmentId, setHitlDepartmentId] = useState("");
  const [hitlPartnerName, setHitlPartnerName] = useState("");
  const [hitlContractorId, setHitlContractorId] = useState("");
  const [hitlProcess, setHitlProcess] = useState("исполнение");
  const [hitlOrganization, setHitlOrganization] = useState("НП");
  const [contractorSearchQuery, setContractorSearchQuery] = useState("");
  const [debouncedContractorSearch, setDebouncedContractorSearch] = useState("");
  const [emailBodyExpanded, setEmailBodyExpanded] = useState(false);
  const [emailBodyText, setEmailBodyText] = useState<string | null>(null);
  const [emailBodyLoading, setEmailBodyLoading] = useState(false);
  const [emailBodyError, setEmailBodyError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const pipelineListRef = useRef<HTMLDivElement>(null);
  const listSentinelRef = useRef<HTMLDivElement>(null);
  const [pipelineMaxPerRow, setPipelineMaxPerRow] = useState<number>(estimateInitialPipelineMaxPerRow);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const listFilters = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      q: debouncedSearch || undefined,
      only_info_to_test_ii: onlyInfoToTestIi ? true : undefined
    }),
    [statusFilter, dateFrom, dateTo, debouncedSearch, onlyInfoToTestIi]
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
    refetchInterval: 30_000,
    staleTime: 10_000
  });

  const statsQuery = useQuery({
    queryKey: ["email-messages", "stats", dateFrom, dateTo, debouncedSearch, onlyInfoToTestIi],
    queryFn: () =>
      emailMessagesApi.stats({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        q: debouncedSearch || undefined,
        only_info_to_test_ii: onlyInfoToTestIi ? true : undefined
      }),
    refetchInterval: 30_000,
    staleTime: 10_000
  });

  const messages = useMemo(
    () => messagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [messagesQuery.data]
  );

  const totalCount = messagesQuery.data?.pages[0]?.total ?? 0;
  const loadedCount = messages.length;
  const hasMore = loadedCount < totalCount;

  const stats = useMemo(() => {
    const data = statsQuery.data;
    if (!data) {
      return { total: 0, done: 0, spam: 0, review: 0 };
    }
    return {
      total: data.total,
      done: data.by_status.done ?? 0,
      spam: data.by_status.spam ?? 0,
      review: data.by_status.awaiting_human ?? 0
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
    if (!selectedId || messagesQuery.isFetching) return;
    if (!messages.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [messages, selectedId, messagesQuery.isFetching]);

  useEffect(() => {
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
    loadedCount
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

    if (!messages.length) return null;
    const first = messages[0];
    return detail && detail.id === first.id ? { ...first, ...detail } : first;
  }, [messages, selectedId, selectedDetailQuery.data]);

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
    setEmailBodyExpanded(false);
    setEmailBodyText(null);
    setEmailBodyLoading(false);
    setEmailBodyError(null);
  }, [selectedMessage?.id, selectedMessage?.department_id, selectedMessage?.partner_name, selectedMessage?.contractor_id, selectedMessage?.document_xml?.partner, selectedMessage?.document_xml?.process, selectedMessage?.document_xml?.organization]);

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

  const resolveMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      decision: "approve_routing" | "mark_spam" | "mark_not_spam";
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
        variables.decision === "approve_routing"
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
    restoreMutation.isPending || retryErpMutation.isPending || resolveMutation.isPending;

  const processingLabel = restoreMutation.isPending
    ? "Восстанавливаем письмо из спама…"
    : retryErpMutation.isPending
      ? "Планируем повтор отправки в 1С…"
      : resolveMutation.isPending
        ? "Сохраняем решение human-in-the-loop…"
        : null;

  const pipelineProgress = selectedMessage
    ? pipelineIndexForStatus(selectedMessage.status)
    : -1;

  function handleRefreshList() {
    void messagesQuery.refetch();
    void statsQuery.refetch();
  }

  function handleClearDateFilters() {
    setDateFrom("");
    setDateTo("");
  }

  const isSearchDebouncing = searchQuery.trim() !== debouncedSearch;
  const isListFilterFetching =
    (messagesQuery.isFetching && !messagesQuery.isFetchingNextPage) || statsQuery.isFetching;
  const isListBackgroundFetching = isListFilterFetching || isSearchDebouncing;
  const isListFetching = isListBackgroundFetching;

  function handleSelectMessage(message: EmailMessage) {
    setSelectedId(message.id);
    setFeedback(null);
  }

  async function handleToggleEmailBody() {
    const nextExpanded = !emailBodyExpanded;
    setEmailBodyExpanded(nextExpanded);
    if (!nextExpanded || !selectedMessage) return;

    const currentBody = emailBodyText ?? selectedMessage.body_text;
    if (!isBodyMissing(currentBody)) return;

    setEmailBodyLoading(true);
    setEmailBodyError(null);
    try {
      const result = await emailMessagesApi.fetchBody(selectedMessage.id);
      setEmailBodyText(result.body_text);
      queryClient.setQueryData(
        ["email-messages", "detail", selectedMessage.id],
        (old: EmailMessage | undefined) =>
          old ? { ...old, body_text: result.body_text } : old
      );
    } catch (error) {
      setEmailBodyError(extractError(error));
    } finally {
      setEmailBodyLoading(false);
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

  const isInitialLoading = messagesQuery.isLoading && !messagesQuery.isPlaceholderData;

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
          <p>
            Не удалось загрузить письма. Запустите API agent-pochta:{" "}
            <code>python scripts/run_api.py</code> (порт 8080).
          </p>
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
    <div className={styles.page} data-incoming-mail-page>
      <header className={styles.header}>
        <Link to="/agents" className={styles.backLink}>
          <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
          Каталог агентов
        </Link>
        <div className={styles.headerRow}>
          <div>
            <h1>{AGENT_TITLE}</h1>
            <p>{AGENT_DESCRIPTION}</p>
          </div>
          <span className={styles.agentBadge}>
            <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
            agent_pochta · v0.2
          </span>
        </div>
      </header>

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
      </section>

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

      <div className={styles.layout}>
        <aside className={styles.requestsCard} aria-label="Список писем">
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
            <FormCheckbox
              className={styles.infoOnlyFilter}
              checked={onlyInfoToTestIi}
              onChange={setOnlyInfoToTestIi}
              label="info@ → test_ii@"
            />
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

          {isListBackgroundFetching ? (
            <div className={styles.listFetchingBar} role="status" aria-live="polite">
              <LoaderCircle size={14} strokeWidth={2.2} className={styles.spin} aria-hidden="true" />
              <span>{isSearchDebouncing ? "Ищем…" : "Обновляем список…"}</span>
            </div>
          ) : null}

          {!messages.length ? (
            isListBackgroundFetching ? (
              <div className={styles.emptyStateCompact}>Загружаем письма…</div>
            ) : (
              <div className={styles.emptyStateCompact}>Писем по выбранному фильтру пока нет.</div>
            )
          ) : (
            <div
              className={`${styles.requestList} ${isListBackgroundFetching ? styles.requestListFetching : ""}`}
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

        <main className={styles.contentCard}>
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
            <div className={styles.emptyState}>Выберите письмо из списка слева.</div>
          ) : (
            <>
              <div>
                <h2>{messagePreview(selectedMessage)}</h2>
                <p className={styles.contentIntro}>{formatMailHeaderLine(selectedMessage)}</p>
              </div>

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
                    {selectedMessage.is_spam ? "Спам" : "Не спам"} · уверенность{" "}
                    <span className={styles.confidenceBadge}>
                      {formatConfidence(selectedMessage.spam_confidence)}
                    </span>
                    {selectedMessage.spam_reason ? `\nПричина: ${selectedMessage.spam_reason}` : ""}
                  </p>
                  {(selectedMessage.status === "done" || selectedMessage.status === "error") ? (
                    <div className={styles.actionsRow}>
                      <button
                        type="button"
                        className={styles.spamButton}
                        disabled={isBusy}
                        onClick={() =>
                          resolveMutation.mutate({ id: selectedMessage.id, decision: "mark_spam" })
                        }
                      >
                        Отметить спам
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedMessage.status === "awaiting_human" ? (
                  <div className={styles.warningCallout}>
                    <ShieldAlert size={18} strokeWidth={2.1} aria-hidden="true" />
                    <p>
                      Письмо в серой зоне или с низкой уверенностью маршрутизации. Подтвердите отдел
                      или отметьте как спам.
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
                <div className={styles.hitlForm}>
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
                      }}
                    />
                    {debouncedContractorSearch.length >= 2 ? (
                      <ul className={styles.partnerSuggestions} aria-label="Подсказки из справочника">
                        {contractorsQuery.isFetching ? (
                          <li className={styles.partnerSuggestionHint}>Поиск в справочнике…</li>
                        ) : contractorOptions.length ? (
                          contractorOptions.map((option) => (
                            <li key={option.value}>
                              <button
                                type="button"
                                className={styles.partnerSuggestionButton}
                                onClick={() => {
                                  const contractor = (contractorsQuery.data ?? []).find(
                                    (item) => item.contractor_id === option.value
                                  );
                                  if (!contractor) return;
                                  setHitlPartnerName(contractor.name);
                                  setHitlContractorId(contractor.contractor_id);
                                  setContractorSearchQuery(contractor.name);
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

        <aside className={styles.summaryCard} aria-label="Сводка письма">
          <h2>Сводка</h2>
          {!selectedMessage ? (
            <div className={styles.emptyState}>Нет выбранного письма.</div>
          ) : (
            <>
              <div className={styles.summaryBlock}>
                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Статус</span>
                    <span className={`${styles.statusBadge} ${statusTone(selectedMessage.status)}`}>
                      {STATUS_LABELS[selectedMessage.status]}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>От кого</span>
                    <span className={styles.summaryValue}>{formatSenderLine(selectedMessage)}</span>
                  </div>
                  {formatRecipientAddress(selectedMessage) ? (
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Кому</span>
                      <span className={styles.summaryValue}>
                        {formatRecipientAddress(selectedMessage)}
                      </span>
                    </div>
                  ) : null}
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Наш ящик</span>
                    <span className={styles.summaryValue}>{selectedMessage.mailbox}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Получено</span>
                    <span className={styles.summaryValue}>{formatDate(selectedMessage.received_at)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Обработано</span>
                    <span className={styles.summaryValue}>{formatDate(selectedMessage.processed_at)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Вложения</span>
                    <span className={styles.summaryValue}>{selectedMessage.attachments_count ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className={styles.summaryBlock}>
                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Отдел</span>
                    <span className={styles.summaryValue}>
                      {selectedMessage.department_name ?? "—"}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Уверенность отдела</span>
                    <span className={styles.summaryValue}>
                      {formatConfidence(selectedMessage.dept_confidence)}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Приоритет</span>
                    <span className={styles.summaryValue}>{selectedMessage.priority ?? "—"}</span>
                  </div>
                </div>
              </div>

              {!isSpamMessage(selectedMessage) ? (
                <DocumentXmlSummary document={selectedMessage.document_xml} />
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
