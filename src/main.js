import {
  gsap, ScrollTrigger, $, $$, html, reduced, lenis, scene, ease,
  splitWords, splitChars, initCursor, initMagnetic, initTilt, initShared,
  arrivedViaTransition, curtainReveal, fontsReady,
} from './core.js';

html.classList.add('is-loading');
window.history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
lenis.stop();

/* ───────────── loader ───────────── */
const logLines = [
  'booting rembytes<b>_</b>',
  'loading fonts ............ <b>ok</b>',
  'allocating particles ..... <b>ok</b>',
  'compiling shaders ........ <b>ok</b>',
  'hello, world.',
];

async function runLoader() {
  const num = $('#loaderNum');
  const bar = $('#loaderBar');
  const log = $('#loaderLog');
  const counter = { v: 0 };

  const logTl = gsap.timeline();
  logLines.forEach((line, i) => {
    logTl.call(() => { log.insertAdjacentHTML('beforeend', `<div>${line}</div>`); }, null, i * 0.28);
  });

  const tween = gsap.to(counter, {
    v: 100,
    duration: reduced ? 0.3 : 1.9,
    ease: 'power2.inOut',
    onUpdate() {
      num.textContent = String(Math.round(counter.v)).padStart(3, '0');
      bar.style.transform = `scaleX(${counter.v / 100})`;
    },
  });

  await Promise.all([fontsReady(), tween.then()]);
}

/* ───────────── intro reveal ───────────── */
function finishIntro() {
  html.classList.remove('is-loading');
  lenis.start();
  scene?.intro();
  // landed here via /#section from another page
  if (window.location.hash) {
    const t = $(window.location.hash);
    if (t) setTimeout(() => lenis.scrollTo(t, { duration: reduced ? 0 : 1.8, easing: ease }), 900);
  }
}

function playIntro() {
  const loader = $('#loader');
  const tl = gsap.timeline({ defaults: { ease: 'power4.inOut' } });

  tl.to('.loader__count, .loader__log, .loader__bar', { yPercent: -30, opacity: 0, duration: 0.7, ease: 'power3.in' })
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1 }, '-=0.25')
    .add(() => { loader.remove(); finishIntro(); }, '-=0.9')
    .from('.nav', { yPercent: -120, duration: 1, ease: 'power3.out' }, '-=0.6')
    .from('[data-hero-in]', { y: 28, opacity: 0, duration: 1.1, stagger: 0.1, ease: 'power3.out' }, '-=0.4');
}

/** Returning from another page: skip the boot sequence, just wipe in. */
function playQuickIntro() {
  $('#loader').remove();
  curtainReveal();
  finishIntro();
  gsap.from('.nav', { yPercent: -120, duration: 1, ease: 'power3.out', delay: 0.3 });
  gsap.from('[data-hero-in]', { y: 28, opacity: 0, duration: 1.1, stagger: 0.1, ease: 'power3.out', delay: 0.35 });
}

