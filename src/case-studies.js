import {
  gsap, ScrollTrigger, $, $$, lenis, scene, reduced, ease,
  initCursor, initMagnetic, initShared,
  arrivedViaTransition, curtainReveal, fontsReady, splitWords,
} from './core.js';

window.history.scrollRestoration = 'manual';

function initScroll() {
  $$('.cs').forEach((cs) => {
    const meta = $('.cs__meta', cs);
    const body = $$('.cs__body > *', cs);
    const tl = gsap.timeline({ scrollTrigger: { trigger: cs, start: 'top 80%', once: true }, defaults: { ease: 'power4.out' } });
    tl.from(meta, { y: 40, opacity: 0, duration: 1, clearProps: 'opacity,transform' })
      .from(body, { y: 44, opacity: 0, duration: 1, stagger: 0.09, clearProps: 'opacity,transform' }, 0.1);
    gsap.fromTo($('.cs__n', cs), { yPercent: 14 }, { yPercent: -14, ease: 'none', scrollTrigger: { trigger: cs, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  const cta = $('.pcta__title');
  const words = splitWords(cta, { mask: true });
  gsap.from(words, { yPercent: 110, rotate: 4, duration: 1.1, stagger: 0.06, ease: 'power4.out', scrollTrigger: { trigger: cta, start: 'top 88%', once: true } });
  gsap.from('.pcta__row > *', { y: 30, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.pcta__row', start: 'top 92%', once: true } });

  const prog = $('#progressBar');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { prog.style.transform = `scaleX(${self.progress})`; } });
}

function playIntro() {
  const words = splitWords($('#pTitle .line'), { mask: true });
  scene?.setAlphaScale(window.innerWidth < 1000 ? 0.4 : 0.5);
  scene?.intro('sphere');

  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.from('.nav', { yPercent: -120, duration: 1, ease: 'power3.out' })
    .from(words, { yPercent: 115, rotate: 4, duration: 1.3, stagger: 0.1 }, 0.1)
    .from('[data-in]', { y: 36, opacity: 0, duration: 1, stagger: 0.09 }, 0.25);
}

async function boot() {
  const viaTransition = arrivedViaTransition();
  initShared();
  await fontsReady();
  initScroll();
  initCursor();
  initMagnetic();
  ScrollTrigger.refresh();

  if (viaTransition) curtainReveal();
  playIntro();
  lenis.start();

  if (window.location.hash) {
    const t = $(window.location.hash);
    if (t) setTimeout(() => lenis.scrollTo(t, { offset: -90, duration: reduced ? 0 : 1.8, easing: ease }), 900);
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

boot();
