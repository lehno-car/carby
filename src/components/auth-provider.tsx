"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

type TelegramBrowserStatus =
  | { status: "idle" }
  | { status: "pending"; expiresAt: string }
  | { status: "expired" }
  | { status: "confirmed"; user: SafeUser };

const AuthContext = createContext<AuthContextValue | null>(null);
const TELEGRAM_START_PATH = "/api/auth/telegram-browser/start";
const TELEGRAM_STATUS_PATH = "/api/auth/telegram-browser/status";

async function waitForTelegramInitData(timeoutMs = 1_500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const initData = window.Telegram?.WebApp.initData;
    if (initData) return initData;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return "";
}

function telegramStatus() {
  return api<TelegramBrowserStatus>(TELEGRAM_STATUS_PATH, {
    method: "GET",
    cache: "no-store",
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginHint, setLoginHint] = useState<string | null>(null);
  const pollingRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);

  const pollTelegramLogin = useCallback((waitForChallenge: boolean) => {
    if (pollingRef.current) return pollingRef.current;

    const task = (async () => {
      let deadline = Date.now() + 10 * 60 * 1000;
      let challengeSeen = false;
      const challengeDeadline = Date.now() + 15_000;
      setLoginHint("Подтвердите вход в боте Telegram и вернитесь на эту вкладку.");

      while (mountedRef.current && Date.now() < deadline) {
        const result = await telegramStatus();
        if (result.status === "confirmed") {
          setUser(result.user);
          setError(null);
          setLoginHint(null);
          return true;
        }
        if (result.status === "expired") {
          throw new Error("Ссылка входа истекла. Нажмите «Войти через Telegram» ещё раз.");
        }
        if (result.status === "pending") {
          challengeSeen = true;
          const serverDeadline = new Date(result.expiresAt).getTime();
          if (Number.isFinite(serverDeadline)) deadline = serverDeadline;
        } else if (!challengeSeen && (!waitForChallenge || Date.now() >= challengeDeadline)) {
          return false;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      }

      if (!mountedRef.current) return false;
      throw new Error("Время подтверждения истекло. Нажмите «Войти через Telegram» ещё раз.");
    })().finally(() => {
      pollingRef.current = null;
    });

    pollingRef.current = task;
    return task;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ user: SafeUser }>("/api/auth/me", { cache: "no-store" });
      setUser(result.user);
      setError(null);
      setLoginHint(null);
      return;
    } catch {
      setUser(null);
    }

    try {
      const initData = await waitForTelegramInitData();
      if (initData) {
        const result = await api<{ user: SafeUser }>("/api/auth/telegram", {
          method: "POST",
          body: JSON.stringify({ initData }),
        });
        setUser(result.user);
        setError(null);
        setLoginHint(null);
        return;
      }

      const status = await telegramStatus();
      if (status.status === "confirmed") {
        setUser(status.user);
        setError(null);
        setLoginHint(null);
      } else if (status.status === "pending") {
        setLoading(false);
        void pollTelegramLogin(false).catch((reason) => {
          if (!mountedRef.current) return;
          setLoginHint(null);
          setError(reason instanceof Error ? reason.message : "Не удалось завершить вход");
        });
      } else {
        setError(null);
        setLoginHint(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка Telegram-авторизации");
      setLoginHint(null);
    } finally {
      setLoading(false);
    }
  }, [pollTelegramLogin]);

  useEffect(() => {
    mountedRef.current = true;
    window.Telegram?.WebApp.ready();
    window.Telegram?.WebApp.expand();
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const loginForDevelopment = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ user: SafeUser }>("/api/auth/dev", { method: "POST" });
      setUser(result.user);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithTelegram = useCallback(async () => {
    setError(null);
    setLoginHint("Открываю бота Telegram…");

    // This URL creates the challenge on our server and immediately redirects to
    // the official t.me deep link. Opening it synchronously avoids popup blockers
    // and never leaves an empty about:blank tab when the API reports an error.
    const telegramWindow = window.open(
      TELEGRAM_START_PATH,
      "carby-telegram-login",
      "popup,width=520,height=720",
    );
    if (!telegramWindow) {
      window.location.assign(TELEGRAM_START_PATH);
      return;
    }

    try {
      const confirmed = await pollTelegramLogin(true);
      if (!confirmed) {
        throw new Error("Не удалось создать запрос входа. Повторите попытку.");
      }
    } catch (reason) {
      setUser(null);
      setError(reason instanceof Error ? reason.message : "Не удалось войти через Telegram");
      setLoginHint(null);
    }
  }, [pollTelegramLogin]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error: error ?? loginHint,
      loginWithTelegram,
      loginForDevelopment,
      refresh,
    }),
    [user, loading, error, loginHint, loginWithTelegram, loginForDevelopment, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
