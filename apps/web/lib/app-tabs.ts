/** The four tabs of the web app and which one a path belongs to (pure, unit-tested). */
export type AppTab = 'tong-quan' | 'day' | 'so-hui' | 'tao';

/** The tab a path belongs to; secondary pages (lab, cài đặt, …) belong to none. */
export function tabOf(pathname: string): AppTab | null {
  if (pathname === '/circles') return 'tong-quan';
  if (pathname === '/circles/new') return 'tao';
  if (/^\/circles\/[^/]+\/so-ho$/.test(pathname)) return 'so-hui';
  if (/^\/circles\/[^/]+/.test(pathname)) return 'day';
  return null;
}
