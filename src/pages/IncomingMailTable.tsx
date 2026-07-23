import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { isAxiosError } from "axios";

import { emailMessagesApi } from "@/api/endpoints";
import type { EmailMessage, EmailMessageStatus } from "@/types";

import styles from "./IncomingMailTable.module.css";



export type OperatorReviewStateFilter = "all" | "pending" | "verified" | "corrected";

export type TableDateSort = "asc" | "desc";

export type ExportReportPeriod = "day" | "week" | "month";

type OperatorMarkAction = "" | "approve" | "correct";

type SpamMarkAction = "" | "confirm" | "reject";

const STICKY_H_SCROLL_HEIGHT = 14;



export type InlineEditField = "partner" | "organization" | "department_id";



export interface SelectOption {

  value: string;

  label: string;

}



export interface InlineFieldSavePayload {

  field: InlineEditField;

  value: string;

  department_id?: string;

  department_name?: string;

}



export interface IncomingMailTableProps {

  messages: EmailMessage[];

  selectedId: string | null;

  hasMore: boolean;

  isLoadingMore: boolean;

  loadedCount: number;

  totalCount: number;

  tableScrollRef: React.RefObject<HTMLDivElement | null>;

  departmentOptions: SelectOption[];

  organizationOptions: SelectOption[];

  canEditRouting: (status: EmailMessageStatus) => boolean;

  onLoadMore: () => void;

  onSelectMessage: (message: EmailMessage) => void;

  onOpenMessageAttachments: (message: EmailMessage) => void;

  onOperatorApprove: (message: EmailMessage) => void;

  onOperatorCorrect: (message: EmailMessage) => void;

  onSpamConfirm: (message: EmailMessage) => void;

  onSpamReject: (message: EmailMessage) => void;

  onInlineFieldSave: (message: EmailMessage, payload: InlineFieldSavePayload) => void;

  onExportError?: (message: string) => void;

  dateSortOrder: TableDateSort;

  onDateSortToggle: () => void;

  isBusy?: boolean;

}



function formatTableDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow"
    })
    .replace(",", "");
}



export function normalizeOperatorReviewState(

  state: EmailMessage["operator_review_state"]

): Exclude<OperatorReviewStateFilter, "all"> {

  if (state === "verified" || state === "corrected") return state;

  return "pending";

}



function rowStateClass(state: EmailMessage["operator_review_state"]): string {

  if (state === "corrected") return styles.rowCorrected;

  if (state === "verified") return styles.rowVerified;

  return styles.rowPending;

}



function cell(value: string | null | undefined): string {

  const text = (value ?? "").trim();

  return text || "—";

}

function documentCategoryLabel(message: EmailMessage): string {
  const label = message.document_category_label?.trim();
  if (label) return label;
  if (message.is_dialog) return "Диалог";
  return "—";
}

function documentCategoryTitle(message: EmailMessage): string | undefined {
  const label = documentCategoryLabel(message);
  if (label === "—") return undefined;
  const mode = message.dialog_mode?.trim();
  if (message.is_dialog && mode) {
    return `${label} · режим: ${mode}`;
  }
  return label;
}

function isDialogCategory(message: EmailMessage): boolean {
  return message.is_dialog || documentCategoryLabel(message) === "Диалог";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function extractBlobError(error: unknown): Promise<string> {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "Не удалось связаться с API agent-pochta. Проверьте, что сервер запущен на :8080.";
    }
    if (error.response.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const parsed = JSON.parse(text) as { detail?: string };
        if (typeof parsed.detail === "string") {
          return parsed.detail;
        }
      } catch {
        // fall through
      }
    }
    const detail = error.response.data as { detail?: string } | undefined;
    if (typeof detail?.detail === "string") {
      return detail.detail;
    }
  }
  return error instanceof Error ? error.message : "Не удалось сформировать отчёт";
}

async function ensureXlsxBlob(blob: Blob): Promise<void> {
  const header = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (header[0] === 0x50 && header[1] === 0x4b) {
    return;
  }
  const text = await blob.text();
  try {
    const parsed = JSON.parse(text) as { detail?: string };
    if (typeof parsed.detail === "string") {
      throw new Error(parsed.detail);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Сервер вернул некорректный файл отчёта");
    }
    throw error;
  }
  throw new Error("Сервер вернул некорректный файл отчёта");
}



interface OperatorMarkAvailability {
  approve: boolean;
  correct: boolean;
  disabledReason?: string;
}

