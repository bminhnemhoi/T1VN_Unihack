'use client';

import { useEffect } from 'react';
import s from './landing.module.css';

/** Fixed chip tilts: the product has no randomness, not even in decoration. */
const TILT = [-9, 7, -4, 11, -11, 5, -7, 9];

/** Ballot story state: 1 sealed, 2 opened, 3 stamped. Pure CSS reads `data-state` on the story section. */
function setStep(story: HTMLElement | null, i: number) {
  if (story) story.dataset.state = String(i);
}

/**
 * All landing motion (Neutomni-style intro, hero entrance, scroll reveals, ballot story, word scrub) plus Lenis smooth
 * scrolling. GSAP and Lenis load after hydration, so the page is complete and readable without them; every tween only
 * moves or recolours, never hides content at rest. Everything is reverted on unmount so the web app is untouched.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-lp-root]');
    const story = document.querySelector<HTMLElement>('[data-lp-story]');
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Without motion every state is still readable: show the finished ballot.
    if (reduce) {
      setStep(story, 3);
      return;
    }

    let disposed = false;
    let cleanup = () => {};

    // Intro hand-off. Phase 1 (letters, coin) is CSS. At ~1.6 s of intro time, or on "Bỏ qua", the exit runs as ONE
    // movement: the word flies and shrinks into the nav logo, the dark layer fades, and the hero starts rising under it.
    // It uses the Web Animations API on transform/opacity only, so it stays smooth while GSAP and the page still load.
    const introEl = document.querySelector<HTMLElement>('[data-lp-intro]');
    const mark = root.querySelector<HTMLElement>('[data-lp-mark]');
    let introDone = !introEl || getComputedStyle(introEl).visibility === 'hidden';
    let exiting = false;
    let startHero: (() => void) | null = null; // set once GSAP is in
    let heroStarted = false;
    const playHero = () => {
      if (heroStarted || !startHero) return;
      heroStarted = true;
      startHero();
    };
    const showMark = () => {
      if (!mark) return;
      mark.style.animation = 'none';
      mark.style.opacity = '';
    };
    const finishIntro = () => {
      introDone = true;
      introEl?.setAttribute('data-done', '');
      showMark();
      onIntroDone?.();
    };
    let onIntroDone: (() => void) | null = null;
    if (introDone) {
      introEl?.setAttribute('data-done', '');
      showMark();
    }

    const exitIntro = (fast: boolean) => {
      if (!introEl || introDone || exiting) return;
      exiting = true;
      window.clearTimeout(introTimer);
      const word = introEl.querySelector<HTMLElement>('[data-lp-intro-word]');
      const bg = introEl.querySelector<HTMLElement>('[data-lp-intro-bg]');
      const sub = introEl.querySelector<HTMLElement>('[data-lp-intro-sub]');
      introEl.setAttribute('data-exit', '');
      const d = fast ? 650 : 1100;
      const ease = 'cubic-bezier(0.65, 0, 0.35, 1)';
      const runs: Animation[] = [];
      if (sub) runs.push(sub.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }));
      if (bg) runs.push(bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.7, delay: d * 0.18, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }));
      if (word && mark) {
        // FLIP: measure both boxes once, then only transform. Centre the word on the logo, sized by width.
        const w = word.getBoundingClientRect();
        const m = mark.getBoundingClientRect();
        const k = m.width / w.width;
        const tx = m.left - w.left;
        const ty = m.top + m.height / 2 - (w.top + (w.height * k) / 2);
        runs.push(
          word.animate([{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${tx}px, ${ty}px) scale(${k})` }], {
            duration: d,
            easing: ease,
            fill: 'forwards',
          }),
        );
        const ink = word.querySelector<HTMLElement>('[data-lp-intro-ink]');
        if (ink) runs.push(ink.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d * 0.55, delay: d * 0.2, easing: 'ease-in-out', fill: 'forwards' }));
      } else if (word) {
        runs.push(word.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.6, fill: 'forwards' }));
      }
      // The hero begins while the dark layer is still lifting, so the two read as one motion.
      window.setTimeout(playHero, d * 0.3);
      void Promise.all(runs.map((r) => r.finished))
        .then(() => {
          if (word && mark) {
            // Land: the real logo fades in under the word as the word fades out.
            showMark();
            mark.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
            return word.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' }).finished;
          }
          return undefined;
        })
        .catch(() => undefined)
        .finally(finishIntro);
    };

    // Schedule the exit on the intro's own clock (it started at first paint, maybe before hydration).
    let introTimer = 0;
    if (introEl && !introDone) {
      const phase1 = introEl.getAnimations({ subtree: true })[0];
      const now = Number(document.timeline.currentTime ?? 0);
      const elapsed = phase1?.startTime != null ? now - Number(phase1.startTime) : 0;
      if (elapsed > 2900) finishIntro(); // very late hydration: the CSS fallback is already fading it out
      else introTimer = window.setTimeout(() => exitIntro(false), Math.max(0, 1650 - elapsed));
      introEl.querySelector('[data-lp-skip]')?.addEventListener('click', () => exitIntro(true));
    }
    // Steps work even if the libraries never arrive.
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStep(story, Number((e.target as HTMLElement).dataset.step))),
      { rootMargin: '-45% 0px -45% 0px' },
    );
    root.querySelectorAll('[data-step]').forEach((el) => io.observe(el));

    // Endless loops (badge ring, bubbles, floating chips, ballot playhead, marquee) pause while off screen (B22g):
    // nothing to see, so no compositor work and no battery spent on them. Their look is unchanged on screen.
    const loopSel = [s.badge && `.${s.badge} svg`, s.bubble && `.${s.bubble}`, s.chip && `.${s.chip}`, s.playhead && `.${s.playhead}`, s.marqueeTrack && `.${s.marqueeTrack}`]
      .filter(Boolean)
      .join(', ');
    const loops = new IntersectionObserver((entries) =>
      entries.forEach((e) => ((e.target as HTMLElement).style.animationPlayState = e.isIntersecting ? '' : 'paused')),
    );
    if (loopSel) root.querySelectorAll(loopSel).forEach((el) => loops.observe(el));

    // GSAP + Lenis load when the browser is idle (B22g): their parse used to land as one long frame during the intro.
    // The 600 ms cap keeps them in well before the intro hands over (~1.65 s), so the hero entrance still plays.
    const idle = (cb: () => void): void => {
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: 600 });
      else setTimeout(cb, 200); // Safari has no requestIdleCallback
    };
    const load = () => Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('lenis')]);
    void new Promise<Awaited<ReturnType<typeof load>>>((res) => idle(() => void load().then(res))).then(([{ gsap }, { ScrollTrigger }, { default: Lenis }]) => {
      if (disposed) return;
      io.disconnect();
      gsap.registerPlugin(ScrollTrigger);
      // No automatic re-measure on window load: it would land in the middle of the hero entrance and stutter it.
      // We refresh once the intro is done (see onIntroDone) and on resize as usual.
      ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,resize' });

      const lenis = new Lenis({ lerp: 0.1 });
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const onAnchor = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
        if (!a || !root.contains(a)) return;
        const target = document.querySelector(a.getAttribute('href') ?? '');
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target as HTMLElement, { offset: -64, duration: 1.4 });
        }
      };
      root.addEventListener('click', onAnchor);

      const ctx = gsap.context(() => {
        const q = gsap.utils.selector(root);

        // Built paused right away, so its start states apply under the intro curtain and nothing flashes.
        // After the entrance the chips float on CSS (compositor), so no GSAP tween runs forever on the main thread.
        const floatChips = () => {
          const chips = q('[data-lp-chip]');
          gsap.set(chips, { clearProps: 'transform' });
          chips[0]?.parentElement?.classList.add(s.floating ?? '');
        };
        const hero = (() => {
          const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' }, onComplete: floatChips });
          tl.from(q('[data-lp-line]'), { yPercent: 110, duration: 1, stagger: 0.09 })
            .fromTo(q('[data-lp-strike]'), { '--s': 0 }, { '--s': 1, duration: 0.7, ease: 'power2.inOut' }, '-=0.2')
            .from(q('[data-lp-badge]'), { scale: 0, duration: 1, ease: 'back.out(1.6)' }, '-=0.9')
            .from(q('[data-lp-badge-ring]'), { rotation: -120, duration: 1.4, ease: 'power3.out' }, '<')
            .fromTo(q('[data-lp-navitem]'), { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, clearProps: 'transform' }, 0)
            .from(q('[data-lp-bubble]'), { x: -40, scale: 0.7, transformOrigin: '0% 50%', duration: 0.7, stagger: 0.14, ease: 'back.out(1.8)' }, '-=0.8')
            .from(q('[data-lp-side]'), { y: 24, duration: 0.8, stagger: 0.08 }, '-=0.9')
            .from(q('[data-lp-chip]'), { y: 30, scale: 0.6, rotation: (i: number) => TILT[i % TILT.length] ?? 0, duration: 0.7, stagger: 0.05, ease: 'back.out(1.8)' }, '-=0.6')
            .from(q('[data-lp-stage]'), { y: 80, rotationX: 12, transformPerspective: 1200, duration: 1.1 }, '-=0.6')
            .from(q('[data-lp-tile]'), { y: 22, scale: 0.85, duration: 0.6, stagger: 0.08, ease: 'back.out(1.6)' }, '-=0.6');
          return tl;
        })();

        gsap.to(q('[data-lp-badge-ring]'), { rotation: 160, ease: 'none', scrollTrigger: { trigger: q('[data-lp-hero]')[0], start: 'top top', end: 'bottom top', scrub: true } });

        startHero = () => {
          lenis.start();
          hero.play();
        };
        if (introDone && !exiting) {
          // Libraries arrived after the intro: never hide what the reader already sees, just settle the hero.
          heroStarted = true;
          hero.progress(1);
          floatChips();
        } else if (exiting) {
          playHero(); // the exit is already under way: join it now
        } else {
          lenis.stop();
        }
        onIntroDone = () => {
          lenis.start();
          // Measure scroll triggers once the page is at rest, not in the middle of the entrance.
          void document.fonts.ready.then(() => ScrollTrigger.refresh());
        };

        q('[data-step]').forEach((step) => {
          ScrollTrigger.create({
            trigger: step,
            start: 'top 55%',
            end: 'bottom 55%',
            onToggle: (self) => self.isActive && setStep(story, Number((step as HTMLElement).dataset.step)),
          });
        });
        gsap.from(q('[data-lp-slip]'), { scrollTrigger: { trigger: story, start: 'top 70%' }, y: 80, rotation: -6, duration: 1.1, ease: 'power3.out' });

        q('[data-lp-head]').forEach((h) => {
          gsap.from(h.children, { scrollTrigger: { trigger: h, start: 'top 85%' }, y: 40, duration: 0.76, stagger: 0.08, ease: 'power1.out' });
        });
        gsap.from(q('[data-lp-card]'), {
          scrollTrigger: { trigger: q('[data-lp-cards]')[0], start: 'top 85%' },
          y: 90,
          rotation: (i: number) => (i % 2 ? 3 : -3),
          duration: 0.9,
          stagger: 0.1,
          ease: 'power3.out',
        });
        q('[data-lp-sheet]').forEach((sh) => {
          gsap.from(sh.querySelectorAll('[data-lp-entry]'), { scrollTrigger: { trigger: sh, start: 'top 80%' }, x: -30, duration: 0.6, stagger: 0.1, ease: 'power2.out' });
        });
        // Words ink in as you scroll; the start colour still passes 3:1 for large text, so nothing is unreadable at rest.
        // Kept on `color` (B22g): an ink copy with a scrubbed opacity was measured slower here (67-83 ms frames at 6x CPU
        // against 50 ms), since a dozen 140 px text layers cost more than repainting the words.
        gsap.fromTo(q('[data-lp-word]'), { color: '#858079' }, { color: '#201d1d', stagger: 0.12, ease: 'none', scrollTrigger: { trigger: q('[data-lp-close]')[0], start: 'top 85%', end: 'bottom 45%', scrub: true } });
      }, root);

      cleanup = () => {
        root.removeEventListener('click', onAnchor);
        ctx.revert();
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
      };
    });

    return () => {
      disposed = true;
      io.disconnect();
      loops.disconnect();
      window.clearTimeout(introTimer);
      cleanup();
    };
  }, []);
  return null;
}
