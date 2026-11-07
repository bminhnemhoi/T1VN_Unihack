import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "4 giờ 12 phút" / "6 ngày 3 giờ" / "12 phút 09 giây" for countdown text. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút ${String(sec).padStart(2, '0')} giây`;
}

/** Selected state for outline toggle items: filled ink, so "on" reads without colour hue. */
export const TOGGLE_ON = "data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:border-foreground";