interface SpamMarkAvailability {
  confirm: boolean;
  reject: boolean;
  disabledReason?: string;
}

function isOperatorMarkDisabled(status: EmailMessageStatus, isBusy: boolean): boolean {
  return isBusy || status === "processing" || status === "spam";
}

function isSpamMarkDisabled(
  spamMarks: SpamMarkAvailability,
  isBusy: boolean
): boolean {
  return isBusy || (!spamMarks.confirm && !spamMarks.reject);
}

function operatorMarkAvailability(status: EmailMessageStatus): OperatorMarkAvailability {
  if (status === "spam") {
    return {
      approve: false,
      correct: false,
      disabledReason: "Письмо в спаме — используйте колонку «Спам»"
    };
  }
  if (status === "processing") {
    return {
      approve: false,
      correct: false,
      disabledReason: "Дождитесь обработки"
    };
  }
  return { approve: true, correct: true };
}

function spamMarkAvailability(
  status: EmailMessageStatus,
  isSpam: boolean
): SpamMarkAvailability {
  if (status === "spam") {
    return { confirm: false, reject: true };
  }
  if (status === "processing" || status === "done" || status === "error" || status === "awaiting_human") {
    return {
      confirm: true,
      reject: status === "awaiting_human" || isSpam
    };
  }
  return { confirm: true, reject: false };
}

function hasDepartmentForApprove(message: EmailMessage): boolean {
  const departmentId = message.department_id?.trim();
  if (departmentId) return true;
  const fromXml = message.document_xml?.services?.[0]?.name?.trim();
  return Boolean(fromXml);
}



function spamCellClass(message: EmailMessage): string {

  if (message.status === "spam" || message.is_spam) return styles.spamCellReject;

  if (message.status === "done" && !message.is_spam) return styles.spamCellOk;

  return "";

}

function operatorSelectClass(state: EmailMessage["operator_review_state"]): string {
  if (state === "verified") return `${styles.markSelect} ${styles.markSelectOk}`;
  if (state === "corrected") return `${styles.markSelect} ${styles.markSelectReject}`;
  return styles.markSelect;
}

function spamSelectClass(message: EmailMessage): string {
  if (message.status === "spam" || message.is_spam) {
    return `${styles.markSelect} ${styles.markSelectReject}`;
  }
  if (message.status === "done" && !message.is_spam) {
    return `${styles.markSelect} ${styles.markSelectOk}`;
  }
  return styles.markSelect;
}



interface InlineEditableCellProps {

  message: EmailMessage;

  field: InlineEditField;

  value: string;

  displayValue?: string;

  className: string;

  title?: string;

  canEdit: boolean;

  inputType?: "text" | "select";

  options?: SelectOption[];

  onSave: (message: EmailMessage, payload: InlineFieldSavePayload) => void;

  requestEdit?: boolean;

  onEditRequested?: () => void;

}



