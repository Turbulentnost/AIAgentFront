import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { createPortal } from "react-dom";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { agentsApi } from "@/api/endpoints";
import type { User } from "@/types";
import styles from "./AvionDeveloperFeedbackWidget.module.css";

type Props = {
  user: User | null;
};

type FeedbackState =
  | { kind: "success"; title: string; message: string }
  | { kind: "error"; title: string; message: string };

function FeedbackFabIcon() {
  return (
    <svg
      className={styles.fabIcon}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 5.5h12A2.5 2.5 0 0 1 20.5 8v7.5A2.5 2.5 0 0 1 18 18h-6.3L7.5 21v-3H6A2.5 2.5 0 0 1 3.5 15.5V8A2.5 2.5 0 0 1 6 5.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatUserDisplayName(user: User | null): string {
  if (!user) return "—";
  const parts = [user.last_name, user.first_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (user.full_name?.trim()) return user.full_name.trim();
  return user.email;
}

function appendUniqueFiles(current: File[], incoming: FileList | File[]): File[] {
  const next = [...current];
  for (const file of Array.from(incoming)) {
    const duplicate = next.some(
      (existing) =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified
    );
    if (!duplicate) next.push(file);
  }
  return next;
}

function extractErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => (typeof item?.msg === "string" ? item.msg : null))
        .filter(Boolean)
        .join(" ");
      if (message) return message;
    }
    if (typeof detail === "object" && detail && "message" in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    return error.message || "Не удалось отправить сообщение.";
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Не удалось отправить сообщение.";
}

export default function AvionDeveloperFeedbackWidget({ user }: Props) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const senderName = formatUserDisplayName(user);
  const canSend = Boolean(message.trim()) && !sending;

  const resetForm = useCallback(() => {
    setMessage("");
    setAttachments([]);
    setIsDragOver(false);
    dragDepthRef.current = 0;
  }, []);

  const closeModal = useCallback(() => {
    if (sending) return;
    setOpen(false);
  }, [sending]);

  const addAttachments = useCallback((files: FileList | File[]) => {
    setAttachments((current) => appendUniqueFiles(current, files));
    setFeedback(null);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      setFeedback(null);
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) closeModal();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeModal, open, resetForm, sending]);

  useEffect(() => {
    if (feedback) {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [feedback]);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      if (event.dataTransfer.files?.length) {
        addAttachments(event.dataTransfer.files);
      }
    },
    [addAttachments]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = event.clipboardData?.files;
      if (!files?.length) return;
      event.preventDefault();
      addAttachments(files);
    },
    [addAttachments]
  );

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending) return;

    setSending(true);
    setFeedback(null);

    try {
      await agentsApi.sendAvionDeveloperFeedback(trimmedMessage, attachments);
      setFeedback({
        kind: "success",
        title: "Сообщение отправлено",
        message: "Спасибо! Мы получили вашу обратную связь по агенту Авион.",
      });
      resetForm();
      window.setTimeout(() => {
        setOpen(false);
        setFeedback(null);
      }, 1400);
    } catch (error) {
      setFeedback({
        kind: "error",
        title: "Не удалось отправить",
        message: extractErrorMessage(error),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen(true)}
        aria-label="Обратная связь с разработчиком"
        title="Обратная связь с разработчиком"
      >
        <FeedbackFabIcon />
      </button>

      {open
        ? createPortal(
            <div
              className={styles.overlay}
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) closeModal();
              }}
            >
              <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.header}>
                  <div className={styles.titleWrap}>
                    <h2 id={titleId} className={styles.title}>
                      Обратная связь с разработчиком
                    </h2>
                    <p className={styles.subtitle}>
                      Опишите ошибку, предложение или вопрос по работе агента закупок Авион —
                      разработчик исправит и обновит в ближайшее время.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={closeModal}
                    disabled={sending}
                    aria-label="Закрыть"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>

                <div className={styles.body}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>От кого</span>
                    <input
                      className={styles.readonlyControl}
                      value={senderName}
                      readOnly
                      tabIndex={-1}
                      aria-readonly="true"
                    />
                  </label>

                  <div className={styles.messageSection}>
                    <label className={styles.field} htmlFor={`${titleId}-message`}>
                      <span className={styles.fieldLabel}>Сообщение</span>
                    </label>

                    <div
                      className={`${styles.messageAreaWrap} ${
                        isDragOver ? styles.messageAreaWrapDragOver : ""
                      }`}
                      onDragEnter={sending ? undefined : handleDragEnter}
                      onDragLeave={sending ? undefined : handleDragLeave}
                      onDragOver={sending ? undefined : handleDragOver}
                      onDrop={sending ? undefined : handleDrop}
                    >
                      {isDragOver ? (
                        <div className={styles.dropOverlay} aria-hidden="true">
                          <span className={styles.dropOverlayIcon}>
                            <Upload size={22} strokeWidth={2} />
                          </span>
                          <p className={styles.dropOverlayLabel}>
                            Отпустите файлы для прикрепления
                          </p>
                        </div>
                      ) : null}

                      <textarea
                        id={`${titleId}-message`}
                        className={styles.textarea}
                        value={message}
                        onChange={(event) => {
                          setMessage(event.target.value);
                          if (feedback) setFeedback(null);
                        }}
                        onPaste={handlePaste}
                        placeholder="Опишите проблему, приложите скриншоты или файлы при необходимости…"
                        rows={6}
                        disabled={sending}
                      />

                      <div className={styles.messageToolbar}>
                        <button
                          type="button"
                          className={styles.attachBtn}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sending}
                          aria-label="Прикрепить файлы"
                          title="Прикрепить файлы"
                        >
                          <Paperclip size={18} strokeWidth={2} aria-hidden />
                        </button>
                        <input
                          ref={fileInputRef}
                          className={styles.hiddenFileInput}
                          type="file"
                          multiple
                          onChange={(event) => {
                            if (event.target.files?.length) {
                              addAttachments(event.target.files);
                            }
                            event.target.value = "";
                          }}
                        />
                      </div>
                    </div>

                    {attachments.length ? (
                      <ul className={styles.attachmentList} aria-label="Прикреплённые файлы">
                        {attachments.map((file, index) => (
                          <li key={`${file.name}-${file.lastModified}-${index}`} className={styles.attachmentChip}>
                            <Paperclip size={14} strokeWidth={2} aria-hidden />
                            <span className={styles.attachmentName} title={file.name}>
                              {file.name}
                            </span>
                            <button
                              type="button"
                              className={styles.removeAttachmentBtn}
                              onClick={() => removeAttachment(index)}
                              disabled={sending}
                              aria-label={`Удалить файл ${file.name}`}
                            >
                              <X size={14} strokeWidth={2.2} aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  {feedback ? (
                    <div
                      ref={feedbackRef}
                      className={`${styles.feedback} ${
                        feedback.kind === "success" ? styles.feedbackSuccess : styles.feedbackError
                      }`}
                      role="alert"
                      aria-live="assertive"
                    >
                      <span className={styles.feedbackIcon} aria-hidden>
                        {feedback.kind === "success" ? (
                          <CheckCircle2 size={18} strokeWidth={2.25} />
                        ) : (
                          <AlertTriangle size={18} strokeWidth={2.25} />
                        )}
                      </span>
                      <div>
                        <p className={styles.feedbackTitle}>{feedback.title}</p>
                        <p className={styles.feedbackMessage}>{feedback.message}</p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={styles.footer}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={closeModal}
                    disabled={sending}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                  >
                    {sending ? (
                      <>
                        <Loader2 size={16} className={styles.spinner} aria-hidden />
                        Отправка…
                      </>
                    ) : (
                      "Отправить"
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
