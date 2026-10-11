"use client";

import { asset } from "@/lib/base";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, Dumbbell, Languages, CircleUserRound, Search } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Lộ trình", icon: Route },
  { href: "/luyen-tap", label: "Luyện tập", icon: Dumbbell },
  { href: "/tu-dien", label: "Từ điển", icon: Languages },
  { href: "/ho-so", label: "Hồ sơ", icon: CircleUserRound },
];

/**
 * Figma "Bottom nav" (355:7814): viên thuốc nổi + nút tìm tròn 76px.
 * Máy tính (≥1100px): thành cột trái có logo, ẩn nút tìm.
 */
export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Điều hướng chính">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="nav-brand" src={asset("/img/logo.webp")} alt="VSLV" />
      <div className="nav-in">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}>
              <Icon size={24} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
      <Link href="/tu-dien?tim=1" className="nav-search" aria-label="Tìm từ">
        <Search size={28} aria-hidden />
      </Link>
    </nav>
  );
}
