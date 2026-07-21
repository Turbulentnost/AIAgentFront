import type { Contour4Notification } from "@/types/contour4";
import styles from "../Contour4Workspace.module.css";
import { notifyTypeClassMap, statusClass } from "../lib/statusClass";

export default function NotificationsPanel({
  notifications,
  unread
}: {
  notifications: Contour4Notification[];
  unread: number;
}) {
  const typeMap = notifyTypeClassMap(styles);

  return (
    <div className={styles.panelCard}>
      <div className={styles.panelCardHead}>
        Уведомления
        {unread > 0 ? <span className={styles.badgeCount}>{unread}</span> : null}
      </div>
      <div className={styles.panelCardBody}>
        {!notifications.length ? (
          <p className={styles.hitlEmpty}>Нет уведомлений</p>
        ) : (
          <ul className={styles.notifList}>
            {notifications.map((n) => (
              <li
                key={n.id}
                className={n.unread ? styles.notifItemUnread : styles.notifItem}
              >
                <div className={statusClass(typeMap, n.type)}>{n.type}</div>
                <div className={styles.nTitle}>{n.title}</div>
                <div className={styles.nText}>{n.text}</div>
                <div className={styles.nTime}>{n.time}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
