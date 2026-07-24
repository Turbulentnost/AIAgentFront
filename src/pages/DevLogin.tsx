import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { isDevAutoLoginEnabled, safeAuthRedirect } from "@/auth/devAutoLogin";
import { isSkipAuth } from "@/auth/skipAuth";

export default function DevLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeAuthRedirect(searchParams.get("redirect"));
  const { isAuthenticated, isLoading, devAutoLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const skipAuth = isSkipAuth();
  const enabled = skipAuth || isDevAutoLoginEnabled();

  useEffect(() => {
    if (!enabled) return;
    if (isLoading) return;
    if (isAuthenticated || skipAuth) {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        await devAutoLogin();
        navigate(redirectTo, { replace: true });
      } catch (err) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (err instanceof Error ? err.message : null);
        setError(
          typeof detail === "string" && detail.trim()
            ? detail
            : "Не удалось выполнить dev auto-login. Проверьте DEV_AUTO_LOGIN на бэкенде."
        );
      }
    })();
  }, [devAutoLogin, enabled, isAuthenticated, isLoading, navigate, redirectTo, skipAuth]);

  if (!enabled) {
    return (
      <div className="auth-page">
        <div className="card" style={{ maxWidth: 480 }}>
          <strong>Dev auto-login выключен</strong>
          <p style={{ marginTop: 12, lineHeight: 1.5 }}>
            Включите <code>VITE_DEV_AUTO_LOGIN=true</code> во фронте и{" "}
            <code>DEV_AUTO_LOGIN=true</code> на бэкенде (только ENVIRONMENT=dev|test), либо{" "}
            <code>VITE_SKIP_AUTH=true</code>.
          </p>
          <p style={{ marginTop: 16 }}>
            <Link to="/login">Перейти к обычному входу</Link>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-page">
        <div className="card" style={{ maxWidth: 480 }}>
          <strong>Ошибка auto-login</strong>
          <p style={{ marginTop: 12, lineHeight: 1.5 }}>{error}</p>
          <p style={{ marginTop: 16 }}>
            <Link to="/login">Перейти к обычному входу</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card">Входим без формы… → {redirectTo}</div>
    </div>
  );
}
