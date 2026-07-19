"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { SafeUser } from "@/lib/types";

type AuthContextValue = {
  user: SafeUser | null;
  loading: boolean;
  error: string | null;
  loginForDevelopment(): Promise<void>;
  refresh(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ user: SafeUser }>("/api/auth/me");
      setUser(result.user);
      setError(null);
    } catch {
      const initData = window.Telegram?.WebApp.initData;
      if (initData) {
        try {
          const result = await api<{ user: SafeUser }>("/api/auth/telegram", {
            method: "POST",
            body: JSON.stringify({ initData }),
          });
          setUser(result.user);
          setError(null);
        } catch (authError) {
          setError(authError instanceof Error ? authError.message : "Ошибка Telegram-авторизации");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.Telegram?.WebApp.ready();
    window.Telegram?.WebApp.expand();
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const loginForDevelopment = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ user: SafeUser }>("/api/auth/dev", { method: "POST" });
      setUser(result.user);
      setError(null);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, loginForDevelopment, refresh }),
    [user, loading, error, loginForDevelopment, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
