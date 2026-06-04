import { useMemo, useState } from "react";
import { Bell, ChevronDown, Search } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { nav } from "./Sidebar";

export default function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const [notificationCount, setNotificationCount] = useState(8);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const displayName = user?.full_name || user?.email || "Пользователь";
  const position = user?.position || (user?.is_superuser ? "Суперадминистратор" : "Пользователь платформы");
  const initials = useMemo(() => {
    const source = user?.full_name || user?.username || user?.email || "Пользователь";
    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [user?.email, user?.full_name, user?.username]);

  return (
    <header className="topbar">
      <Link className="header-brand" to="/" aria-label="AI Agents Platform">
        <img src="/platform-logo.png" alt="" width={28} height={28} />
        <span>AI Agents Platform</span>
      </Link>

      <nav className="header-nav" aria-label="Основная навигация">
        {nav.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `header-nav-link ${isActive ? "active" : ""}`}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar-actions">
        <label className="header-search" aria-label={`Поиск на странице ${title}`}>
          <Search aria-hidden="true" size={17} strokeWidth={2.2} />
          <input type="search" placeholder="Поиск..." />
          <kbd>⌘K</kbd>
        </label>

        <button
          className="notification-button"
          type="button"
          aria-label={`Уведомления: ${notificationCount}`}
          onClick={() => setNotificationCount((count) => count + 1)}
        >
          <Bell aria-hidden="true" size={22} strokeWidth={1.9} />
          <span className="notification-badge">{notificationCount}</span>
        </button>

        <div className="profile-menu">
          <button
            className="profile-button"
            type="button"
            aria-expanded={isProfileOpen}
            onClick={() => setIsProfileOpen((value) => !value)}
          >
            {user?.avatar_url ? (
              <img className="profile-avatar" src={user.avatar_url} alt="" />
            ) : (
              <span className="profile-avatar fallback">{initials || "П"}</span>
            )}
            <span className="profile-copy">
              <strong>{displayName}</strong>
              <small>{position}</small>
            </span>
            <ChevronDown aria-hidden="true" className={isProfileOpen ? "profile-chevron open" : "profile-chevron"} size={16} strokeWidth={2.2} />
          </button>

          {isProfileOpen && (
            <div className="profile-dropdown">
              <NavLink to="/profile" onClick={() => setIsProfileOpen(false)}>
                Профиль
              </NavLink>
              <button type="button" onClick={() => void logout()}>
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
