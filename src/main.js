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
  'let\'s go!',
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
    .from('.nav > *', { y: -36, opacity: 0, duration: 1, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity' }, '-=0.6')
    .from('[data-hero-in]', { y: 28, opacity: 0, duration: 1.1, stagger: 0.1, ease: 'power3.out' }, '-=0.4');
}

/** Returning from another page: skip the boot sequence, just wipe in. */
function playQuickIntro() {
  $('#loader').remove();
  curtainReveal();
  finishIntro();
  gsap.from('.nav > *', { y: -36, opacity: 0, duration: 1, stagger: 0.08, ease: 'power3.out', delay: 0.3, clearProps: 'transform,opacity' });
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

  /* touch / small screens have no hover: light a row up in orange while it crosses the middle of the screen */
  gsap.matchMedia().add('(hover: none), (max-width: 1000px)', () => {
    $$('.row').forEach((row) => {
      ScrollTrigger.create({ trigger: row, start: 'top 50%', end: 'bottom 50%', toggleClass: { targets: row, className: 'is-active' } });
    });
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


function initCardShots() {
  $$('.card__viz img').forEach((img) => {
    const box = img.parentElement;
    const fail = () => img.remove();
    const ok = () => box.classList.add('has-img');
    if (img.complete) (img.naturalWidth ? ok() : fail());
    else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', fail, { once: true }); }
  });
}

/* ───────────── headshot: particles gather into the photo as you scroll ───────────── */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - (1 - t) ** 3;

function initPortrait() {
  const box = $('#portrait');
  const photo = $('#portraitPhoto');
  const cv = $('#portraitCanvas');
  if (!box || !photo || !cv) return;
  if (reduced) return; // reduced motion: the finished photo is simply there

  const ctx = cv.getContext('2d');
  const ACCENT = [255, 77, 28];
  const DUR = 0.36;        // each particle's flight time, as a share of the scroll range
  const FADE_FROM = 0.8;   // the sharp photo crossfades in over the last 20%
  let W = 0, H = 0, dpr = 1, N = 0;
  let tx, ty, sx, sy, cr, cg, cb, delay, seed;
  let img, buf32;
  let target = 0, current = 0, lastDrawn = -1, inView = false;

  function build() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(2, Math.round(box.clientWidth * dpr));
    H = Math.max(2, Math.round(box.clientHeight * dpr));
    cv.width = W; cv.height = H;
    img = ctx.createImageData(W, H);
    buf32 = new Uint32Array(img.data.buffer);

    // read the photo's pixels at canvas resolution (the photo is 4:5, same as the frame)
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.drawImage(photo, 0, 0, W, H);
    const px = o.getImageData(0, 0, W, H).data;

    N = window.innerWidth < 700 ? 7000 : 14000;
    tx = new Float32Array(N); ty = new Float32Array(N);
    sx = new Float32Array(N); sy = new Float32Array(N);
    cr = new Uint8Array(N); cg = new Uint8Array(N); cb = new Uint8Array(N);
    delay = new Float32Array(N); seed = new Float32Array(N);

    let n = 0, guard = 0;
    while (n < N && guard++ < N * 60) {
      const x = Math.floor(Math.random() * W);
      const y = Math.floor(Math.random() * H);
      const k = (y * W + x) * 4;
      if (px[k + 3] < 200) continue;           // skip the removed background
      tx[n] = x; ty[n] = y;
      cr[n] = px[k]; cg[n] = px[k + 1]; cb[n] = px[k + 2];
      const ang = Math.random() * Math.PI * 2;
      const dist = (60 + Math.random() * 240) * dpr;
      sx[n] = Math.cos(ang) * dist;
      sy[n] = Math.sin(ang) * dist * 0.8 - 40 * dpr;   // drift in from slightly above
      delay[n] = (y / H) * 0.28 + Math.random() * 0.3;  // top of the head lands first
      seed[n] = Math.random() * 6.283;
      n++;
    }
    N = n;
    lastDrawn = -1;
  }

  function draw(p) {
    buf32.fill(0);
    const fade = 1 - smooth(FADE_FROM, 1, p);
    if (fade > 0) {
      for (let i = 0; i < N; i++) {
        const t = clamp01((p - delay[i]) / DUR);
        const k = easeOut(t);
        const turb = (1 - k) * 14 * dpr;
        const x = Math.round(tx[i] + sx[i] * (1 - k) + Math.sin(seed[i] + k * 9) * turb);
        const y = Math.round(ty[i] + sy[i] * (1 - k) + Math.cos(seed[i] + k * 7) * turb);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const m = k * k;                                   // orange dust turns to photo colour on arrival
        const r = ACCENT[0] + (cr[i] - ACCENT[0]) * m;
        const g = ACCENT[1] + (cg[i] - ACCENT[1]) * m;
        const b = ACCENT[2] + (cb[i] - ACCENT[2]) * m;
        const a = Math.round(255 * fade * (0.18 + 0.82 * k));
        const px = (a << 24) | (b << 16) | (g << 8) | r;   // little-endian RGBA
        const s = Math.max(1, Math.round((1.3 + (1 - k) * 1.5) * dpr));
        for (let yy = 0; yy < s; yy++) {
          const row = (y + yy) * W;
          if (y + yy >= H) break;
          for (let xx = 0; xx < s && x + xx < W; xx++) buf32[row + x + xx] = px;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    photo.style.opacity = smooth(FADE_FROM, 1, p);
  }

  const start = () => {
    box.classList.add('has-cutout');
    photo.style.opacity = 0;
    build();

    ScrollTrigger.create({
      trigger: '.portrait',
      start: 'top 90%',
      end: 'top 22%',   // finished while the whole portrait is still in view
      onUpdate: (self) => { target = self.progress; },
      onRefresh: (self) => { target = self.progress; current = self.progress; },
      onToggle: (self) => { inView = self.isActive; if (!inView) { current = target; draw(target); } },
    });

    // glide toward the scroll position so the formation flows instead of stepping
    gsap.ticker.add(() => {
      if (!inView || document.hidden) return;
      current += (target - current) * 0.14;
      if (Math.abs(target - current) < 0.0005) current = target;
      if (Math.abs(current - lastDrawn) > 0.0004) { draw(current); lastDrawn = current; }
    });

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { build(); draw(current); }, 250);
    });
  };

  if (photo.complete && photo.naturalWidth) start();
  else photo.addEventListener('load', start, { once: true });
}

/* ───────────── boot ───────────── */
async function boot() {
  const quick = arrivedViaTransition();
  initShared();
  initPortrait();
  initCardShots();

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
