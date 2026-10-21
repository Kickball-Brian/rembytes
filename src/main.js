import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/martian-mono/400.css';
import '@fontsource/martian-mono/500.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createScene } from './scene.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

html.classList.add('is-loading');
window.history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ───────────── text splitting ───────────── */
function splitWords(el, { mask = false } = {}) {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', text);
  el.textContent = '';
  return text.split(' ').map((word, i, arr) => {
    const outer = document.createElement('span');
    outer.setAttribute('aria-hidden', 'true');
    outer.style.display = 'inline-block';
    if (mask) { outer.style.overflow = 'hidden'; outer.style.verticalAlign = 'top'; outer.style.paddingBottom = '0.1em'; }
    const inner = document.createElement('span');
    inner.className = 'w';
    inner.textContent = word;
    outer.appendChild(inner);
    el.appendChild(outer);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    return inner;
  });
}

function splitChars(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  let i = 0;
  const chars = [];
  text.split(' ').forEach((word, wi, arr) => {
    const w = document.createElement('span');
    w.style.display = 'inline-block';
    w.setAttribute('aria-hidden', 'true');
    [...word].forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i++);
      s.textContent = ch;
      w.appendChild(s);
      chars.push(s);
    });
    el.appendChild(w);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return chars;
}

/* ───────────── smooth scroll ───────────── */
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: !reduced });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* ───────────── webgl field ───────────── */
const scene = createScene($('#bg'), { reduced });
if (!scene) html.classList.add('no-webgl');

window.addEventListener('pointermove', (e) => scene?.setPointer(e.clientX, e.clientY), { passive: true });
document.addEventListener('pointerleave', () => scene?.pointerLeave());
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, input, .palette')) return;
  scene?.pulse(e.clientX, e.clientY);
});
lenis.on('scroll', ({ velocity }) => scene?.setVelocity(velocity));

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

  const fontsReady = Promise.all([
    document.fonts.load('800 100px "Bricolage Grotesque Variable"'),
    document.fonts.load('italic 400 40px "Instrument Serif"'),
    document.fonts.load('400 12px "Martian Mono"'),
  ]).catch(() => {});

  let li = 0;
  const logTl = gsap.timeline();
  logLines.forEach((line, i) => {
    logTl.call(() => { log.insertAdjacentHTML('beforeend', `<div>${line}</div>`); li++; }, null, i * 0.28);
  });

  const tween = gsap.to(counter, {
    v: 100,
    duration: reduced ? 0.3 : 1.9,
    ease: 'power2.inOut',
    onUpdate() {
      const v = Math.round(counter.v);
      num.textContent = String(v).padStart(3, '0');
      bar.style.transform = `scaleX(${counter.v / 100})`;
    },
  });

  await Promise.all([fontsReady, tween.then ? tween.then() : Promise.resolve()]);
}

/* ───────────── intro reveal ───────────── */
function playIntro() {
  const loader = $('#loader');
  const tl = gsap.timeline({ defaults: { ease: 'power4.inOut' } });

  tl.to('.loader__count, .loader__log, .loader__bar', { yPercent: -30, opacity: 0, duration: 0.7, ease: 'power3.in' })
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1 }, '-=0.25')
    .add(() => {
      loader.remove();
      html.classList.remove('is-loading');
      lenis.start();
      scene?.intro();
    }, '-=0.9')
    .from('.nav', { yPercent: -120, duration: 1, ease: 'power3.out' }, '-=0.6')
    .from('[data-hero-in]', { y: 28, opacity: 0, duration: 1.1, stagger: 0.1, ease: 'power3.out' }, '-=0.4');

  return tl;
}

