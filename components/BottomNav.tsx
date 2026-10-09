"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, Dumbbell, BookOpenText, CircleUserRound } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Lộ trình", icon: Route },
  { href: "/luyen-tap", label: "Luyện tập", icon: Dumbbell },
  { href: "/tu-dien", label: "Từ điển", icon: BookOpenText },
  { href: "/ho-so", label: "Hồ sơ", icon: CircleUserRound },
];

/** Điện thoại: thanh dính đáy. Máy tính (≥1100px): cột trái có logo. */
export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Điều hướng chính">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="nav-brand" src="/img/logo.png" alt="VSLV" />
      <div className="nav-in">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}>
              <Icon size={24} strokeWidth={active ? 2.4 : 2} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
