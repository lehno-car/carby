"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/lib/api";
import type { SafeUser } from "@/lib/types";

type AuthContextValue = {
  user: SafeUser | null;
  loading: boolean;
  error: string | null;
  loginWithTelegram(): Promise<void>;
  loginForDevelopment(): Promise<void>;
  refresh(): Promise<void>;
};

type TelegramLoginConfig = {
  botId: string;
  botUsername: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function waitForTelegramInitData(timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const initData = window.Telegram?.WebApp.initData;
    if (initData) return initData;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
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
      setUser(null);
      const initData = await waitForTelegramInitData();
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
      } else {
        setError(null);
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

  const loginWithTelegram = useCallback(async () => {
    setLoading(true);
    try {
      const config = await api<TelegramLoginConfig>("/api/auth/telegram-login/config");
      const login = window.Telegram?.Login;
      if (!login) {
        throw new Error("Telegram Login Widget не загрузился. Обновите страницу и попробуйте ещё раз.");
      }

      const telegramUser = await new Promise<TelegramLoginUser>((resolve, reject) => {
        login.auth({ bot_id: config.botId, request_access: "write" }, (result) => {
          if (!result) {
            reject(new Error("Вход через Telegram отменён"));
            return;
          }
          resolve(result);
        });
      });

      const result = await api<{ user: SafeUser }>("/api/auth/telegram-login", {
        method: "POST",
        body: JSON.stringify(telegramUser),
      });
      setUser(result.user);
      setError(null);
    } catch (loginError) {
      setUser(null);
      setError(loginError instanceof Error ? loginError.message : "Не удалось войти через Telegram");
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, loginWithTelegram, loginForDevelopment, refresh }),
    [user, loading, error, loginWithTelegram, loginForDevelopment, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
