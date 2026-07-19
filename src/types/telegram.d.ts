export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        ready(): void;
        expand(): void;
        close(): void;
        colorScheme: "light" | "dark";
        BackButton: {
          show(): void;
          hide(): void;
          onClick(callback: () => void): void;
          offClick(callback: () => void): void;
        };
        HapticFeedback?: { impactOccurred(style: "light" | "medium" | "heavy"): void };
      };
      Login?: {
        auth(
          options: { bot_id: string; request_access?: "write" },
          callback: (user: false | TelegramLoginUser) => void,
        ): void;
      };
    };
  }

  type TelegramLoginUser = {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  };
}