/* ───────────── scroll choreography ───────────── */
function initScroll() {
  /* progress bar */
  const prog = $('#progressBar');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => { prog.style.transform = `scaleX(${self.progress})`; },
  });

  /* formation switching + rail */
  const rail = $$('#rail a');
  $$('main section[id]').forEach((sec) => {
    const form = sec.dataset.formation;
    const enter = () => {
      if (form) scene?.morphTo(form);
      rail.forEach((a) => a.classList.toggle('is-active', a.dataset.s === sec.id));
    };
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: enter, onEnterBack: enter });
  });

  /* big headings: lines / words masked rise */
  $$('[data-split="words"]').forEach((el) => {
    const words = splitWords(el, { mask: true });
    gsap.from(words, { yPercent: 110, rotate: 4, duration: 1.1, stagger: 0.05, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });
  $$('[data-split="lines"]').forEach((el) => {
    const lines = $$('.line', el);
    lines.forEach((l) => { const s = document.createElement('span'); s.innerHTML = l.innerHTML; l.innerHTML = ''; l.appendChild(s); });
    gsap.from($$('.line > span', el), { yPercent: 115, rotate: 3, duration: 1.3, stagger: 0.12, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });

  /* generic reveal */
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  /* craft rows: chars stagger in */
  $$('.row').forEach((row) => {
    const chars = splitChars($('.row__t', row));
    gsap.from(chars, { yPercent: 100, opacity: 0, duration: 0.9, stagger: 0.02, ease: 'power4.out', scrollTrigger: { trigger: row, start: 'top 88%', once: true } });
    gsap.from(row, { clipPath: 'inset(0 100% 0 0)', duration: 1.1, ease: 'power4.out', scrollTrigger: { trigger: row, start: 'top 92%', once: true } });
  });

  /* counters */
  $$('[data-count]').forEach((el) => {
    const target = +el.dataset.count;
    const o = { v: 0 };
    gsap.to(o, { v: target, duration: 1.8, ease: 'power2.out', onUpdate() { el.textContent = Math.round(o.v); }, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  /* marquees: constant drift + scroll-velocity boost + direction flip */
  $$('[data-marquee]').forEach((row, idx) => {
    const clones = 3;
    for (let i = 0; i < clones; i++) {
      const c = row.cloneNode(true);
      c.removeAttribute('data-marquee');
      c.setAttribute('aria-hidden', 'true');
      row.parentElement.appendChild(c);
    }
    const kids = [...row.parentElement.children];
    const rev = idx === 1;
    const loop = gsap.fromTo(kids, { xPercent: rev ? -100 : 0 }, { xPercent: rev ? 0 : -100, repeat: -1, duration: rev ? 38 : 26, ease: 'none' });
    let dir = 1;
    lenis.on('scroll', ({ velocity }) => {
      const v = Math.abs(velocity);
      if (velocity !== 0) dir = velocity > 0 ? 1 : -1;
      gsap.to(loop, { timeScale: dir * (1 + v * 0.55), duration: 0.3, overwrite: true, onComplete() { gsap.to(loop, { timeScale: dir, duration: 1.2 }); } });
    });
  });

  /* about: scroll-scrubbed word highlight */
  const lead = $('#aboutLead');
  const leadWords = splitWords(lead);
  if (reduced) gsap.set(leadWords, { opacity: 1 });
  else gsap.to(leadWords, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: lead, start: 'top 82%', end: 'bottom 45%', scrub: 0.6 } });

  /* experience: pinned horizontal scroller (desktop) */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 801px)', () => {
    const track = $('#expTrack');
    const pin = $('#expPin');
    const jobs = $$('.job', track).filter((j) => !j.classList.contains('job--end'));
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);

    const h = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        pin: true,
        scrub: 0.8,
        start: 'top top',
        end: () => `+=${dist() * 1.05}`,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate(self) {
          $('#expBar').style.transform = `scaleX(${self.progress})`;
          const idx = Math.min(jobs.length, Math.floor(self.progress * (jobs.length + 0.35)) + 1);
          $('#expCount').textContent = String(idx).padStart(2, '0');
        },
      },
    });

    $$('.job__n', track).forEach((n) => {
      gsap.fromTo(n, { xPercent: 18 }, { xPercent: -18, ease: 'none', scrollTrigger: { trigger: n.parentElement, containerAnimation: h, start: 'left right', end: 'right left', scrub: true } });
    });
    $$('.job', track).forEach((j) => {
      gsap.fromTo(j, { opacity: 0.35, scale: 0.94 }, { opacity: 1, scale: 1, ease: 'none', scrollTrigger: { trigger: j, containerAnimation: h, start: 'left 95%', end: 'left 55%', scrub: true } });
    });
  });
  mm.add('(max-width: 800px)', () => {
    $$('.job').forEach((j) => gsap.from(j, { y: 60, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: j, start: 'top 88%', once: true } }));
  });

  /* work cards: staggered clip reveal + parallax viz */
  $$('.card').forEach((c) => {
    gsap.from(c, { y: 90, opacity: 0, clipPath: 'inset(12% 0 0 0 round 10px)', duration: 1.2, ease: 'power4.out', scrollTrigger: { trigger: c, start: 'top 90%', once: true } });
    gsap.fromTo($('.card__viz span:nth-child(1)', c), { yPercent: -20 }, { yPercent: 30, ease: 'none', scrollTrigger: { trigger: c, scrub: true } });
  });

  /* contact title slight skew from velocity */
  if (!reduced) {
    const skew = gsap.quickTo('.contact__title', 'skewY', { duration: 0.5, ease: 'power3' });
    lenis.on('scroll', ({ velocity }) => skew(Math.max(-4, Math.min(4, velocity * 0.35))));
  }
}

function initPortrait() {
  // Drop a headshot at /public/brian.jpg and it replaces the monogram.
  const img = new Image();
  img.onload = () => {
    const box = $('#portrait');
    box.style.backgroundImage = `url(${img.src})`;
    box.classList.add('has-photo');
  };
  img.src = '/brian.jpg';
}

/* ───────────── boot ───────────── */
async function boot() {
  const quick = arrivedViaTransition();
  initShared();
  initPortrait();

  if (quick) await fontsReady();
  else await runLoader();

  initScroll();
  initCursor();
  initMagnetic();
  initTilt();
  ScrollTrigger.refresh();
  quick ? playQuickIntro() : playIntro();

  window.addEventListener('load', () => ScrollTrigger.refresh());
}

boot();