function InlineEditableCell({

  message,

  field,

  value,

  displayValue,

  className,

  title,

  canEdit,

  inputType = "text",

  options,

  onSave,

  requestEdit = false,

  onEditRequested

}: InlineEditableCellProps) {

  const [editing, setEditing] = useState(false);

  const [draft, setDraft] = useState(value);



  useEffect(() => {

    setDraft(value);

  }, [value]);



  useEffect(() => {

    if (!requestEdit || !canEdit) return;

    setEditing(true);

    onEditRequested?.();

  }, [requestEdit, canEdit, onEditRequested]);



  const shown = cell(displayValue ?? value);



  function cancelEdit() {

    setDraft(value);

    setEditing(false);

  }



  function commitText() {

    const trimmed = draft.trim();

    const current = (value ?? "").trim();

    setEditing(false);

    if (trimmed && trimmed !== current) {

      onSave(message, { field, value: trimmed });

    }

  }



  function commitSelect(nextValue: string) {

    setDraft(nextValue);

    setEditing(false);

    if (!nextValue || nextValue === (value ?? "").trim()) return;



    if (field === "department_id") {

      const department = options?.find((option) => option.value === nextValue);

      onSave(message, {
        field: "department_id",
        value: nextValue,
        department_id: nextValue,
        department_name:
          department?.label.split(" · ").slice(1).join(" · ").trim() || undefined
      });

      return;

    }



    onSave(message, { field, value: nextValue });

  }



  if (!canEdit) {

    return (

      <td className={className} title={title}>

        {shown}

      </td>

    );

  }



  if (editing) {

    if (inputType === "select" && options?.length) {

      return (

        <td

          className={`${className} ${styles.editingCell}`}

          title={title}

          onClick={(event) => event.stopPropagation()}

        >

          <select

            className={styles.inlineInput}

            autoFocus

            value={draft || ""}

            aria-label="Редактирование"

            onChange={(event) => commitSelect(event.target.value)}

            onBlur={cancelEdit}

            onKeyDown={(event) => {

              if (event.key === "Escape") cancelEdit();

            }}

          >

            <option value="">—</option>

            {options.map((option) => (

              <option key={option.value} value={option.value}>

                {option.label}

              </option>

            ))}

          </select>

        </td>

      );

    }



    return (

      <td

        className={`${className} ${styles.editingCell}`}

        title={title}

        onClick={(event) => event.stopPropagation()}

      >

        <input

          className={styles.inlineInput}

          type="text"

          autoFocus

          value={draft}

          aria-label="Редактирование"

          onChange={(event) => setDraft(event.target.value)}

          onBlur={commitText}

          onKeyDown={(event) => {

            if (event.key === "Enter") {

              event.preventDefault();

              commitText();

            }

            if (event.key === "Escape") {

              event.preventDefault();

              cancelEdit();

            }

          }}

        />

      </td>

    );

  }



  return (

    <td

      className={`${className} ${styles.editableCell}`}

      title={title ? `${title} (нажмите для редактирования)` : "Нажмите для редактирования"}

      onClick={(event) => {

        event.stopPropagation();

        setEditing(true);

      }}

    >

      {shown}

    </td>

  );

}



