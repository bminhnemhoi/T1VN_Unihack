import { describe, expect, it } from 'vitest';
import { formatLog } from '../src/log.js';

describe('formatLog', () => {
  it('emits one JSON line', () => {
    const line = formatLog('info', 'keeper started', new Date('2026-11-07T00:00:00Z'), { round: 1 });
    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({
      time: '2026-11-07T00:00:00.000Z',
      level: 'info',
      message: 'keeper started',
      round: 1,
    });
  });
});
