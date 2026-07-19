"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function BackButton() {
  const router = useRouter();
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    const goBack = () => router.back();
    webApp.BackButton.show();
    webApp.BackButton.onClick(goBack);
    return () => {
      webApp.BackButton.offClick(goBack);
      webApp.BackButton.hide();
    };
  }, [router]);
  return (
    <button className="icon-button" onClick={() => router.back()} aria-label="Назад">
      <ArrowLeft size={21} />
    </button>
  );
}
