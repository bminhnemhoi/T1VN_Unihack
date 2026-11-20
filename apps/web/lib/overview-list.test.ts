import { describe, expect, it } from 'vitest';
import type { SampleCircle } from './sample';
import { splitEnded } from './overview-list';

type Row = Pick<SampleCircle, 'state' | 'role' | 'bondLeft'> & { id: string };
const row = (id: string, state: Row['state'], extra: Partial<Row> = {}): Row => ({ id, state, role: 'member', ...extra });

describe('splitEnded: the Overview keeps what still needs you on top', () => {
  it('running and gathering circles stay on top; finished ones go to "Đã kết thúc"', () => {
    const { top, ended } = splitEnded([row('a', 'active'), row('b', 'completed'), row('c', 'forming'), row('d', 'cancelled'), row('e', 'unwound')]);
    expect(top.map((r) => r.id)).toEqual(['a', 'c']);
    expect(ended.map((r) => r.id)).toEqual(['b', 'd', 'e']);
  });

  it('a closed circle where the organizer still has a bond to withdraw stays on top (there is something to do)', () => {
    const { top, ended } = splitEnded([row('x', 'cancelled', { role: 'organizer', bondLeft: true }), row('y', 'cancelled', { role: 'member', bondLeft: true })]);
    expect(top.map((r) => r.id)).toEqual(['x']);
    expect(ended.map((r) => r.id)).toEqual(['y']);
  });

  it('keeps the incoming order inside each group', () => {
    const { ended } = splitEnded([row('1', 'completed'), row('2', 'cancelled'), row('3', 'completed')]);
    expect(ended.map((r) => r.id)).toEqual(['1', '2', '3']);
  });
});
