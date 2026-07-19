"use client";

import { CarFront, Heart, Home, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/favorites", label: "Избранное", icon: Heart },
  { href: "/sell", label: "Добавить", icon: Plus, add: true },
  { href: "/my", label: "Мои авто", icon: CarFront },
  { href: "/profile", label: "Профиль", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map(({ href, label, icon: Icon, add }) => (
        <Link
          key={href}
          href={href}
          className={`nav-item${pathname === href ? " active" : ""}${add ? " add" : ""}`}
        >
          <Icon size={add ? 25 : 21} strokeWidth={2.2} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
