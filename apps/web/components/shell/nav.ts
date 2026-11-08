import { BookOpen, Gavel, House, PlusCircle, type LucideIcon } from 'lucide-react';
import { vi } from '@/lib/vi';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: '/', label: vi.nav.home, icon: House },
  { href: '/circles', label: vi.nav.myCircles, icon: BookOpen },
  { href: '/circles/new', label: vi.nav.create, icon: PlusCircle },
  { href: '/circles/demo', label: vi.nav.room, icon: Gavel },
];

/** Exact match for "/" and "/circles"; prefix match would light up "Dây của tôi" on /circles/new. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href;
}
