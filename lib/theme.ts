// Màu + icon cho từng chủ đề (bài học). Một chủ đề = một tông màu cố định.
import {
  Stethoscope,
  Hand,
  Heart,
  Users,
  PersonStanding,
  UtensilsCrossed,
  Clock,
  Car,
  PenLine,
  Layers,
  type LucideIcon,
} from "lucide-react";
import type { Lesson } from "./lessons";

export const TONE: Record<Lesson["color"], string> = {
  yellow: "t-yel",
  pink: "t-pnk",
  blue: "t-blu",
  green: "t-grn",
  purple: "t-pur",
  orange: "t-org",
};

export const LESSON_ICON: Record<string, LucideIcon> = {
  "y-te": Stethoscope,
  "chao-hoi": Hand,
  "cam-xuc": Heart,
  "con-nguoi": Users,
  "co-the": PersonStanding,
  "an-uong": UtensilsCrossed,
  "thoi-gian": Clock,
  "di-chuyen": Car,
  "hoat-dong": PenLine,
  "tong-hop": Layers,
};

export function lessonIcon(id: string): LucideIcon {
  return LESSON_ICON[id] ?? Layers;
}

export function sampleUrl(word: string) {
  return `/samples/${encodeURIComponent(word)}.mp4`;
}
