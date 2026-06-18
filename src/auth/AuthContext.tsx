import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints";
import {
  clearOneCSession,
  getOneCCredentials,
  saveOneCCredentials
} from "@/auth/onecSession";
import type { LoginPayload, User } from "@/types";
import { AuthProfileError } from "@/auth/errors";

export type AuthMode = "platform" | "onec";

function isOneCSessionAuthError(error: unknown): boolean {
  const detail = (error as { response?: { data?: { detail?: { code?: string } | string } } })?.response?.data
    ?.detail;
  if (typeof detail !== "object" || !detail?.code) return false;
  return detail.code === "onec_session_expired" || detail.code === "onec_session_invalid";
}

interface AuthContextValue {
  user: User | null;
  authMode: AuthMode | null;
  hasOneCAccess: boolean;
  needsOneCReauth: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  loginWith1C: (payload: { fio: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function detectAuthMode(): AuthMode | null {
  if (localStorage.getItem("access_token")) return "platform";
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<AuthMode | null>(detectAuthMode);
  const [onecCredentials, setOnecCredentials] = useState(() => getOneCCredentials());
  const onecLoginPromise = useRef<Promise<void> | null>(null);

  const hasPlatformToken = Boolean(localStorage.getItem("access_token"));

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    enabled: hasPlatformToken,
    retry: false
  });

  useEffect(() => {
    if (!meQuery.isError || !hasPlatformToken) return;
    if (isOneCSessionAuthError(meQuery.error)) return;

    localStorage.removeItem("access_token");
    localStorage.removeItem("token_expires_at");
    setAuthMode(null);
    queryClient.removeQueries({ queryKey: ["auth"] });
  }, [hasPlatformToken, meQuery.error, meQuery.isError, queryClient]);

  useEffect(() => {
    function handleOneCSessionInvalidated() {
      clearOneCSession();
      setOnecCredentials(null);
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["onec", "tasks"] });
    }

    window.addEventListener("onec-session-invalidated", handleOneCSessionInvalidated);
    return () => window.removeEventListener("onec-session-invalidated", handleOneCSessionInvalidated);
  }, [queryClient]);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (token) => {
      clearOneCSession();
      localStorage.setItem("access_token", token.access_token);
      if (token.expires_at) localStorage.setItem("token_expires_at", token.expires_at);
      setOnecCredentials(null);
      setAuthMode("platform");
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      await queryClient.invalidateQueries({ queryKey: ["porucheniya"] });
    }
  });

  const login1CMutation = useMutation({
    mutationFn: authApi.loginWith1C,
    onSuccess: async (result, credentials) => {
      saveOneCCredentials(credentials);
      setOnecCredentials(credentials);
      localStorage.setItem("access_token", result.access_token);
      if (result.expires_at) {
        localStorage.setItem("token_expires_at", result.expires_at);
      }
      setAuthMode("platform");
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["onec", "tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      await queryClient.invalidateQueries({ queryKey: ["porucheniya"] });
    }
  });

  const value = useMemo<AuthContextValue>(() => {
    const platformAuthenticated = hasPlatformToken && Boolean(meQuery.data);
    const hasOneCAccess = hasPlatformToken && Boolean(onecCredentials);
    const needsOneCReauth =
      meQuery.isSuccess &&
      Boolean(meQuery.data?.has_onec_credentials) &&
      !onecCredentials;
    const user = platformAuthenticated && meQuery.data ? meQuery.data : null;

    return {
      user,
      authMode: hasPlatformToken ? "platform" : authMode,
      hasOneCAccess,
      needsOneCReauth,
      isAuthenticated: platformAuthenticated,
      isLoading: hasPlatformToken && meQuery.isLoading,
      login: async (payload) => {
        await loginMutation.mutateAsync(payload);
        try {
          await queryClient.fetchQuery({ queryKey: ["auth", "me"], queryFn: authApi.me });
        } catch (error) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("token_expires_at");
          queryClient.removeQueries({ queryKey: ["auth"] });
          if (error instanceof Error && (error.message.includes("timeout") || error.message.includes("Timeout"))) {
            throw new AuthProfileError("Сервер не ответил на запрос профиля за 30 секунд. Проверьте бэкенд /auth/me");
          }
          throw new AuthProfileError("Ошибка сервера при загрузке профиля (GET /auth/me). Обратитесь к разработчику бэкенда");
        }
      },
      loginWith1C: async (payload) => {
        if (onecLoginPromise.current) {
          await onecLoginPromise.current;
          return;
        }
        onecLoginPromise.current = login1CMutation
          .mutateAsync(payload)
          .then(() => undefined)
          .finally(() => {
            onecLoginPromise.current = null;
          });
        await onecLoginPromise.current;
      },
      logout: async () => {
        try {
          if (hasPlatformToken) await authApi.logout();
        } catch {
          // ignore logout errors
        } finally {
          localStorage.removeItem("access_token");
          localStorage.removeItem("token_expires_at");
          clearOneCSession();
          setOnecCredentials(null);
          setAuthMode(null);
          queryClient.clear();
        }
      }
    };
  }, [
    authMode,
    hasPlatformToken,
    login1CMutation,
    loginMutation,
    meQuery.data,
    meQuery.isLoading,
    onecCredentials,
    meQuery.isSuccess,
    queryClient
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
