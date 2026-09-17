'use client';

import { useLayoutEffect } from 'react';

export function Motion() {
  useLayoutEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const context = gsap.context(() => {
        gsap.from('[data-hero-line]', { yPercent: 110, duration: 1.25, stagger: 0.08, ease: 'expo.out', delay: 0.12 });
        gsap.from('[data-hero-meta]', { y: 18, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', delay: 0.65 });

        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.from(element, {
            y: 36,
            opacity: 0,
            duration: 0.9,
            ease: 'expo.out',
            scrollTrigger: { trigger: element, start: 'top 88%', once: true },
          });
        });

        gsap.utils.toArray<HTMLElement>('[data-job-row]').forEach((row) => {
          const title = row.querySelector('[data-job-title]');
          const arrow = row.querySelector('[data-job-arrow]');
          row.addEventListener('mouseenter', () => {
            gsap.to(title, { x: 10, duration: 0.55, ease: 'expo.out', overwrite: true });
            gsap.to(arrow, { x: 0, opacity: 1, duration: 0.55, ease: 'expo.out', overwrite: true });
          });
          row.addEventListener('mouseleave', () => {
            gsap.to(title, { x: 0, duration: 0.55, ease: 'expo.out', overwrite: true });
            gsap.to(arrow, { x: -10, opacity: 0, duration: 0.55, ease: 'expo.out', overwrite: true });
          });
        });
      });

      cleanup = () => {
        context.revert();
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    })().catch(() => {});

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return null;
}
