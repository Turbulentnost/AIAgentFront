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
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  Upload,
  Users,
  X,
} from "lucide-react";
import { agentsApi } from "@/api/endpoints";
import type {
  DeveloperFeedbackMessage,
  DeveloperFeedbackThread,
  User,
  WechatGroup,
  WechatHistoryItem,
} from "@/types";
import styles from "./AvionDeveloperFeedbackWidget.module.css";
import wechatFabIcon from "./wechat-fab-icon.png";

type PanelKind = "personal" | "groups";

type ActiveView =
  | { kind: "thread"; id: string }
  | { kind: "group"; id: string };

const AVATAR_COLORS = [
  "#2563eb",
  "#0d9488",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#ea580c",
  "#059669",
];

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

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKeyRu(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function isOnSelectedDay(value: string | null | undefined, day: string): boolean {
  if (!day) return true;
  return toDateKey(value) === day;
}

function dateKeyFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthCells(year: number, monthIndex: number): Array<{ key: string; day: number | null }> {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayBased = (first.getDay() + 6) % 7;
  const cells: Array<{ key: string; day: number | null }> = [];
  for (let i = 0; i < mondayBased; i += 1) {
    cells.push({ key: `e-${i}`, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: dateKeyFromParts(year, monthIndex, day), day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `t-${cells.length}`, day: null });
  }
  return cells;
}

const WEEKDAY_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function looksLikeFileName(value: string | null | undefined): boolean {
  return Boolean(value && /\.[A-Za-z0-9]{1,8}$/.test(value.trim()));
}

function hasDownloadableWechatFile(item: WechatHistoryItem): boolean {
  return Boolean(item.file?.path);
}

function isWechatMedia(item: WechatHistoryItem): boolean {
  if (hasDownloadableWechatFile(item)) return true;
  const type = (item.type || "").toLowerCase();
  return Boolean(
    looksLikeFileName(item.file?.name) ||
    (looksLikeFileName(item.text) && type === "file")
  );
}

function isWechatImage(item: WechatHistoryItem): boolean {
  const type = (item.type || "").toLowerCase();
  return item.file?.kind === "image" || ["image", "pic", "picture", "img"].includes(type);
}

function wechatDisplayText(item: WechatHistoryItem): string {
  if ((item.type || "").toLowerCase() === "emoticon") return "";
  const text = (item.text || "").trim();
  if (!text || text.startsWith("<msg") || text.startsWith("<emoji")) return "";
  const fileName = (item.file?.name || "").trim();
  if (isWechatMedia(item) && (text === fileName || /\.(xlsx|xls|docx|doc|pdf|png|jpe?g|gif|webp|mp3|mp4)$/i.test(text))) {
    return "";
  }
  return text;
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

function senderInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function senderAvatarColor(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
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
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesLoadSeqRef = useRef(0);
  const sendingCountRef = useRef(0);
  const skipThreadLoadEffectRef = useRef(false);
  const threadsRef = useRef<DeveloperFeedbackThread[]>([]);
  const groupsRef = useRef<WechatGroup[]>([]);
  const activeThreadIdRef = useRef<string | null>(null);
  const panelRef = useRef<PanelKind | null>(null);
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [mode, setMode] = useState<"user" | "developer" | string>("user");
  const [threads, setThreads] = useState<DeveloperFeedbackThread[]>([]);
  const [groups, setGroups] = useState<WechatGroup[]>([]);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const open = panel !== null;
  const isGroupsPanel = panel === "groups";
  const isPersonalPanel = panel === "personal";
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DeveloperFeedbackMessage[]>([]);
  const [groupMessages, setGroupMessages] = useState<WechatHistoryItem[]>([]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [opening, setOpening] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const periodMenuRef = useRef<HTMLDivElement>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads]
  );
  const activeGroup = useMemo(
    () => (activeView?.kind === "group" ? groups.find((group) => group.id === activeView.id) ?? null : null),
    [activeView, groups]
  );
  const isGroupView = activeView?.kind === "group";
  const isDeveloper = mode === "developer";
  const unreadTotal = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
  const dateFilterActive = Boolean(selectedDay);

  const filteredGroupMessages = useMemo(
    () =>
      groupMessages.filter((item) =>
        isOnSelectedDay(item.time || item.receivedAt, selectedDay)
      ),
    [groupMessages, selectedDay]
  );

  const filteredMessages = useMemo(
    () => messages.filter((item) => isOnSelectedDay(item.created_at, selectedDay)),
    [messages, selectedDay]
  );

  const visibleTotal = isGroupsPanel ? groupMessages.length : messages.length;
  const visibleFiltered = isGroupsPanel ? filteredGroupMessages.length : filteredMessages.length;

  const clearDateFilter = useCallback(() => {
    setSelectedDay("");
  }, []);

  const periodSummary = selectedDay ? formatDateKeyRu(selectedDay) : "все сообщения";

  const calendarCells = useMemo(
    () => buildMonthCells(calendarMonth.year, calendarMonth.month),
    [calendarMonth.month, calendarMonth.year]
  );

  const calendarTitle = useMemo(() => {
    const date = new Date(calendarMonth.year, calendarMonth.month, 1);
    return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  }, [calendarMonth.month, calendarMonth.year]);

  const todayKey = toDateKey(new Date().toISOString()) || "";

  useEffect(() => {
    setSelectedDay("");
    setPeriodMenuOpen(false);
  }, [activeView?.id, activeView?.kind, panel]);

  useEffect(() => {
    if (!periodMenuOpen) return;
    if (selectedDay) {
      const [year, month] = selectedDay.split("-").map(Number);
      if (year && month) {
        setCalendarMonth({ year, month: month - 1 });
        return;
      }
    }
    const now = new Date();
    setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, [periodMenuOpen, selectedDay]);

  useEffect(() => {
    if (!periodMenuOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!periodMenuRef.current?.contains(event.target as Node)) {
        setPeriodMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [periodMenuOpen]);

  threadsRef.current = threads;
  groupsRef.current = groups;
  activeThreadIdRef.current = activeThreadId;
  panelRef.current = panel;

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
      setActiveView((current) => {
        if (panelRef.current === "groups" || current?.kind === "group") return current;
        if (current?.kind === "thread" && response.threads.some((thread) => thread.id === current.id)) {
          return current;
        }
        const firstId = response.threads[0]?.id;
        return firstId ? { kind: "thread", id: firstId } : current;
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

  const loadGroups = useCallback(async () => {
    try {
      const response = await agentsApi.listWechatUtilityGroups();
      setGroups(response.groups ?? []);
    } catch {
      setGroups([]);
    }
  }, []);

  const loadGroupMessages = useCallback(async (group: WechatGroup, options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingMessages(true);
    try {
      const response = await agentsApi.getWechatUtilityGroupMessages({
        groupId: group.groupId,
        groupName: group.name,
      });
      const items = response.items ?? [];
      setGroupMessages(items);
      setFileUrls((current) => {
        const nextUrls: Record<string, string> = {};
        for (const item of items) {
          if (current[item.id]) {
            nextUrls[item.id] = current[item.id];
          }
        }
        void Promise.all(
          items
            .filter((item) => isWechatImage(item) && hasDownloadableWechatFile(item) && !nextUrls[item.id])
            .map(async (item) => {
              try {
                const blob = await agentsApi.downloadWechatUtilityFile(item.id);
                nextUrls[item.id] = URL.createObjectURL(blob);
              } catch {
                /* файл на диске уже недоступен */
              }
            })
        ).then(() => {
          setFileUrls((latest) => {
            const merged = { ...latest };
            for (const [id, url] of Object.entries(nextUrls)) {
              if (!merged[id]) merged[id] = url;
            }
            return merged;
          });
        });
        return nextUrls;
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        title: "Не удалось загрузить группу",
        message: extractError(error),
      });
    } finally {
      if (!options?.silent) setLoadingMessages(false);
    }
  }, []);

  const downloadGroupAttachment = useCallback(async (item: WechatHistoryItem) => {
    if (!item.file?.path) {
      setFeedback({
        kind: "error",
        title: "Файл ещё не скачан с утилиты",
        message: item.file?.error || "Утилита вернула 404: файла нет в /media. Повторите, когда вложение появится на 192.168.5.80.",
      });
      return;
    }
    try {
      const blob = await agentsApi.downloadWechatUtilityFile(item.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.file?.name || item.text || "wechat-file";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback({
        kind: "error",
        title: "Не удалось скачать файл",
        message: extractError(error),
      });
    }
  }, []);

  const openPersonalWidget = useCallback(async () => {
    setOpening(true);
    setPanel("personal");
    setFeedback(null);
    skipThreadLoadEffectRef.current = true;
    try {
      await loadThreads();
      const threadId =
        activeThreadIdRef.current ?? threadsRef.current[0]?.id ?? null;
      if (threadId) {
        setActiveView({ kind: "thread", id: threadId });
        setActiveThreadId(threadId);
        await loadMessages(threadId, { markRead: true, force: true });
      } else {
        setActiveView(null);
      }
      setGroupMessages([]);
    } finally {
      setOpening(false);
    }
  }, [loadMessages, loadThreads]);

  const openGroupsWidget = useCallback(async () => {
    setOpening(true);
    setPanel("groups");
    setFeedback(null);
    try {
      await loadGroups();
      const firstGroup = groupsRef.current[0] ?? null;
      if (firstGroup) {
        setActiveView({ kind: "group", id: firstGroup.id });
        await loadGroupMessages(firstGroup);
      } else {
        setActiveView(null);
        setGroupMessages([]);
      }
    } finally {
      setOpening(false);
    }
  }, [loadGroupMessages, loadGroups]);

  const closeWidget = useCallback(() => {
    setPanel(null);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    void loadThreads();
    void loadGroups();
    const intervalMs = open ? 15000 : 2000;
    const intervalId = window.setInterval(() => {
      void loadThreads({ silent: true });
      void loadGroups();
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [loadGroups, loadThreads, open, user]);

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
    if (!open || !isPersonalPanel || isGroupView || !activeThread?.id) return;
    if (skipThreadLoadEffectRef.current) {
      skipThreadLoadEffectRef.current = false;
      return;
    }
    void loadMessages(activeThread.id, { markRead: true, force: true });
  }, [activeThread?.id, isGroupView, isPersonalPanel, loadMessages, open]);

  useEffect(() => {
    if (!open || !isPersonalPanel || isGroupView || !activeThread?.id) return undefined;
    const intervalId = window.setInterval(() => {
      void loadMessages(activeThread.id, { silent: true, markRead: false });
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [activeThread?.id, isGroupView, isPersonalPanel, loadMessages, open]);

  useEffect(() => {
    if (!open || !isGroupsPanel || activeView?.kind !== "group") return undefined;
    const groupId = activeView.id;
    const current = groupsRef.current.find((group) => group.id === groupId);
    if (current) void loadGroupMessages(current);
    const intervalId = window.setInterval(() => {
      const latest = groupsRef.current.find((group) => group.id === groupId);
      if (latest) void loadGroupMessages(latest, { silent: true });
    }, 8000);
    return () => window.clearInterval(intervalId);
  }, [activeView, isGroupsPanel, loadGroupMessages, open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [groupMessages, messages, open]);

  useEffect(() => {
    return () => {
      Object.values(fileUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [fileUrls]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (periodMenuOpen) {
        setPeriodMenuOpen(false);
        return;
      }
      closeWidget();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeWidget, open, periodMenuOpen]);

  useEffect(() => {
    if (!open) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      overscrollBehavior: html.style.overscrollBehavior,
    };
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    const isAllowedScroller = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(`.${styles.messages}, .${styles.threadList}, .${styles.textarea}`)
      );
    };

    const onWheel = (event: WheelEvent) => {
      if (isAllowedScroller(event.target)) return;
      event.preventDefault();
      const scroller = messagesScrollRef.current;
      if (scroller) scroller.scrollTop += event.deltaY;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (isAllowedScroller(event.target)) return;
      event.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.paddingRight = prev.bodyPaddingRight;
      html.style.overscrollBehavior = prev.overscrollBehavior;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouchMove);
    };
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
        if (event.target === event.currentTarget) closeWidget();
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
              {isGroupsPanel
                ? "Группы WeChat"
                : isDeveloper
                  ? "Обратная связь Авион"
                  : "Диалог с разработчиком"}
            </h2>
            <p className={styles.subtitle}>
              {isGroupsPanel
                ? "Только просмотр: история групп из WeChat, писать сюда нельзя."
                : isDeveloper
                  ? "Слева личные чаты пользователей. Можно читать и отвечать."
                  : "Ваш личный чат с разработчиком."}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeWidget}
            aria-label="Закрыть"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className={styles.chatBody}>
          <aside
            className={styles.threadList}
            aria-label={isGroupsPanel ? "Группы WeChat" : "Личные чаты"}
          >
            {isPersonalPanel && loadingThreads ? (
              <div className={styles.loadingLine}>
                <Loader2 className={styles.spinner} size={16} aria-hidden />
                Загрузка диалогов…
              </div>
            ) : null}

            {isPersonalPanel ? (
            <div className={styles.listSection}>
              <div className={styles.listSectionLabel}>Чаты</div>
              {threads.length === 0 && !loadingThreads ? (
                <div className={styles.loadingLine}>Пока нет личных диалогов</div>
              ) : null}
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={`${styles.threadButton} ${
                    activeView?.kind === "thread" && activeView.id === thread.id
                      ? styles.threadButtonActive
                      : ""
                  }`}
                  onClick={() => {
                    setActiveView({ kind: "thread", id: thread.id });
                    setActiveThreadId(thread.id);
                    void loadMessages(thread.id, { markRead: true, force: true });
                  }}
                >
                  <span className={styles.threadName}>
                    {isDeveloper ? thread.participant_name : "Чат с разработчиком"}
                  </span>
                  <span className={styles.threadEmail}>
                    {isDeveloper ? thread.participant_email : "личный диалог с разработчиком"}
                  </span>
                  <span className={styles.threadPreview}>
                    {thread.last_message_preview || "История пока пустая"}
                  </span>
                  {thread.unread_count ? (
                    <span className={styles.threadUnread}>{thread.unread_count}</span>
                  ) : null}
                </button>
              ))}
            </div>
            ) : null}

            {isGroupsPanel ? (
            <div className={styles.listSection}>
              <div className={styles.listSectionLabel}>Группы</div>
              {groups.length === 0 ? (
                <div className={styles.loadingLine}>Групп из WeChat пока нет</div>
              ) : null}
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`${styles.threadButton} ${styles.groupButton} ${
                    activeView?.kind === "group" && activeView.id === group.id
                      ? styles.groupButtonActive
                      : ""
                  }`}
                  onClick={() => {
                    setActiveView({ kind: "group", id: group.id });
                    void loadGroupMessages(group);
                  }}
                >
                  <span className={styles.groupTitleRow}>
                    <Users size={14} aria-hidden />
                    <span className={styles.threadName}>{group.name}</span>
                    <span className={styles.groupBadge}>группа</span>
                  </span>
                  <span className={styles.threadPreview}>
                    {group.lastSender ? `${group.lastSender}: ` : ""}
                    {group.lastPreview || "История пока пустая"}
                  </span>
                  <span className={styles.threadEmail}>
                    {group.messageCount} сообщ.
                    {group.lastMessageAt ? ` · ${formatDateTime(group.lastMessageAt)}` : ""}
                  </span>
                </button>
              ))}
            </div>
            ) : null}
          </aside>

          <section className={styles.conversation} aria-label="История сообщений">
            <div className={styles.conversationHead}>
              <div>
                <span className={styles.fieldLabel}>
                  {isGroupsPanel ? "Группа WeChat" : isDeveloper ? "Диалог с" : "Диалог"}
                </span>
                <strong>
                  {isGroupsPanel
                    ? activeGroup?.name || "Группа"
                    : isDeveloper
                      ? activeThread?.participant_name || "Пользователь"
                      : "Чат с разработчиком"}
                </strong>
              </div>
              <div className={styles.conversationHeadMeta}>
                {isGroupsPanel && activeGroup?.lastMessageAt ? (
                  <span className={styles.lastMessageAt}>
                    {dateFilterActive
                      ? `${visibleFiltered} из ${visibleTotal}`
                      : `${activeGroup.messageCount} сообщ.`}
                    {" · "}
                    {formatDateTime(activeGroup.lastMessageAt)}
                  </span>
                ) : isPersonalPanel && activeThread?.last_message_at ? (
                  <span className={styles.lastMessageAt}>
                    {dateFilterActive
                      ? `${visibleFiltered} из ${visibleTotal}`
                      : `Последнее: ${formatDateTime(activeThread.last_message_at)}`}
                  </span>
                ) : dateFilterActive ? (
                  <span className={styles.lastMessageAt}>
                    {visibleFiltered} из {visibleTotal}
                  </span>
                ) : null}

                <div className={styles.periodMenu} ref={periodMenuRef}>
                  <span className={styles.periodMenuCaption}>показать за день</span>
                  <button
                    type="button"
                    className={`${styles.periodMenuTrigger} ${
                      periodMenuOpen ? styles.periodMenuTriggerOpen : ""
                    } ${dateFilterActive ? styles.periodMenuTriggerActive : ""}`}
                    aria-expanded={periodMenuOpen}
                    aria-haspopup="dialog"
                    onClick={() => setPeriodMenuOpen((current) => !current)}
                  >
                    <Calendar size={14} aria-hidden />
                    <span>{periodSummary}</span>
                    <ChevronDown size={14} aria-hidden />
                  </button>
                  {periodMenuOpen ? (
                    <div className={styles.periodDropdown} role="dialog" aria-label="Календарь">
                      <div className={styles.calendar}>
                        <div className={styles.calendarHead}>
                          <button
                            type="button"
                            className={styles.calendarNav}
                            aria-label="Предыдущий месяц"
                            onClick={() =>
                              setCalendarMonth((current) => {
                                const date = new Date(current.year, current.month - 1, 1);
                                return { year: date.getFullYear(), month: date.getMonth() };
                              })
                            }
                          >
                            <ChevronLeft size={16} aria-hidden />
                          </button>
                          <span className={styles.calendarTitle}>{calendarTitle}</span>
                          <button
                            type="button"
                            className={styles.calendarNav}
                            aria-label="Следующий месяц"
                            onClick={() =>
                              setCalendarMonth((current) => {
                                const date = new Date(current.year, current.month + 1, 1);
                                return { year: date.getFullYear(), month: date.getMonth() };
                              })
                            }
                          >
                            <ChevronRight size={16} aria-hidden />
                          </button>
                        </div>
                        <div className={styles.calendarWeekdays}>
                          {WEEKDAY_LABELS.map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>
                        <div className={styles.calendarGrid}>
                          {calendarCells.map((cell) =>
                            cell.day == null ? (
                              <span key={cell.key} className={styles.calendarEmpty} />
                            ) : (
                              <button
                                key={cell.key}
                                type="button"
                                className={`${styles.calendarDay} ${
                                  cell.key === todayKey ? styles.calendarDayToday : ""
                                } ${
                                  cell.key === selectedDay ? styles.calendarDaySelected : ""
                                }`}
                                onClick={() => {
                                  setSelectedDay((current) =>
                                    current === cell.key ? "" : cell.key
                                  );
                                  setPeriodMenuOpen(false);
                                }}
                              >
                                {cell.day}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={styles.messages} ref={messagesScrollRef}>
              {loadingMessages || opening ? (
                <div className={styles.loadingState}>
                  <Loader2 className={styles.spinner} size={20} aria-hidden />
                  <span>Загрузка истории…</span>
                </div>
              ) : isGroupsPanel && groupMessages.length === 0 ? (
                <div className={styles.emptyState}>
                  <Users size={22} aria-hidden />
                  <p>В этой группе пока нет сохранённых сообщений.</p>
                </div>
              ) : isGroupsPanel && filteredGroupMessages.length === 0 ? (
                <div className={styles.emptyState}>
                  <Calendar size={22} aria-hidden />
                  <p>Нет сообщений за выбранный день.</p>
                  <button type="button" className={styles.periodClearInline} onClick={clearDateFilter}>
                    Показать всю историю
                  </button>
                </div>
              ) : isGroupsPanel ? (
                filteredGroupMessages.map((item) => {
                  const sender = item.sender || "Участник";
                  const avatarKey = item.senderId || sender;
                  return (
                    <article key={item.id} className={styles.groupMessage}>
                      <span
                        className={styles.avatar}
                        style={{ background: senderAvatarColor(avatarKey) }}
                        aria-hidden
                      >
                        {senderInitials(sender)}
                      </span>
                      <div className={`${styles.messageBubble} ${styles.groupBubble}`}>
                        <div className={styles.messageMeta}>
                          <strong>{sender}</strong>
                          <span>{formatDateTime(item.time || item.receivedAt)}</span>
                        </div>
                        {wechatDisplayText(item) ? <p>{wechatDisplayText(item)}</p> : null}
                        {isWechatImage(item) && fileUrls[item.id] ? (
                          <img
                            className={styles.mediaPreview}
                            src={fileUrls[item.id]}
                            alt={item.file?.name || "изображение"}
                          />
                        ) : null}
                        {isWechatImage(item) && !fileUrls[item.id] && hasDownloadableWechatFile(item) ? (
                          <p>Изображение ещё загружается…</p>
                        ) : null}
                        {isWechatImage(item) && !fileUrls[item.id] && !hasDownloadableWechatFile(item) && item.file?.error ? (
                          <p>Изображение не скачано: {item.file.error}</p>
                        ) : null}
                        {isWechatMedia(item) && !isWechatImage(item) ? (
                          <div className={styles.attachmentList}>
                            <button
                              type="button"
                              className={styles.attachmentLink}
                              onClick={() => void downloadGroupAttachment(item)}
                            >
                              <Download size={14} aria-hidden />
                              <span>{item.file?.name || item.text || "вложение"}</span>
                              <small>
                                {item.file?.kind || item.type || "файл"}
                                {item.file?.size ? ` · ${formatFileSize(item.file.size)}` : ""}
                                {item.file?.error ? " · не скачан" : ""}
                              </small>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : messages.length === 0 ? (
                <div className={styles.emptyState}>
                  <MessageCircle size={22} aria-hidden />
                  <p>
                    {isDeveloper
                      ? "Диалог пока пустой. Дождитесь сообщения пользователя или отправьте первый ответ."
                      : "Здесь появится история общения с разработчиком."}
                  </p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className={styles.emptyState}>
                  <Calendar size={22} aria-hidden />
                  <p>Нет сообщений за выбранный день.</p>
                  <button type="button" className={styles.periodClearInline} onClick={clearDateFilter}>
                    Показать всю историю
                  </button>
                </div>
              ) : (
                filteredMessages.map((item) => {
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

            {isGroupsPanel ? (
              <div className={styles.readonlyBar}>
                <Users size={16} aria-hidden />
                <span>
                  Только просмотр группы <strong>{activeGroup?.name || ""}</strong>. Писать сюда нельзя.
                </span>
              </div>
            ) : (
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
            )}

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
      <div className={styles.fabStack}>
        <button
          type="button"
          className={styles.fabWechat}
          onClick={() => {
            void openGroupsWidget();
          }}
          aria-label="Группы WeChat"
          title="Группы WeChat"
        >
          <img className={styles.fabWechatImg} src={wechatFabIcon} alt="" />
        </button>
        <button
          type="button"
          className={styles.fab}
          onClick={() => {
            void openPersonalWidget();
          }}
          aria-label={
            unreadTotal > 0
              ? `Личные чаты с разработчиком, непрочитанных: ${unreadTotal}`
              : "Личные чаты с разработчиком"
          }
          title="Личные чаты"
        >
          <FeedbackFabIcon />
          {unreadTotal > 0 ? <span className={styles.fabBadge}>{unreadTotal}</span> : null}
        </button>
      </div>

      {open ? createPortal(modal, document.body) : null}
    </>
  );
}
