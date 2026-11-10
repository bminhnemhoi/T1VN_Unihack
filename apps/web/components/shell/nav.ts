import { BookOpen, Gavel, House, PlusCircle, type LucideIcon } from 'lucide-react';
import { vi } from '@/lib/vi';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** The sample bidding room. It exists only when the site shows sample data: with a real deployment `/circles/demo` is a 404. */
export const SAMPLE_ROOM_HREF = '/circles/demo';

export const NAV: NavItem[] = [
  { href: '/', label: vi.nav.home, icon: House },
  { href: '/circles', label: vi.nav.myCircles, icon: BookOpen },
  { href: '/circles/new', label: vi.nav.create, icon: PlusCircle },
  { href: SAMPLE_ROOM_HREF, label: vi.nav.room, icon: Gavel },
];

/** The main menu: with a real deployment (`inChain`) the sample room is left out, so no link and no prefetch points at a 404. */
export function navFor(inChain: boolean): NavItem[] {
  return inChain ? NAV.filter((l) => l.href !== SAMPLE_ROOM_HREF) : NAV;
}

/** Exact match for "/" and "/circles"; prefix match would light up "Dây của tôi" on /circles/new. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href;
}
