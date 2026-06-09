import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints";
import {
  buildOneCUser,
  clearOneCSession,
  getOneCSession,
  hasOneCSession,
  isOneCSessionValid,
  saveOneCSession
} from "@/auth/onecSession";
import type { LoginPayload, User } from "@/types";

export type AuthMode = "platform" | "onec";

interface AuthContextValue {
  user: User | null;
  authMode: AuthMode | null;
  hasOneCAccess: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  loginWith1C: (payload: { fio: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function detectAuthMode(): AuthMode | null {
  if (localStorage.getItem("access_token")) return "platform";
  if (isOneCSessionValid()) return "onec";
  return null;
}

function isOneCSessionExpiredError(error: unknown): boolean {
  const detail = (error as { response?: { data?: { detail?: { code?: string } | string } } })?.response?.data
    ?.detail;
  if (typeof detail === "object" && detail?.code === "onec_session_expired") return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<AuthMode | null>(detectAuthMode);
  const [onecSession, setOnecSession] = useState(() => getOneCSession());
  const onecLoginInFlight = useRef(false);

  const hasPlatformToken = Boolean(localStorage.getItem("access_token"));

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    enabled: hasPlatformToken,
    retry: false
  });

  const shouldRestoreOneCSession =
    hasPlatformToken &&
    meQuery.isSuccess &&
    Boolean(meQuery.data?.is_created_via_1c || meQuery.data?.source_system === "1c") &&
    !hasOneCSession();

  const onecSessionQuery = useQuery({
    queryKey: ["auth", "onec-session"],
    queryFn: authApi.getOneCSession,
    enabled: shouldRestoreOneCSession,
    retry: false
  });

  useEffect(() => {
    if (onecSessionQuery.data) {
      saveOneCSession(onecSessionQuery.data);
      setOnecSession(onecSessionQuery.data);
    }
  }, [onecSessionQuery.data]);

  useEffect(() => {
    if (!onecSessionQuery.isError) return;
    if (isOneCSessionExpiredError(onecSessionQuery.error)) {
      clearOneCSession();
      setOnecSession(null);
    }
  }, [onecSessionQuery.error, onecSessionQuery.isError]);

  useEffect(() => {
    if (!meQuery.isError) return;
    if (isOneCSessionExpiredError(meQuery.error)) {
      clearOneCSession();
      setOnecSession(null);
    }
  }, [meQuery.error, meQuery.isError]);

  useEffect(() => {
    function handleOneCSessionInvalidated() {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_expires_at");
      clearOneCSession();
      setOnecSession(null);
      setAuthMode(null);
      queryClient.clear();
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
      setOnecSession(null);
      setAuthMode("platform");
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    }
  });

  const login1CMutation = useMutation({
    mutationFn: authApi.loginWith1C,
    onSuccess: async (result) => {
      saveOneCSession(result.onec_session);
      setOnecSession(result.onec_session);
      localStorage.setItem("access_token", result.access_token);
      if (result.expires_at) {
        localStorage.setItem("token_expires_at", result.expires_at);
      }
      setAuthMode("platform");
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["onec", "tasks"] });
    }
  });

  const value = useMemo<AuthContextValue>(() => {
    const platformAuthenticated = hasPlatformToken && Boolean(meQuery.data);
    const onecAuthenticated =
      authMode === "onec" && isOneCSessionValid(onecSession) && !hasPlatformToken;
    const hasOneCAccess = hasOneCSession() || Boolean(onecSessionQuery.data?.token);
    const user =
      platformAuthenticated && meQuery.data
        ? meQuery.data
        : onecAuthenticated && onecSession
          ? buildOneCUser(onecSession)
          : null;

    return {
      user,
      authMode: hasPlatformToken ? "platform" : authMode,
      hasOneCAccess,
      isAuthenticated: platformAuthenticated || onecAuthenticated,
      isLoading:
        (hasPlatformToken && meQuery.isLoading) ||
        (hasPlatformToken && onecSessionQuery.isLoading && !hasOneCSession()),
      login: async (payload) => {
        await loginMutation.mutateAsync(payload);
      },
      loginWith1C: async (payload) => {
        if (onecLoginInFlight.current) return;
        onecLoginInFlight.current = true;
        try {
          await login1CMutation.mutateAsync(payload);
        } finally {
          onecLoginInFlight.current = false;
        }
      },
      logout: async () => {
        try {
          if (hasPlatformToken) await authApi.logout();
        } catch {
          // ignore revoke errors on logout
        } finally {
          localStorage.removeItem("access_token");
          localStorage.removeItem("token_expires_at");
          clearOneCSession();
          setOnecSession(null);
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
    onecSession,
    onecSessionQuery.data,
    onecSessionQuery.isLoading,
    queryClient
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
