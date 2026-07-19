import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { AuthProvider } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AutoMarket Беларусь", template: "%s — AutoMarket" },
  description: "Маркетплейс автомобилей с пробегом в Беларуси",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#11171c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="beforeInteractive" />
        <AuthProvider>
          <main className="app-shell">{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
