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

type TelegramDeepLoginStart = {
  token: string;
  url: string;
  expiresAt: string;
};

type TelegramDeepLoginPoll = { status: "pending" } | { status: "confirmed"; user: SafeUser };

const AuthContext = createContext<AuthContextValue | null>(null);
const PENDING_LOGIN_KEY = "carby-pending-telegram-login";

async function waitForTelegramInitData(timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const initData = window.Telegram?.WebApp.initData;
    if (initData) return initData;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return "";
}

function savePendingLogin(login: Pick<TelegramDeepLoginStart, "token" | "expiresAt">) {
  window.sessionStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify(login));
}

function readPendingLogin(): Pick<TelegramDeepLoginStart, "token" | "expiresAt"> | null {
  const raw = window.sessionStorage.getItem(PENDING_LOGIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Pick<TelegramDeepLoginStart, "token" | "expiresAt">;
    if (!parsed.token || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingLogin() {
  window.sessionStorage.removeItem(PENDING_LOGIN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginHint, setLoginHint] = useState<string | null>(null);

  const pollTelegramLogin = useCallback(async (token: string, expiresAt: string) => {
    const deadline = new Date(expiresAt).getTime();
    setLoginHint("Жду подтверждение в Telegram. Нажмите Start в боте и вернитесь на сайт.");

    while (Date.now() < deadline) {
      const poll = await api<TelegramDeepLoginPoll>("/api/auth/telegram-deep-login/poll", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      if (poll.status === "confirmed") {
        clearPendingLogin();
        setUser(poll.user);
        setError(null);
        setLoginHint(null);
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    }

    clearPendingLogin();
    throw new Error("Время подтверждения истекло. Нажмите «Войти через Telegram» ещё раз.");
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ user: SafeUser }>("/api/auth/me");
      setUser(result.user);
      setError(null);
      setLoginHint(null);
    } catch {
      setUser(null);
      const pendingLogin = readPendingLogin();
      if (pendingLogin && new Date(pendingLogin.expiresAt).getTime() > Date.now()) {
        try {
          await pollTelegramLogin(pendingLogin.token, pendingLogin.expiresAt);
          return;
        } catch (pollError) {
          setError(pollError instanceof Error ? pollError.message : "Не удалось завершить вход через Telegram");
          setLoginHint(null);
        }
      }

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
  }, [pollTelegramLogin]);

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
    try {
      setError(null);
      setLoginHint("Сейчас откроется бот Telegram. Нажмите Start, затем вернитесь на сайт.");
      const start = await api<TelegramDeepLoginStart>("/api/auth/telegram-deep-login/start", {
        method: "POST",
      });
      savePendingLogin({ token: start.token, expiresAt: start.expiresAt });
      window.location.href = start.url;
    } catch (loginError) {
      clearPendingLogin();
      setUser(null);
      setError(loginError instanceof Error ? loginError.message : "Не удалось войти через Telegram");
      setLoginHint(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error: error ?? loginHint, loginWithTelegram, loginForDevelopment, refresh }),
    [user, loading, error, loginHint, loginWithTelegram, loginForDevelopment, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
