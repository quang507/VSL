"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, X, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

type BtnLevel = "accent" | "tertiary" | "positive" | "danger" | "ghost";
type BtnSize = "xl" | "md" | "sm";

interface BtnProps {
  children: ReactNode;
  level?: BtnLevel;
  size?: BtnSize;
  block?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function Btn({ children, level = "accent", size = "xl", block = true, href, onClick, disabled, icon: Icon, style, ariaLabel }: BtnProps) {
  const cls = `btn btn--${level} ${size !== "xl" ? `btn--${size}` : ""} ${block ? "btn--block" : ""}`;
  const inner = (
    <>
      {Icon && <Icon size={size === "sm" ? 18 : 22} aria-hidden />}
      {children}
    </>
  );
  if (href && !disabled)
    return (
      <Link href={href} className={cls} style={style} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} style={style} aria-label={ariaLabel}>
      {inner}
    </button>
  );
}

export function IconBtn({ icon: Icon, label, onClick, href, glass }: { icon: LucideIcon; label: string; onClick?: () => void; href?: string; glass?: boolean }) {
  const cls = `icon-btn ${glass ? "icon-btn--glass" : ""}`;
  if (href)
    return (
      <Link href={href} className={cls} aria-label={label}>
        <Icon size={24} aria-hidden />
      </Link>
    );
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={label}>
      <Icon size={24} aria-hidden />
    </button>
  );
}

/** Thanh tiêu đề: nút quay lại 44px + tiêu đề giữa + nút phụ (tuỳ chọn) */
export function TopBar({ title, back, close, right }: { title?: string; back?: string; close?: boolean; right?: ReactNode }) {
  const router = useRouter();
  const go = () => (back ? router.push(back) : router.back());
  return (
    <div className="topbar">
      <IconBtn icon={close ? X : ChevronLeft} label={close ? "Đóng" : "Quay lại"} onClick={go} />
      <div className="topbar-title">{title}</div>
      {right ?? <span className="topbar-spacer" />}
    </div>
  );
}

export function IconCircle({ icon: Icon, size = 44, iconSize, bg = "var(--brand-soft)", fg = "var(--acc)", square, style }: { icon: LucideIcon; size?: number; iconSize?: number; bg?: string; fg?: string; square?: boolean; style?: CSSProperties }) {
  return (
    <span className={`icon-circle ${square ? "icon-sq" : ""}`} style={{ width: size, height: size, background: bg, color: fg, ...style }} aria-hidden>
      <Icon size={iconSize ?? Math.round(size * 0.5)} strokeWidth={2.2} />
    </span>
  );
}

export function Pill({ children, bg = "var(--brand-soft)", fg = "var(--acc)", icon: Icon, style }: { children: ReactNode; bg?: string; fg?: string; icon?: LucideIcon; style?: CSSProperties }) {
  return (
    <span className="pill" style={{ background: bg, color: fg, ...style }}>
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </span>
  );
}

export function Bar({ pct, color = "var(--brand)", h = 10, track, label = "Tiến độ" }: { pct: number; color?: string; h?: number; track?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="bar" style={{ height: h, background: track }} role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(v, v > 0 ? 4 : 0)}%`, background: color }} />
    </div>
  );
}

/** Vòng điểm (SVG) */
export function Ring({ pct, color = "var(--grn)", size = 160, thick = 16, children }: { pct: number; color?: string; size?: number; thick?: number; children?: ReactNode }) {
  const r = (size - thick) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--neu)" strokeWidth={thick} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thick}
          strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />;
}

export function Segmented<T extends string | number>({ items, value, onChange, label }: { items: { v: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={String(it.v)} type="button" aria-pressed={it.v === value} onClick={() => onChange(it.v)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, href, more }: { children: ReactNode; href?: string; more?: string }) {
  return (
    <div className="row row--between">
      <h2 className="h4">{children}</h2>
      {href && (
        <Link href={href} className="bb" style={{ color: "var(--acc)", minHeight: 44, display: "flex", alignItems: "center" }}>
          {more ?? "Tất cả"}
        </Link>
      )}
    </div>
  );
}

export function Sticker({ src, size = 112, rot = -6, border, alt = "" }: { src: string; size?: number; rot?: number; border?: string; alt?: string }) {
  return (
    <div className="sticker" style={{ width: size, height: size, transform: `rotate(${rot}deg)`, border: border ? `5px solid ${border}` : undefined }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ width: "82%", height: "82%", objectFit: "contain" }} />
    </div>
  );
}

export function Dialog({ open, children, onClose }: { open: boolean; children: ReactNode; onClose?: () => void }) {
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