/* ───────────── cursor ───────────── */
function initCursor() {
  if (!finePointer) return;
  html.classList.add('has-cursor');
  const cur = $('#cursor');
  const dot = $('.cursor__dot');
  const ring = $('.cursor__ring');
  const label = $('#cursorLabel');

  const dx = gsap.quickTo(dot, 'x', { duration: 0.05, ease: 'none' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.05, ease: 'none' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  gsap.set([dot, ring], { x: -100, y: -100 });

  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
  window.addEventListener('pointerdown', () => cur.classList.add('is-down'));
  window.addEventListener('pointerup', () => cur.classList.remove('is-down'));

  const states = ['is-link', 'is-label', 'is-hover'];
  const set = (state, size, text = '') => {
    states.forEach((s) => cur.classList.remove(s));
    if (state) cur.classList.add(state);
    label.textContent = text;
    gsap.to(ring, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, duration: 0.5, ease: 'power3' });
  };

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor]');
    if (!t) return;
    const kind = t.dataset.cursor;
    if (kind === 'link') set('is-link', 64);
    else if (kind === 'label') set('is-label', 92, t.dataset.label || 'View');
    else if (kind === 'drag') set('is-label', 76, 'Hi 👋');
    else set('is-hover', 56);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest('[data-cursor]') && !e.relatedTarget?.closest?.('[data-cursor]')) set(null, 40);
  });
}

/* ───────────── magnetic + tilt ───────────── */
function initMagnetic() {
  if (!finePointer || reduced) return;
  $$('[data-magnetic]').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - (r.left + r.width / 2)) * 0.32);
      my((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); });
  });
}

function initTilt() {
  if (!finePointer || reduced) return;
  $$('[data-tilt]').forEach((el) => {
    const target = el.classList.contains('portrait') ? $('.portrait__frame', el) : el;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      target.style.setProperty('--rx', `${(0.5 - py) * 12}deg`);
      target.style.setProperty('--ry', `${(px - 0.5) * 14}deg`);
      target.style.setProperty('--gx', `${px * 100}%`);
      target.style.setProperty('--gy', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      target.style.setProperty('--rx', '0deg');
      target.style.setProperty('--ry', '0deg');
    });
  });
  // spotlight on job cards
  $$('.job').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
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

  /* nav hide on scroll-down, show on up */
  const nav = $('#nav');
  let lastY = 0;
  lenis.on('scroll', ({ scroll, direction }) => {
    nav.classList.toggle('is-solid', scroll > 40);
    if (scroll > 200 && direction === 1 && !$('#menu').classList.contains('is-open')) nav.classList.add('is-hidden');
    else if (direction === -1) nav.classList.remove('is-hidden');
    lastY = scroll;
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

  /* craft rows: chars stagger in, then become interactive outline */
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

    // big ghost numbers drift against the scroll
    $$('.job__n', track).forEach((n) => {
      gsap.fromTo(n, { xPercent: 18 }, { xPercent: -18, ease: 'none', scrollTrigger: { trigger: n.parentElement, containerAnimation: h, start: 'left right', end: 'right left', scrub: true } });
    });
    // cards lift into focus as they cross the viewport
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

/* ───────────── hero extras ───────────── */
function initClock() {
  const el = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { el.textContent = fmt.format(new Date()) + ' ET'; };
  tick();
  setInterval(tick, 1000);
  $('#year').textContent = new Date().getFullYear();
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

/* ───────────── nav, menu, anchors ───────────── */
function initNav() {
  const burger = $('#burger');
  const menu = $('#menu');
  const toggle = (open) => {
    burger.setAttribute('aria-expanded', open);
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', !open);
    open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => toggle(burger.getAttribute('aria-expanded') !== 'true'));

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) toggle(false);
    lenis.scrollTo(target, { offset: 0, duration: reduced ? 0 : 1.8, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
  });

  $('#toTop').addEventListener('click', () => lenis.scrollTo(0, { duration: reduced ? 0 : 2.2 }));
}

/* ───────────── toast, copy, accent ───────────── */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), 2200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(`Copied ${text}`); }
  catch { toast(text); }
}

