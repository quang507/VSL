"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, Dumbbell, Languages, CircleUserRound } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Lộ trình", icon: Route },
  { href: "/luyen-tap", label: "Luyện tập", icon: Dumbbell },
  { href: "/tu-dien", label: "Từ điển", icon: Languages },
  { href: "/ho-so", label: "Hồ sơ", icon: CircleUserRound },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Điều hướng chính">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon size={24} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
