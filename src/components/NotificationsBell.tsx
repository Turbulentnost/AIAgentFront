import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, Loader2, X } from "lucide-react";
import {
  getNotificationError,
  useAcceptNotification,
  useDismissNotification,
  useNotifications,
  useOpenNotification
} from "@/hooks/useNotifications";
import type { AppNotification, TurboProjectRgSeriesProposal } from "@/types/notifications";
import styles from "./NotificationsBell.module.css";

const WEEKDAY_LABELS: Record<string, string> = {
  monday: "понедельник",
  tuesday: "вторник",
  wednesday: "среда",
  thursday: "четверг",
  friday: "пятница",
  saturday: "суббота",
  sunday: "воскресенье"
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return value;
  return `${match[1]}:${match[2]}`;
}

function formatCreatedAt(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isUnread(item: AppNotification): boolean {
  return !item.read_at && !item.resolved_at;
}

export default function NotificationsBell() {
  const { data, isLoading, canAccess, permissionsLoading } = useNotifications();
  const openMutation = useOpenNotification();
  const acceptMutation = useAcceptNotification();
  const dismissMutation = useDismissNotification();

  const [isOpen, setIsOpen] = useState(false);
  const [proposal, setProposal] = useState<TurboProjectRgSeriesProposal | null>(null);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const items = data?.items ?? [];
  const unreadCount = data?.unread_count ?? 0;
  const busy =
    openMutation.isPending || acceptMutation.isPending || dismissMutation.isPending;

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const visibleItems = useMemo(
    () => items.filter((item) => !item.resolved_at),
    [items]
  );

  if (permissionsLoading) return null;
  if (!canAccess) return null;

  async function handleOpenItem(item: AppNotification) {
    setActionError(null);
    setActiveNotificationId(item.id);
    try {
      const result = await openMutation.mutateAsync(item.id);
      if (result.proposal) {
        setProposal(result.proposal);
        setIsOpen(false);
        return;
      }
      setActionError("Для этого уведомления нет предложения серии");
      setActiveNotificationId(null);
    } catch (error) {
      setActionError(getNotificationError(error, "Не удалось открыть уведомление"));
      setActiveNotificationId(null);
    }
  }

  async function handleAccept() {
    if (!activeNotificationId) return;
    setActionError(null);
    try {
      await acceptMutation.mutateAsync({ notificationId: activeNotificationId });
      setProposal(null);
      setActiveNotificationId(null);
    } catch (error) {
      setActionError(getNotificationError(error, "Не удалось создать серию РГ"));
    }
  }

  async function handleDismiss() {
    if (!activeNotificationId) {
      setProposal(null);
      return;
    }
    setActionError(null);
    try {
      await dismissMutation.mutateAsync(activeNotificationId);
      setProposal(null);
      setActiveNotificationId(null);
    } catch (error) {
      setActionError(getNotificationError(error, "Не удалось отклонить уведомление"));
    }
  }

  function closeProposal() {
    if (busy) return;
    setProposal(null);
    setActiveNotificationId(null);
    setActionError(null);
  }

  return (
    <>
      <div className={styles.wrap} ref={wrapRef}>
        <button
          type="button"
          className="notification-button"
          aria-label="Уведомления"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <Bell aria-hidden="true" size={18} strokeWidth={2.2} />
          {unreadCount > 0 ? (
            <span className="notification-badge" aria-label={`Есть непрочитанные уведомления: ${unreadCount}`} />
          ) : null}
        </button>

        {isOpen ? (
          <div className={styles.panel} role="dialog" aria-label="Список уведомлений">
            <div className={styles.panelHeader}>
              <h2>Уведомления</h2>
            </div>
            <div className={styles.panelBody}>
              {isLoading ? <p className={styles.status}>Загрузка…</p> : null}
              {!isLoading && visibleItems.length === 0 ? (
                <p className={styles.empty}>Новых уведомлений нет</p>
              ) : null}
              {!isLoading
                ? visibleItems.map((item) => {
                    const unread = isUnread(item);
                    const opening = openMutation.isPending && activeNotificationId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.item} ${unread ? styles.itemUnread : ""}`}
                        disabled={busy}
                        onClick={() => void handleOpenItem(item)}
                      >
                        <span className={styles.itemTitle}>
                          <span>{item.title}</span>
                          {unread ? <span className={styles.dot} aria-hidden="true" /> : null}
                        </span>
                        {item.body ? <p className={styles.itemBody}>{item.body}</p> : null}
                        <span className={styles.itemMeta}>
                          {opening ? "Готовим предложение…" : formatCreatedAt(item.created_at)}
                        </span>
                      </button>
                    );
                  })
                : null}
              {actionError && !proposal ? (
                <div className={styles.error} role="alert">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{actionError}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {proposal ? (
        <div className={styles.overlay} role="presentation" onClick={closeProposal}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rg-proposal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="rg-proposal-title">Предложение серии РГ</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeProposal}
                disabled={busy}
                aria-label="Закрыть"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <p className={styles.lead}>
              Найден новый проект в TurboProject. Проверьте параметры еженедельной серии рабочей
              группы. После подтверждения серия появится в графике со статусом «Создано» без
              планирования в Outlook.
            </p>

            <dl className={styles.grid}>
              <div>
                <dt>Проект</dt>
                <dd>{proposal.project_name}</dd>
              </div>
              {proposal.nomer_proekta ? (
                <div>
                  <dt>Номер</dt>
                  <dd>{proposal.nomer_proekta}</dd>
                </div>
              ) : null}
              <div>
                <dt>Тема</dt>
                <dd>{proposal.title}</dd>
              </div>
              <div>
                <dt>Категория</dt>
                <dd>{proposal.meeting_category_name}</dd>
              </div>
              <div>
                <dt>Период</dt>
                <dd>
                  {formatDate(proposal.series_start_date)} — {formatDate(proposal.series_end_date)}
                </dd>
              </div>
              <div>
                <dt>Расписание</dt>
                <dd>
                  {proposal.recurrence_label || "Еженедельно"},{" "}
                  {WEEKDAY_LABELS[proposal.weekly_slot.weekday] ?? proposal.weekly_slot.weekday}{" "}
                  {formatTime(proposal.weekly_slot.time_local)},{" "}
                  {proposal.weekly_slot.duration_minutes} мин
                </dd>
              </div>
              <div>
                <dt>Руководитель</dt>
                <dd>
                  {proposal.manager.fio}
                  <br />
                  <span style={{ fontWeight: 500 }}>{proposal.manager.email}</span>
                </dd>
              </div>
              <div>
                <dt>Ответственный</dt>
                <dd>
                  {proposal.responsible.fio}
                  <br />
                  <span style={{ fontWeight: 500 }}>{proposal.responsible.email}</span>
                </dd>
              </div>
            </dl>

            {proposal.participants.length ? (
              <ul className={styles.participants}>
                {proposal.participants.map((participant) => (
                  <li key={participant.user_id}>
                    {participant.fio}
                    {participant.role ? ` · ${participant.role}` : ""}
                    {participant.email ? ` · ${participant.email}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}

            {proposal.weekly_slot.fallback ? (
              <p className={styles.fallbackNote}>
                Свободный слот по кворуму не найден — предложен запасной вариант (понедельник
                10:00). При необходимости скорректируйте серию позже в графике.
              </p>
            ) : null}

            {actionError ? (
              <div className={styles.error} role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busy}
                onClick={() => void handleDismiss()}
              >
                Отклонить
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={busy || !activeNotificationId}
                onClick={() => void handleAccept()}
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                    Создаём…
                  </>
                ) : (
                  "Создать серию"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
