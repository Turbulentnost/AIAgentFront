import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints";
import { platformAuthApi } from "@/auth/platformAuthApi";
import {
  clearOneCSession,
  getOneCCredentials,
  saveOneCCredentials
} from "@/auth/onecSession";
import type { LoginPayload, User } from "@/types";
import { AuthProfileError } from "@/auth/errors";
import { clearAuthTokens, readAccessToken, writeAuthTokens } from "@/auth/authStorage";

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
  if (readAccessToken()) return "platform";
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<AuthMode | null>(detectAuthMode);
  const [accessToken, setAccessToken] = useState<string | null>(() => readAccessToken());
  const [onecCredentials, setOnecCredentials] = useState(() => getOneCCredentials());
  const onecLoginPromise = useRef<Promise<void> | null>(null);

  const hasPlatformToken = Boolean(accessToken);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => platformAuthApi().me(),
    enabled: hasPlatformToken,
    retry: false
  });

  useEffect(() => {
    if (!meQuery.isError || !hasPlatformToken) return;
    if (isOneCSessionAuthError(meQuery.error)) return;

    clearAuthTokens();
    setAccessToken(null);
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
    mutationFn: (payload: LoginPayload) => platformAuthApi().login(payload),
    onSuccess: async (token) => {
      clearOneCSession();
      writeAuthTokens(token.access_token, token.expires_at);
      setOnecCredentials(null);
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
      writeAuthTokens(result.access_token, result.expires_at);
      setAccessToken(result.access_token);
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
          const profile = await platformAuthApi().me();
          setAccessToken(readAccessToken());
          setAuthMode("platform");
          queryClient.setQueryData(["auth", "me"], profile);
        } catch (error) {
          clearAuthTokens();
          setAccessToken(null);
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
          if (hasPlatformToken) await platformAuthApi().logout();
        } catch {
          // ignore logout errors
        } finally {
          clearAuthTokens();
          setAccessToken(null);
          clearOneCSession();
          setOnecCredentials(null);
          setAuthMode(null);
          queryClient.clear();
        }
      }
    };
  }, [
    authMode,
    accessToken,
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
