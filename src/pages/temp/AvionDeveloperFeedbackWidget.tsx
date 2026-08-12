import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  Upload,
  X,
} from "lucide-react";
import { agentsApi } from "@/api/endpoints";
import type {
  DeveloperFeedbackMessage,
  DeveloperFeedbackThread,
  User,
} from "@/types";
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

function senderName(user: User | null): string {
  if (!user) return "Пользователь";
  const full = [user.last_name, user.first_name, user.middle_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || user.full_name || user.email;
}

function extractError(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить действие.";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const result: File[] = [];
  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(file);
  }
  return result;
}

function sortMessages(items: DeveloperFeedbackMessage[]): DeveloperFeedbackMessage[] {
  return [...items].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

function isPendingMessage(message: DeveloperFeedbackMessage): boolean {
  return message.id.startsWith("pending:");
}

function mergeServerMessages(
  serverMessages: DeveloperFeedbackMessage[],
  localMessages: DeveloperFeedbackMessage[]
): DeveloperFeedbackMessage[] {
  const pending = localMessages.filter((message) => {
    if (!isPendingMessage(message)) return false;
    return !serverMessages.some(
      (serverMessage) =>
        serverMessage.body === message.body &&
        serverMessage.author_role === message.author_role
    );
  });
  return sortMessages([...serverMessages, ...pending]);
}

function createPendingId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `pending:${crypto.randomUUID()}`;
  }
  return `pending:${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AvionDeveloperFeedbackWidget({ user }: Props) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesLoadSeqRef = useRef(0);
  const sendingCountRef = useRef(0);
  const skipThreadLoadEffectRef = useRef(false);
  const threadsRef = useRef<DeveloperFeedbackThread[]>([]);
  const activeThreadIdRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"user" | "developer" | string>("user");
  const [threads, setThreads] = useState<DeveloperFeedbackThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DeveloperFeedbackMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [opening, setOpening] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
    [activeThreadId, threads]
  );
  const isDeveloper = mode === "developer";
  const unreadTotal = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);

  threadsRef.current = threads;
  activeThreadIdRef.current = activeThreadId;

  const loadThreads = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    if (!options?.silent) setLoadingThreads(true);
    try {
      const response = await agentsApi.listAvionDeveloperFeedbackThreads();
      setMode(response.mode);
      setThreads(response.threads);
      setActiveThreadId((current) => {
        if (current && response.threads.some((thread) => thread.id === current)) return current;
        return response.threads[0]?.id ?? null;
      });
      if (!options?.silent) setFeedback(null);
    } catch (error) {
      if (!options?.silent) {
        setFeedback({
          kind: "error",
          title: "Не удалось загрузить диалоги",
          message: extractError(error),
        });
      }
    } finally {
      if (!options?.silent) setLoadingThreads(false);
    }
  }, [user]);

  const loadMessages = useCallback(
    async (
      threadId: string,
      options?: { silent?: boolean; markRead?: boolean; force?: boolean }
    ) => {
      if (!user) return;
      if (options?.silent && sendingCountRef.current > 0 && !options.force) return;

      const seq = ++messagesLoadSeqRef.current;
      if (!options?.silent) setLoadingMessages(true);
      try {
        const response = await agentsApi.getAvionDeveloperFeedbackMessages(threadId);
        if (seq !== messagesLoadSeqRef.current) return;

        setMode(response.mode);
        setMessages((current) => mergeServerMessages(response.messages, current));
        setThreads((current) =>
          current.map((thread) => (thread.id === response.thread.id ? response.thread : thread))
        );

        if (options?.markRead ?? !options?.silent) {
          try {
            const readThread = await agentsApi.markAvionDeveloperFeedbackThreadRead(threadId);
            if (seq !== messagesLoadSeqRef.current) return;
            setThreads((current) =>
              current.map((item) => (item.id === readThread.id ? readThread : item))
            );
          } catch {
            if (seq !== messagesLoadSeqRef.current) return;
            setThreads((current) =>
              current.map((thread) =>
                thread.id === response.thread.id
                  ? { ...response.thread, unread_count: 0 }
                  : thread
              )
            );
          }
        }
      } catch (error) {
        if (!options?.silent) {
          setFeedback({
            kind: "error",
            title: "Не удалось загрузить историю",
            message: extractError(error),
          });
        }
      } finally {
        if (!options?.silent && seq === messagesLoadSeqRef.current) {
          setLoadingMessages(false);
        }
      }
    },
    [user]
  );

  const openWidget = useCallback(async () => {
    setOpening(true);
    setOpen(true);
    setFeedback(null);
    skipThreadLoadEffectRef.current = true;
    try {
      await loadThreads();
      const threadId =
        activeThreadIdRef.current ?? threadsRef.current[0]?.id ?? null;
      if (threadId) {
        await loadMessages(threadId, { markRead: true, force: true });
      }
    } finally {
      setOpening(false);
    }
  }, [loadMessages, loadThreads]);

  useEffect(() => {
    if (!user) return undefined;
    void loadThreads();
    const intervalMs = open ? 15000 : 2000;
    const intervalId = window.setInterval(() => {
      void loadThreads({ silent: true });
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [loadThreads, open, user]);

  useEffect(() => {
    if (!user) return undefined;
    const refreshThreads = () => {
      void loadThreads({ silent: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshThreads();
    };
    window.addEventListener("focus", refreshThreads);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshThreads);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadThreads, user]);

  useEffect(() => {
    if (open) return;
    void loadThreads({ silent: true });
  }, [loadThreads, open]);

  useEffect(() => {
    if (!open || !activeThread?.id) return;
    if (skipThreadLoadEffectRef.current) {
      skipThreadLoadEffectRef.current = false;
      return;
    }
    void loadMessages(activeThread.id, { markRead: true, force: true });
  }, [activeThread?.id, loadMessages, open]);

  useEffect(() => {
    if (!open || !activeThread?.id) return undefined;
    const intervalId = window.setInterval(() => {
      void loadMessages(activeThread.id, { silent: true, markRead: false });
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [activeThread?.id, loadMessages, open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const addFiles = useCallback((nextFiles: File[]) => {
    if (!nextFiles.length) return;
    setAttachments((current) => dedupeFiles([...current, ...nextFiles]));
  }, []);

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files ?? []);
    if (files.length) addFiles(files);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const sendMessage = async () => {
    const trimmed = messageText.trim();
    if (!trimmed) {
      setFeedback({
        kind: "error",
        title: "Сообщение пустое",
        message: "Опишите вопрос или проблему перед отправкой.",
      });
      return;
    }
    const threadId = activeThread?.id ?? threadsRef.current[0]?.id ?? null;
    if (!threadId) {
      setFeedback({
        kind: "error",
        title: "Диалог не выбран",
        message: "Обновите виджет и попробуйте отправить сообщение ещё раз.",
      });
      return;
    }

    const pendingId = createPendingId();
    const filesToSend = attachments;
    const optimisticMessage: DeveloperFeedbackMessage = {
      id: pendingId,
      thread_id: threadId,
      author_user_id: user?.id ?? null,
      author_role: isDeveloper ? "developer" : "user",
      author_name: senderName(user),
      author_email: user?.email ?? "",
      body: trimmed,
      created_at: new Date().toISOString(),
      attachments: filesToSend.map((file, index) => ({
        id: `${pendingId}-att-${index}`,
        message_id: pendingId,
        original_filename: file.name,
        content_type: file.type || "application/octet-stream",
        file_size: file.size,
        checksum: "",
        download_url: "",
        created_at: new Date().toISOString(),
      })),
    };

    sendingCountRef.current += 1;
    setMessageText("");
    setAttachments([]);
    setMessages((current) => sortMessages([...current, optimisticMessage]));
    setFeedback(null);

    try {
      const response = await agentsApi.sendAvionDeveloperFeedbackMessage(
        threadId,
        trimmed,
        filesToSend
      );
      setMessages((current) => {
        const withoutPending = current.filter((item) => item.id !== pendingId);
        if (withoutPending.some((item) => item.id === response.message.id)) {
          return sortMessages(withoutPending);
        }
        return sortMessages([...withoutPending, response.message]);
      });
      setThreads((current) =>
        current.map((thread) => (thread.id === response.thread.id ? response.thread : thread))
      );
    } catch (error) {
      setMessages((current) => current.filter((item) => item.id !== pendingId));
      setMessageText(trimmed);
      setAttachments(filesToSend);
      setFeedback({
        kind: "error",
        title: "Не удалось отправить сообщение",
        message: extractError(error),
      });
    } finally {
      sendingCountRef.current = Math.max(0, sendingCountRef.current - 1);
      void loadMessages(threadId, { silent: true, markRead: false, force: true });
    }
  };

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const downloadAttachment = async (attachmentId: string, filename: string) => {
    try {
      const blob = await agentsApi.downloadAvionDeveloperFeedbackAttachment(attachmentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback({
        kind: "error",
        title: "Не удалось скачать вложение",
        message: extractError(error),
      });
    }
  };

  if (!user) return null;

  const modal = (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        className={`${styles.modal} ${isDeveloper ? styles.modalDeveloper : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h2 id={titleId} className={styles.title}>
              {isDeveloper ? "Обратная связь Авион" : "Диалог с разработчиком"}
            </h2>
            <p className={styles.subtitle}>
              {isDeveloper
                ? "Выберите пользователя слева и ответьте в его приватный диалог."
                : "История сохраняется: вы видите только свой диалог с разработчиком."}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setOpen(false)}
            aria-label="Закрыть"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className={styles.chatBody}>
          {isDeveloper ? (
            <aside className={styles.threadList} aria-label="Диалоги пользователей">
              {loadingThreads ? (
                <div className={styles.loadingLine}>
                  <Loader2 className={styles.spinner} size={16} aria-hidden />
                  Загрузка диалогов…
                </div>
              ) : null}
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={`${styles.threadButton} ${
                    activeThread?.id === thread.id ? styles.threadButtonActive : ""
                  }`}
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    void loadMessages(thread.id, { markRead: true, force: true });
                  }}
                >
                  <span className={styles.threadName}>{thread.participant_name}</span>
                  <span className={styles.threadEmail}>{thread.participant_email}</span>
                  <span className={styles.threadPreview}>
                    {thread.last_message_preview || "История пока пустая"}
                  </span>
                  {thread.unread_count ? (
                    <span className={styles.threadUnread}>{thread.unread_count}</span>
                  ) : null}
                </button>
              ))}
            </aside>
          ) : null}

          <section className={styles.conversation} aria-label="История сообщений">
            <div className={styles.conversationHead}>
              <div>
                <span className={styles.fieldLabel}>
                  {isDeveloper ? "Диалог с" : "От кого"}
                </span>
                <strong>{isDeveloper ? activeThread?.participant_name || "Пользователь" : senderName(user)}</strong>
              </div>
              {activeThread?.last_message_at ? (
                <span className={styles.lastMessageAt}>
                  Последнее: {formatDateTime(activeThread.last_message_at)}
                </span>
              ) : null}
            </div>

            <div className={styles.messages}>
              {loadingMessages || opening ? (
                <div className={styles.loadingState}>
                  <Loader2 className={styles.spinner} size={20} aria-hidden />
                  <span>Загрузка истории…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className={styles.emptyState}>
                  <MessageCircle size={22} aria-hidden />
                  <p>
                    {isDeveloper
                      ? "Диалог пока пустой. Дождитесь сообщения пользователя или отправьте первый ответ."
                      : "Здесь появится история общения с разработчиком."}
                  </p>
                </div>
              ) : (
                messages.map((item) => {
                  const own =
                    (isDeveloper && item.author_role === "developer") ||
                    (!isDeveloper && item.author_role === "user");
                  return (
                    <article
                      key={item.id}
                      className={`${styles.messageBubble} ${own ? styles.messageBubbleOwn : ""}`}
                    >
                      <div className={styles.messageMeta}>
                        <strong>{item.author_name}</strong>
                        <span>{formatDateTime(item.created_at)}</span>
                      </div>
                      <p>{item.body}</p>
                      {item.attachments.length ? (
                        <div className={styles.attachmentList}>
                          {item.attachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              type="button"
                              className={styles.attachmentLink}
                              onClick={() =>
                                void downloadAttachment(
                                  attachment.id,
                                  attachment.original_filename
                                )
                              }
                            >
                              <Download size={14} aria-hidden />
                              <span>{attachment.original_filename}</span>
                              <small>{formatFileSize(attachment.file_size)}</small>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div
              className={`${styles.composer} ${isDragOver ? styles.composerDragOver : ""}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {isDragOver ? (
                <div className={styles.dropOverlay} aria-hidden="true">
                  <span className={styles.dropOverlayIcon}>
                    <Upload size={22} strokeWidth={2} />
                  </span>
                  <p className={styles.dropOverlayLabel}>Отпустите файлы для прикрепления</p>
                </div>
              ) : null}
              <textarea
                className={styles.textarea}
                value={messageText}
                onChange={(event) => {
                  setMessageText(event.target.value);
                  if (feedback?.kind === "error") setFeedback(null);
                }}
                onPaste={handlePaste}
                onKeyDown={handleComposerKeyDown}
                placeholder={isDeveloper ? "Ответить пользователю…" : "Напишите разработчику…"}
                rows={3}
                disabled={!activeThread}
              />
              {attachments.length ? (
                <div className={styles.attachments}>
                  {attachments.map((file) => (
                    <span key={`${file.name}-${file.size}-${file.lastModified}`} className={styles.attachmentChip}>
                      {file.name}
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((current) =>
                            current.filter((item) => item !== file)
                          )
                        }
                        aria-label={`Убрать файл ${file.name}`}
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className={styles.composerActions}>
                <button
                  type="button"
                  className={styles.attachBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!activeThread}
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
                    addFiles(Array.from(event.currentTarget.files ?? []));
                    event.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={() => void sendMessage()}
                  disabled={!activeThread || !messageText.trim()}
                >
                  <Send size={16} aria-hidden />
                  Отправить
                </button>
              </div>
            </div>

            {feedback ? (
              <div
                className={`${styles.feedback} ${
                  feedback.kind === "success" ? styles.feedbackSuccess : styles.feedbackError
                }`}
                role={feedback.kind === "error" ? "alert" : "status"}
              >
                <span className={styles.feedbackIcon} aria-hidden>
                  {feedback.kind === "success" ? (
                    <CheckCircle2 size={18} strokeWidth={2.2} />
                  ) : (
                    <AlertTriangle size={18} strokeWidth={2.2} />
                  )}
                </span>
                <div>
                  <p className={styles.feedbackTitle}>{feedback.title}</p>
                  <p className={styles.feedbackMessage}>{feedback.message}</p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={() => {
          void openWidget();
        }}
        aria-label={
          unreadTotal > 0
            ? `Обратная связь с разработчиком, непрочитанных: ${unreadTotal}`
            : "Обратная связь с разработчиком"
        }
        title="Обратная связь с разработчиком"
      >
        <FeedbackFabIcon />
        {unreadTotal > 0 ? <span className={styles.fabBadge}>{unreadTotal}</span> : null}
      </button>

      {open ? createPortal(modal, document.body) : null}
    </>
  );
}
