'use client';

import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/utils';

/** Ticking countdown from a fixed number of seconds. Not a live region (it would chatter); the text is plain. */
export function Countdown({ seconds, className }: { seconds: number; className?: string }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  return (
    <time dateTime={`PT${left}S`} className={`so-ke ${className ?? ''}`}>
      {formatDuration(left)}
    </time>
  );
}
