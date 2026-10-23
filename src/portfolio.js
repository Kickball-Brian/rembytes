import {
  gsap, ScrollTrigger, $, $$, lenis, scene, reduced, ease,
  initCursor, initMagnetic, initShared,
  arrivedViaTransition, curtainReveal, fontsReady, splitWords,
} from './core.js';

window.history.scrollRestoration = 'manual';

const projs = $$('.proj');
const countEl = $('#projCount');
let current = 'all';

/* ───────────── screenshots: graceful fallback ───────────── */
function initShots() {
  $$('.browser__view img').forEach((img) => {
    const view = img.closest('.browser__view');
    const fail = () => { img.remove(); view.classList.add('no-img'); };
    const ok = () => {
      view.classList.add('has-img');
      if (reduced) return;
      // slow parallax drift of the screenshot inside its frame while scrolling past
      gsap.fromTo(img, { yPercent: -4, scale: 1.08 }, {
        yPercent: 4, scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: view, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    };
    if (img.complete) (img.naturalWidth ? ok() : fail());
    else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', fail, { once: true }); }
  });
}

/* ───────────── filters ───────────── */
function renumber() {
  const visible = projs.filter((p) => !p.hidden);
  visible.forEach((p, i) => { $('.proj__n span', p).textContent = String(i + 1).padStart(2, '0'); });
  countEl.textContent = `${String(visible.length).padStart(2, '0')} project${visible.length === 1 ? '' : 's'}`;
}

function applyFilter(next) {
  if (next === current) return;
  current = next;
  $$('.filter').forEach((b) => {
    const on = b.dataset.filter === next;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on);
  });

  const show = projs.filter((p) => next === 'all' || p.dataset.stack === next);
  const hide = projs.filter((p) => !show.includes(p));

  gsap.to(hide.filter((p) => !p.hidden), {
    opacity: 0, y: 24, duration: reduced ? 0.01 : 0.35, ease: 'power2.in',
    onComplete() {
      hide.forEach((p) => { p.hidden = true; });
      show.forEach((p) => { p.hidden = false; });
      renumber();
      gsap.fromTo(show, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: reduced ? 0.01 : 0.7, stagger: 0.09, ease: 'power3.out', clearProps: 'opacity,transform' });
      ScrollTrigger.refresh();
    },
  });
}

function initFilters() {
  $$('.filter').forEach((b) => b.addEventListener('click', () => applyFilter(b.dataset.filter)));
}

/* ───────────── scroll choreography ───────────── */
function initScroll() {
  $$('.proj').forEach((p) => {
    const shot = $('.proj__shot', p);
    const bits = $$('.proj__info > *', p);
    const tl = gsap.timeline({ scrollTrigger: { trigger: p, start: 'top 82%', once: true }, defaults: { ease: 'power4.out' } });
    tl.from(shot, { clipPath: 'inset(0 0 100% 0 round 12px)', y: 60, duration: 1.3 })
      .from(bits, { y: 36, opacity: 0, duration: 0.9, stagger: 0.07, clearProps: 'opacity,transform' }, 0.2);
  });

  const cta = $('.pcta__title');
  const words = splitWords(cta, { mask: true });
  gsap.from(words, { yPercent: 110, rotate: 4, duration: 1.1, stagger: 0.06, ease: 'power4.out', scrollTrigger: { trigger: cta, start: 'top 88%', once: true } });
  gsap.from('.pcta__row > *', { y: 30, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.pcta__row', start: 'top 92%', once: true } });

  const prog = $('#progressBar');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { prog.style.transform = `scaleX(${self.progress})`; } });
}

/* ───────────── intro ───────────── */
function playIntro() {
  const words = splitWords($('#pTitle .line'), { mask: true });
  scene?.setAlphaScale(window.innerWidth < 1000 ? 0.4 : 0.55);
  scene?.intro('field');

  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.from('.nav', { yPercent: -120, duration: 1, ease: 'power3.out' })
    .from(words, { yPercent: 115, rotate: 4, duration: 1.3, stagger: 0.1 }, 0.1)
    .from('[data-in]', { y: 36, opacity: 0, duration: 1, stagger: 0.09 }, 0.25);
}

async function boot() {
  const viaTransition = arrivedViaTransition();
  initShared();
  await fontsReady();
  initShots();
  initFilters();
  initScroll();
  initCursor();
  initMagnetic();
  ScrollTrigger.refresh();

  if (viaTransition) curtainReveal();
  playIntro();
  lenis.start();

  // arrived via /portfolio/#project → glide to it
  if (window.location.hash) {
    const t = $(window.location.hash);
    if (t) setTimeout(() => lenis.scrollTo(t, { offset: -90, duration: reduced ? 0 : 1.8, easing: ease }), 900);
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

boot();
