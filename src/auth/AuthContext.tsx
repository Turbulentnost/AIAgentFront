import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints";
import type { LoginPayload, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem("access_token")));

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    enabled: hasToken,
    retry: false
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (token) => {
      localStorage.setItem("access_token", token.access_token);
      if (token.expires_at) localStorage.setItem("token_expires_at", token.expires_at);
      setHasToken(true);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    }
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isAuthenticated: Boolean(hasToken && meQuery.data),
      isLoading: hasToken && meQuery.isLoading,
      login: async (payload) => {
        await loginMutation.mutateAsync(payload);
      },
      logout: async () => {
        try {
          if (hasToken) await authApi.logout();
        } finally {
          localStorage.removeItem("access_token");
          localStorage.removeItem("token_expires_at");
          setHasToken(false);
          queryClient.clear();
        }
      }
    }),
    [hasToken, loginMutation, meQuery.data, meQuery.isLoading, queryClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
