import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { useAuth } from "@/auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({
        email,
        password,
        ...(requiresPasswordChange ? { new_password: newPassword } : {})
      });
      navigate("/", { replace: true });
    } catch (err) {
      if (isPasswordChangeRequired(err)) {
        setRequiresPasswordChange(true);
        setError("Введите новый пароль для первого входа.");
      } else {
        setError(getLoginError(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Вход в AI Agents</h1>
        <p>Введите корпоративный email и пароль.</p>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          {requiresPasswordChange ? "Временный пароль" : "Пароль"}
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>
        {requiresPasswordChange && (
          <label>
            Новый пароль
            <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" minLength={8} required />
          </label>
        )}
        {error && <div className="error">{error}</div>}
        <button disabled={isSubmitting}>{isSubmitting ? "Входим..." : requiresPasswordChange ? "Сменить пароль и войти" : "Войти"}</button>
      </form>
    </div>
  );
}

function isPasswordChangeRequired(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  return error.response?.status === 428 && error.response.data?.detail?.code === "password_change_required";
}

function getLoginError(error: unknown): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (typeof detail?.message === "string") return detail.message;
  }
  return "Неверный email или пароль";
}