export default function IncomingMailTable({

  messages,

  selectedId,

  hasMore,

  isLoadingMore,

  loadedCount,

  totalCount,

  tableScrollRef,

  departmentOptions,

  organizationOptions,

  canEditRouting,

  onLoadMore,

  onSelectMessage,

  onOpenMessageAttachments,

  onOperatorApprove,

  onOperatorCorrect,

  onSpamConfirm,

  onSpamReject,

  onInlineFieldSave,

  onExportError,

  dateSortOrder,

  onDateSortToggle,

  isBusy = false

}: IncomingMailTableProps) {

  const [markValues, setMarkValues] = useState<Record<string, OperatorMarkAction>>({});
  const [spamValues, setSpamValues] = useState<Record<string, SpamMarkAction>>({});
  const [departmentEditRequestId, setDepartmentEditRequestId] = useState<string | null>(null);
  const [exportPeriod, setExportPeriod] = useState<ExportReportPeriod>("day");
  const [isExporting, setIsExporting] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);

  const stickyTrackRef = useRef<HTMLDivElement>(null);

  const footerRef = useRef<HTMLDivElement>(null);

  const scrollSyncRef = useRef(false);

  const [stickyTrackVisible, setStickyTrackVisible] = useState(false);

  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);



  const updateStickyTrackGeometry = useCallback(() => {

    const scrollEl = tableScrollRef.current;

    const trackEl = stickyTrackRef.current;

    const tableEl = tableRef.current;

    const footerEl = footerRef.current;

    if (!scrollEl || !trackEl || !tableEl) return;



    const rect = scrollEl.getBoundingClientRect();

    const scrollWidth = Math.max(scrollEl.scrollWidth, tableEl.scrollWidth);

    const clientWidth = scrollEl.clientWidth;

    const hasOverflow = scrollWidth > clientWidth + 1;



    setStickyTrackVisible(hasOverflow);

    setHasHorizontalOverflow(hasOverflow);



    if (!hasOverflow) return;



    const footerTop = footerEl?.getBoundingClientRect().top ?? rect.bottom;

    const trackTop = Math.min(rect.bottom, footerTop) - STICKY_H_SCROLL_HEIGHT;



    trackEl.style.left = `${rect.left}px`;

    trackEl.style.width = `${rect.width}px`;

    trackEl.style.top = `${Math.max(rect.top, trackTop)}px`;



    const inner = trackEl.firstElementChild as HTMLElement | null;

    if (inner) {

      inner.style.width = `${scrollWidth}px`;

    }

  }, [tableScrollRef]);



  useLayoutEffect(() => {

    const scrollEl = tableScrollRef.current;

    const trackEl = stickyTrackRef.current;

    const tableEl = tableRef.current;

    if (!scrollEl || !trackEl || !tableEl) return;



    const syncFromBody = () => {

      if (scrollSyncRef.current) return;

      scrollSyncRef.current = true;

      trackEl.scrollLeft = scrollEl.scrollLeft;

      scrollSyncRef.current = false;

    };



    const syncFromTrack = () => {

      if (scrollSyncRef.current) return;

      scrollSyncRef.current = true;

      scrollEl.scrollLeft = trackEl.scrollLeft;

      scrollSyncRef.current = false;

    };



    const onWheel = (event: WheelEvent) => {

      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {

        event.preventDefault();

        scrollEl.scrollLeft += event.deltaX || event.deltaY;

        syncFromBody();

      }

    };



    scrollEl.addEventListener("scroll", syncFromBody);

    trackEl.addEventListener("scroll", syncFromTrack);

    scrollEl.addEventListener("wheel", onWheel, { passive: false });



    const resizeObserver = new ResizeObserver(() => {

      updateStickyTrackGeometry();

      syncFromBody();

    });

    resizeObserver.observe(scrollEl);

    resizeObserver.observe(tableEl);

    if (footerRef.current) {

      resizeObserver.observe(footerRef.current);

    }



    window.addEventListener("resize", updateStickyTrackGeometry);

    window.addEventListener("scroll", updateStickyTrackGeometry, true);



    updateStickyTrackGeometry();

    syncFromBody();



    return () => {

      scrollEl.removeEventListener("scroll", syncFromBody);

      trackEl.removeEventListener("scroll", syncFromTrack);

      scrollEl.removeEventListener("wheel", onWheel);

      resizeObserver.disconnect();

      window.removeEventListener("resize", updateStickyTrackGeometry);

      window.removeEventListener("scroll", updateStickyTrackGeometry, true);

    };

  }, [messages, tableScrollRef, updateStickyTrackGeometry]);



  function handleMarkChange(message: EmailMessage, value: OperatorMarkAction) {
    setMarkValues((prev) => ({ ...prev, [message.id]: "" }));
    if (value === "approve") {
      if (!hasDepartmentForApprove(message)) {
        setDepartmentEditRequestId(message.id);
        return;
      }
      onOperatorApprove(message);
      return;
    }
    if (value === "correct") {
      onOperatorCorrect(message);
    }
  }

  function handleSpamChange(message: EmailMessage, value: SpamMarkAction) {
    setSpamValues((prev) => ({ ...prev, [message.id]: "" }));
    if (value === "confirm") {
      onSpamConfirm(message);
      return;
    }
    if (value === "reject") {
      onSpamReject(message);
    }
  }



  const handleInlineSave = useCallback(

    (message: EmailMessage, payload: InlineFieldSavePayload) => {

      onInlineFieldSave(message, payload);

    },

    [onInlineFieldSave]

  );

  const handleExportReport = useCallback(async () => {
    setIsExporting(true);
    try {
      const { blob, filename } = await emailMessagesApi.exportReport(exportPeriod);
      await ensureXlsxBlob(blob);
      downloadBlob(blob, filename);
    } catch (error) {
      const message = await extractBlobError(error);
      onExportError?.(message);
    } finally {
      setIsExporting(false);
    }
  }, [exportPeriod, onExportError]);



  return (

    <div className={styles.tableWrapper}>

      <div
        ref={tableScrollRef}
        className={`${styles.tableBodyScroll} ${
          hasHorizontalOverflow ? styles.tableBodyScrollHasHScroll : ""
        }`}
      >

        {hasMore ? (

          <div className={styles.loadMoreTop}>

            <button

              type="button"

              className={styles.loadMoreButton}

              disabled={isLoadingMore}

              onClick={onLoadMore}

            >

              {isLoadingMore ? "Загружаем…" : "Загрузить более ранние"}

            </button>

          </div>

        ) : null}

        <table ref={tableRef} className={styles.table}>

          <colgroup>

            <col className={styles.colFixedMark} />

            <col className={styles.colFixedMark} />

            <col className={styles.colDate} />

            <col className={styles.colNumber} />

            <col />

            <col className={styles.colAttachment} />

            <col className={styles.colOrg} />

            <col />

            <col />

            <col className={styles.colDeptId} />

            <col />

            <col />

          </colgroup>

          <thead>

            <tr>

              <th className={styles.markCell}>Отметка</th>

              <th className={styles.markCell}>Спам</th>

              <th className={styles.dateCell}>

                <button

                  type="button"

                  className={styles.sortableHeader}

                  onClick={onDateSortToggle}

                  aria-sort={dateSortOrder === "asc" ? "ascending" : "descending"}

                >

                  Дата

                  <span className={styles.sortIndicator} aria-hidden="true">

                    {dateSortOrder === "asc" ? "↑" : "↓"}

                  </span>

                </button>

              </th>

              <th className={styles.numberCell}>Номер</th>

              <th className={styles.categoryCell}>Категория</th>

              <th className={styles.attachmentCell}>Влож.</th>

              <th className={styles.orgCell}>Организация</th>

              <th className={styles.emailCell}>Email отправителя</th>

              <th className={styles.partnerCell}>Партнер</th>

              <th className={styles.deptIdCell}>Кому</th>

              <th className={styles.deptNameCell}>Кому (подразделение)</th>

              <th className={styles.directionCell}>Плательщик-направление</th>

            </tr>

          </thead>

          <tbody>

            {messages.map((message) => {

              const attachments = message.attachments_summary ?? [];

              const hasAttachments =

                (message.attachments_count ?? 0) > 0 || attachments.length > 0;

              const isSelected = selectedId === message.id;

              const markValue = markValues[message.id] ?? "";

              const spamValue = spamValues[message.id] ?? "";

              const operatorMarks = operatorMarkAvailability(message.status);

              const spamMarks = spamMarkAvailability(message.status, message.is_spam);

              const operatorDisabled = isOperatorMarkDisabled(message.status, isBusy);

              const spamDisabled = isSpamMarkDisabled(spamMarks, isBusy);

              const editable = canEditRouting(message.status);

              const organizationValue = message.organization ?? "";

              const organizationLabel =

                message.organization_name ??

                organizationOptions.find((option) => option.value === organizationValue)?.label ??

                organizationValue;

              const categoryLabel = documentCategoryLabel(message);

              const categoryTitle = documentCategoryTitle(message);

              const dialogCategory = isDialogCategory(message);



              return (

                <tr

                  key={message.id}

                  className={`${rowStateClass(message.operator_review_state)} ${

                    isSelected ? styles.rowSelected : ""

                  }`}

                  onClick={() => onSelectMessage(message)}

                >

                  <td className={styles.markCell} onClick={(event) => event.stopPropagation()}>

                    <select
                      className={`${operatorSelectClass(message.operator_review_state)} ${
                        operatorDisabled ? styles.markSelectDisabled : ""
                      }`}
                      aria-label="Отметка оператора"
                      title={
                        operatorDisabled
                          ? operatorMarks.disabledReason
                          : !hasDepartmentForApprove(message)
                            ? "Для подтверждения выберите «Подтвердить» — откроется выбор отдела"
                            : undefined
                      }
                      value={markValue}
                      disabled={operatorDisabled}
                      onChange={(event) =>
                        handleMarkChange(message, event.target.value as OperatorMarkAction)
                      }
                    >
                      <option value="">—</option>
                      {operatorMarks.approve ? (
                        <option value="approve" className={styles.markOk}>
                          Подтвердить
                        </option>
                      ) : null}
                      {operatorMarks.correct ? (
                        <option value="correct" className={styles.markReject}>
                          Исправить
                        </option>
                      ) : null}
                    </select>

                  </td>

                  <td

                    className={`${styles.markCell} ${spamCellClass(message)}`}

                    onClick={(event) => event.stopPropagation()}

                  >

                    <select
                      className={`${spamSelectClass(message)} ${
                        spamDisabled ? styles.markSelectDisabled : ""
                      }`}
                      aria-label="Отметка спама"
                      title={
                        spamDisabled
                          ? spamMarks.disabledReason
                          : "Выберите «Спам» или «Не спам»"
                      }
                      value={spamValue}
                      disabled={spamDisabled}
                      onChange={(event) =>
                        handleSpamChange(message, event.target.value as SpamMarkAction)
                      }
                    >
                      <option value="">—</option>
                      {spamMarks.confirm ? (
                        <option value="confirm" className={styles.markReject}>
                          Спам
                        </option>
                      ) : null}
                      {spamMarks.reject ? (
                        <option value="reject" className={styles.markOk}>
                          Не спам
                        </option>
                      ) : null}
                    </select>

                  </td>

                  <td

                    className={styles.dateCell}

                    title={message.received_at ?? message.mail_date ?? undefined}

                  >

                    {formatTableDate(message.received_at ?? message.mail_date)}

                  </td>

                  <td className={styles.numberCell} title={message.erp_document_number ?? undefined}>

                    {cell(message.erp_document_number)}

                  </td>

                  <td
                    className={`${styles.categoryCell} ${dialogCategory ? styles.categoryDialog : ""}`}
                    title={categoryTitle}
                  >
                    {dialogCategory ? (
                      <span className={styles.categoryDialogBadge}>{categoryLabel}</span>
                    ) : (
                      categoryLabel
                    )}
                  </td>

                  <td className={styles.attachmentCell} onClick={(event) => event.stopPropagation()}>

                    {hasAttachments ? (

                      <button

                        type="button"

                        className={styles.attachmentButton}

                        aria-label="Открыть вложения и содержимое письма"

                        title="Вложения и содержимое письма"

                        onClick={() => onOpenMessageAttachments(message)}

                      >

                        <span className={styles.paperclip} aria-hidden="true" />

                      </button>

                    ) : (

                      "—"

                    )}

                  </td>

                  <InlineEditableCell

                    message={message}

                    field="organization"

                    value={organizationValue}

                    displayValue={organizationLabel}

                    className={styles.orgCell}

                    title={organizationLabel || undefined}

                    canEdit={editable}

                    inputType="select"

                    options={organizationOptions}

                    onSave={handleInlineSave}

                  />

                  <td className={styles.emailCell} title={message.sender_email}>

                    {cell(message.sender_email)}

                  </td>

                  <InlineEditableCell

                    message={message}

                    field="partner"

                    value={message.partner_name ?? ""}

                    className={styles.partnerCell}

                    title={message.partner_name ?? undefined}

                    canEdit={editable}

                    onSave={handleInlineSave}

                  />

                  <InlineEditableCell

                    message={message}

                    field="department_id"

                    value={message.department_id ?? ""}

                    className={styles.deptIdCell}

                    title={message.department_id ?? undefined}

                    canEdit={editable}

                    inputType="select"

                    options={departmentOptions}

                    onSave={handleInlineSave}

                    requestEdit={departmentEditRequestId === message.id}

                    onEditRequested={() => setDepartmentEditRequestId(null)}

                  />

                  <InlineEditableCell
                    message={message}
                    field="department_id"
                    value={message.department_id ?? ""}
                    displayValue={message.department_name ?? ""}
                    className={styles.deptNameCell}
                    title={message.department_name ?? undefined}
                    canEdit={editable}
                    inputType="select"
                    options={departmentOptions}
                    onSave={handleInlineSave}
                  />

                  <td

                    className={styles.directionCell}

                    title={message.payer_direction_label ?? undefined}

                  >

                    {cell(message.payer_direction_label)}

                  </td>

                </tr>

              );

            })}

          </tbody>

        </table>

      </div>

      <div

        ref={stickyTrackRef}

        className={`${styles.stickyHScrollTrack} ${

          stickyTrackVisible ? styles.stickyHScrollTrackVisible : ""

        }`}

        aria-hidden="true"

      >

        <div className={styles.stickyHScrollInner} />

      </div>

      <div ref={footerRef} className={styles.footer}>
        <div className={styles.exportGroup} role="group" aria-label="Период выгрузки отчёта">
          <span className={styles.exportPeriodCaption}>Период:</span>
          <select
            className={styles.exportPeriodSelect}
            value={exportPeriod}
            disabled={isExporting}
            aria-label="Период выгрузки отчёта"
            onChange={(event) => setExportPeriod(event.target.value as ExportReportPeriod)}
          >
            <option value="day">День</option>
            <option value="week">Неделя</option>
            <option value="month">Месяц</option>
          </select>
        </div>

        <button
          type="button"
          className={styles.exportButton}
          disabled={isExporting}
          onClick={() => void handleExportReport()}
        >
          {isExporting ? "Формируем…" : "Выгрузить отчёт"}
        </button>

        <span className={styles.footerDivider} aria-hidden="true">
          |
        </span>

        <span className={styles.footerCount}>
          {isLoadingMore ? "Загружаем ещё…" : `Показано ${loadedCount} из ${totalCount}`}
        </span>

        {hasMore ? (
          <button
            type="button"
            className={styles.loadMoreButton}
            disabled={isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore ? "Загружаем…" : "Загрузить более ранние"}
          </button>
        ) : null}
      </div>

    </div>

  );

}