const accents = [
  { name: 'Vermilion', hex: '#ff4d1c' },
  { name: 'Acid', hex: '#c8ff2e' },
  { name: 'Cyan', hex: '#27e1ff' },
  { name: 'Ultraviolet', hex: '#9b6bff' },
  { name: 'Hot pink', hex: '#ff3d9a' },
];
let accentIdx = 0;
function cycleAccent() {
  accentIdx = (accentIdx + 1) % accents.length;
  const { hex, name } = accents[accentIdx];
  const c = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(', ');
  html.style.setProperty('--accent', hex);
  html.style.setProperty('--accent-rgb', rgb);
  scene?.setAccent(hex);
  scene?.pulse(window.innerWidth / 2, window.innerHeight / 2);
  toast(`Accent: ${name}`);
}

function initActions() {
  $('#copyMail').addEventListener('click', (e) => copyText(e.currentTarget.dataset.copy));
  $('#accentBtn').addEventListener('click', cycleAccent);
}

/* ───────────── command palette ───────────── */
function initPalette() {
  const root = $('#palette');
  const input = $('#paletteInput');
  const list = $('#paletteList');
  const go = (id) => () => lenis.scrollTo($(id), { duration: reduced ? 0 : 1.8 });

  const commands = [
    { t: 'Go to About', k: 'nav', run: go('#about') },
    { t: 'Go to Experience', k: 'nav', run: go('#experience') },
    { t: 'Go to Craft', k: 'nav', run: go('#craft') },
    { t: 'Go to Work', k: 'nav', run: go('#work') },
    { t: 'Go to Contact', k: 'nav', run: go('#contact') },
    { t: 'Copy email address', k: 'action', run: () => copyText('info@rembytes.com') },
    { t: 'Write an email', k: 'action', run: () => { window.location.href = 'mailto:brian.remavich@gmail.com'; } },
    { t: 'Cycle accent colour', k: 'theme', run: cycleAccent },
    { t: 'Freeze / resume particles', k: 'fx', run: () => { scene?.setPaused(!scene.paused); toast(scene?.paused ? 'Particles frozen' : 'Particles live'); } },
    { t: 'Burst', k: 'fx', run: () => scene?.pulse(window.innerWidth / 2, window.innerHeight / 2) },
    { t: 'Back to top', k: 'nav', run: () => lenis.scrollTo(0, { duration: reduced ? 0 : 2 }) },
  ];

  let shown = commands;
  let sel = 0;
  const render = () => {
    list.innerHTML = shown.map((c, i) => `<li role="option" data-i="${i}" class="${i === sel ? 'is-sel' : ''}"><span>${c.t}</span><small>${c.k}</small></li>`).join('') || '<li style="cursor:default">No results</li>';
  };
  const open = () => {
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    input.value = '';
    shown = commands; sel = 0; render();
    lenis.stop();
    setTimeout(() => input.focus(), 50);
  };
  const close = () => {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    lenis.start();
  };
  const run = (i) => { const c = shown[i]; if (!c) return; close(); setTimeout(c.run, 250); };

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    shown = commands.filter((c) => c.t.toLowerCase().includes(q) || c.k.includes(q));
    sel = 0; render();
  });
  list.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) run(+li.dataset.i); });
  list.addEventListener('pointermove', (e) => { const li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; render(); } });
  root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  $('#paletteBtn').addEventListener('click', open);

  window.addEventListener('keydown', (e) => {
    const isOpen = root.classList.contains('is-open');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); isOpen ? close() : open(); return; }
    if (!isOpen) {
      if (e.key === '/' && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(shown.length, 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(shown.length, 1); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
  });

  // platform-aware key hint
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) $('#paletteBtn kbd').textContent = 'Ctrl';
}

/* ───────────── boot ───────────── */
async function boot() {
  initClock();
  initPortrait();
  initNav();
  initActions();
  initPalette();

  await runLoader();
  initScroll();
  initCursor();
  initMagnetic();
  initTilt();
  ScrollTrigger.refresh();
  playIntro();

  // late layout shifts (fonts/images) → recalc pinned positions
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

boot();
