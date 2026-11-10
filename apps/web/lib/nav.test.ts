import { describe, expect, it } from 'vitest';
import { NAV, SAMPLE_ROOM_HREF, navFor } from '@/components/shell/nav';

describe('main menu in both modes', () => {
  it('sample mode keeps the four items, including the sample room', () => {
    const items = navFor(false);
    expect(items).toEqual(NAV);
    expect(items.map((i) => i.href)).toEqual(['/', '/circles', '/circles/new', SAMPLE_ROOM_HREF]);
  });

  it('chain mode leaves the sample room out and keeps the other three in order', () => {
    const items = navFor(true);
    expect(items.map((i) => i.href)).toEqual(['/', '/circles', '/circles/new']);
    expect(items.some((i) => i.href.startsWith('/circles/demo'))).toBe(false);
  });
});
