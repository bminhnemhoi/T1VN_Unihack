'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * True while the element is on screen. Starts as `true` so nothing is paused before the observer reports,
 * and so server markup and first client render match. Used to pause decorative animation that is off screen.
 */
export function useInView<T extends Element>(rootMargin = '100px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e!.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, inView] as const;
}

/** Live `prefers-reduced-motion: reduce`. False on the server. */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}
