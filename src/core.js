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

export { gsap, ScrollTrigger };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const html = document.documentElement;
export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export const SITE_EMAIL = 'info@rembytes.com';
const NAV_FLAG = 'rb-nav';

/* ───────────── text splitting ───────────── */
export function splitWords(el, { mask = false } = {}) {
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

export function splitChars(el) {
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
export const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: !reduced });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ───────────── webgl field ───────────── */
export const scene = createScene($('#bg'), { reduced });
if (!scene) html.classList.add('no-webgl');

window.addEventListener('pointermove', (e) => scene?.setPointer(e.clientX, e.clientY), { passive: true });
document.addEventListener('pointerleave', () => scene?.pointerLeave());
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, input, textarea, select, label, .palette, form')) return;
  scene?.pulse(e.clientX, e.clientY);
});
lenis.on('scroll', ({ velocity }) => scene?.setVelocity(velocity));

/* ───────────── page transitions ───────────── */
let curtain;
function ensureCurtain() {
  if (curtain) return curtain;
  curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(curtain);
  return curtain;
}

/** True when this page was reached through an in-site transition. Consumes the flag. */
export function arrivedViaTransition() {
  try {
    const v = sessionStorage.getItem(NAV_FLAG) === '1';
    sessionStorage.removeItem(NAV_FLAG);
    return v;
  } catch { return false; }
}

/** Covers the screen instantly, then wipes it away. */
export function curtainReveal() {
  const c = ensureCurtain();
  gsap.set(c, { clipPath: 'inset(0% 0 0 0)' });
  return gsap.to(c, { clipPath: 'inset(0 0 100% 0)', duration: reduced ? 0.01 : 0.9, ease: 'power4.inOut', delay: 0.05 });
}

export function navigate(url) {
  const c = ensureCurtain();
  try { sessionStorage.setItem(NAV_FLAG, '1'); } catch { /* private mode */ }
  lenis.stop();
  gsap.fromTo(c, { clipPath: 'inset(100% 0 0 0)' }, {
    clipPath: 'inset(0% 0 0 0)',
    duration: reduced ? 0.01 : 0.7,
    ease: 'power4.inOut',
    onComplete: () => { window.location.href = url; },
  });
}

// bfcache restore: make sure a stale curtain never covers the page
window.addEventListener('pageshow', (e) => {
  if (e.persisted && curtain) gsap.set(curtain, { clipPath: 'inset(100% 0 0 0)' });
  if (e.persisted) lenis.start();
});

/* ───────────── cursor ───────────── */
export function initCursor() {
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
export function initMagnetic() {
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

export function initTilt() {
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
  // spotlight on glass panels
  $$('.job, .form-card').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ───────────── toast, copy, accent ───────────── */
let toastT;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), 2200);
}

export async function copyText(text) {
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
export function cycleAccent() {
  accentIdx = (accentIdx + 1) % accents.length;
  const { hex, name } = accents[accentIdx];
  const c = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(', ');
  html.style.setProperty('--accent', hex);
  html.style.setProperty('--accent-rgb', rgb);
  scene?.setAccent(hex);
  scene?.pulse(window.innerWidth / 2, window.innerHeight / 2);
  toast(`Accent: ${name}`);
  try { sessionStorage.setItem('rb-accent', String(accentIdx)); } catch { /* ignore */ }
}

function restoreAccent() {
  let idx = 0;
  try { idx = Number(sessionStorage.getItem('rb-accent') || 0); } catch { /* ignore */ }
  if (!idx) return;
  const { hex } = accents[idx];
  const c = hex.replace('#', '');
  html.style.setProperty('--accent', hex);
  html.style.setProperty('--accent-rgb', [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(', '));
  scene?.setAccent(hex);
  accentIdx = idx;
}

/* ───────────── nav, menu, anchors ───────────── */
export function initNav() {
  const burger = $('#burger');
  const menu = $('#menu');
  const nav = $('#nav');

  const toggle = (open) => {
    burger.setAttribute('aria-expanded', open);
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', !open);
    open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => toggle(burger.getAttribute('aria-expanded') !== 'true'));

  // hide on scroll down, show on scroll up
  lenis.on('scroll', ({ scroll, direction }) => {
    nav.classList.toggle('is-solid', scroll > 40);
    if (scroll > 200 && direction === 1 && !menu.classList.contains('is-open')) nav.classList.add('is-hidden');
    else if (direction === -1) nav.classList.remove('is-hidden');
  });

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;

    const samePage = url.pathname === window.location.pathname;
    if (samePage && url.hash.length > 1) {
      const target = $(url.hash);
      if (!target) return;
      e.preventDefault();
      if (menu.classList.contains('is-open')) toggle(false);
      lenis.scrollTo(target, { offset: 0, duration: reduced ? 0 : 1.8, easing: ease });
    } else if (!samePage) {
      e.preventDefault();
      if (menu.classList.contains('is-open')) toggle(false);
      navigate(url.pathname + url.search + url.hash);
    }
  });

  $('#toTop')?.addEventListener('click', () => lenis.scrollTo(0, { duration: reduced ? 0 : 2.2 }));
}

export function initActions() {
  $('#copyMail')?.addEventListener('click', (e) => copyText(e.currentTarget.dataset.copy));
  $('#accentBtn').addEventListener('click', cycleAccent);
  restoreAccent();
}

/* ───────────── command palette ───────────── */
export function initPalette(extra = []) {
  const root = $('#palette');
  const input = $('#paletteInput');
  const list = $('#paletteList');
  const go = (id) => () => {
    const t = $(id);
    if (t) lenis.scrollTo(t, { duration: reduced ? 0 : 1.8, easing: ease });
    else navigate(`/${id}`);
  };

  const commands = [
    { t: 'Go to About', k: 'nav', run: go('#about') },
    { t: 'Go to Experience', k: 'nav', run: go('#experience') },
    { t: 'Go to Craft', k: 'nav', run: go('#craft') },
    { t: 'Open portfolio', k: 'nav', run: () => (window.location.pathname.startsWith('/portfolio') ? lenis.scrollTo(0, { duration: reduced ? 0 : 1.6 }) : navigate('/portfolio/')) },
    { t: 'Open contact form', k: 'nav', run: () => (window.location.pathname.startsWith('/contact') ? $('#f-name')?.focus() : navigate('/contact/')) },
    ...extra,
    { t: 'Copy email address', k: 'action', run: () => copyText(SITE_EMAIL) },
    { t: 'Write an email', k: 'action', run: () => { window.location.href = `mailto:${SITE_EMAIL}`; } },
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
      if (e.key === '/' && !/input|textarea|select/i.test(e.target.tagName)) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(shown.length, 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(shown.length, 1); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
  });

  if (!/Mac|iPhone|iPad/.test(navigator.platform)) $('#paletteBtn kbd').textContent = 'Ctrl';
}

/* ───────────── small shared bits ───────────── */
export function initClock() {
  const el = $('#clock');
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { el.textContent = fmt.format(new Date()) + ' ET'; };
  tick();
  setInterval(tick, 1000);
}

export function fontsReady() {
  return Promise.all([
    document.fonts.load('800 100px "Bricolage Grotesque Variable"'),
    document.fonts.load('italic 400 40px "Instrument Serif"'),
    document.fonts.load('400 12px "Martian Mono"'),
  ]).catch(() => {});
}

/** Wire everything both pages share. Call once from each page entry. */
export function initShared() {
  initNav();
  initActions();
  initPalette();
  initClock();
}
