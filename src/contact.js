import {
  gsap, $, lenis, scene, SITE_EMAIL,
  initCursor, initMagnetic, initTilt, initShared,
  arrivedViaTransition, curtainReveal, fontsReady, splitWords,
} from './core.js';

window.history.scrollRestoration = 'manual';

const TURNSTILE_TEST_KEY = '1x00000000000000000000AA'; // Cloudflare's always-passes test key
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? TURNSTILE_TEST_KEY : '');

const form = $('#contactForm');
const statusEl = $('#formStatus');
const submitBtn = $('#submitBtn');
const label = $('.btn__label', submitBtn);
const formStart = { t: Date.now() };

/* ───────────── Cloudflare Turnstile ───────────── */
let widgetId = null;
let token = '';
let tokenWaiters = [];

function loadTurnstile() {
  return new Promise((resolve, reject) => {
    if (typeof window.turnstile?.render === 'function') return resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initTurnstile() {
  if (!siteKey) {
    setStatus(`The form isn’t available right now. Please email ${SITE_EMAIL} instead.`, 'error');
    submitBtn.disabled = true;
    return;
  }
  try {
    const ts = await loadTurnstile();
    widgetId = ts.render('#turnstile-box', {
      sitekey: siteKey,
      theme: 'dark',
      appearance: 'interaction-only', // invisible unless Cloudflare needs a challenge
      callback: (t) => { token = t; tokenWaiters.forEach((r) => r(t)); tokenWaiters = []; },
      'expired-callback': () => { token = ''; },
      'error-callback': () => { token = ''; },
    });
  } catch {
    setStatus(`Couldn’t load the spam check. Check your connection or email ${SITE_EMAIL}.`, 'error');
  }
}

function getToken(timeoutMs = 12000) {
  if (token) return Promise.resolve(token);
  return new Promise((resolve) => {
    tokenWaiters.push(resolve);
    setTimeout(() => resolve(''), timeoutMs);
  });
}

function resetTurnstile() {
  token = '';
  if (widgetId !== null && typeof window.turnstile?.reset === 'function') window.turnstile.reset(widgetId);
}

/* ───────────── validation ───────────── */
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const rules = {
  name: (v) => (v.trim() ? '' : 'Please tell me your name.'),
  email: (v) => (EMAIL_RE.test(v.trim()) ? '' : 'That email address doesn’t look right.'),
  message: (v) => (v.trim().length >= 10 ? '' : 'Give me a little more detail (10 characters or more).'),
};

function setFieldError(name, msg) {
  const input = form.elements[name];
  const field = input.closest('.field');
  const err = $(`#e-${name}`);
  field.classList.toggle('has-error', !!msg);
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (err) err.textContent = msg;
  if (msg) gsap.fromTo(field, { x: -6 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
}

function validateAll() {
  let first = null;
  for (const [name, rule] of Object.entries(rules)) {
    const msg = rule(form.elements[name].value);
    setFieldError(name, msg);
    if (msg && !first) first = form.elements[name];
  }
  return first;
}

for (const name of Object.keys(rules)) {
  const el = form.elements[name];
  el.addEventListener('blur', () => { if (el.value || el.closest('.field').classList.contains('has-error')) setFieldError(name, rules[name](el.value)); });
  el.addEventListener('input', () => { if (el.closest('.field').classList.contains('has-error')) setFieldError(name, rules[name](el.value)); });
}

const msgEl = form.elements.message;
const counter = $('#msgCount');
msgEl.addEventListener('input', () => { counter.textContent = `${msgEl.value.length} / 5000`; });

/* ───────────── status + states ───────────── */
function setStatus(msg, kind = '') {
  statusEl.textContent = msg;
  statusEl.className = `form__status${kind ? ` is-${kind}` : ''}`;
}

function setSending(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle('is-sending', on);
  label.textContent = on ? 'Sending' : 'Send message';
}

function showSent(name) {
  scene?.pulse(window.innerWidth * 0.68, window.innerHeight * 0.5);
  const sent = $('#sent');
  $('#sentText').textContent = `Thanks, ${name.split(' ')[0] || 'friend'}. I read everything that comes in and will reply from ${SITE_EMAIL}.`;
  gsap.to(form, {
    opacity: 0, y: -20, duration: 0.45, ease: 'power3.in',
    onComplete() {
      form.hidden = true;
      sent.hidden = false;
      gsap.from(sent.children, { y: 30, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power4.out' });
      gsap.fromTo($('.sent__check circle'), { strokeDasharray: 176, strokeDashoffset: 176 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out' });
      gsap.fromTo($('.sent__check path'), { strokeDasharray: 50, strokeDashoffset: 50 }, { strokeDashoffset: 0, duration: 0.6, delay: 0.55, ease: 'power2.out' });
    },
  });
}

$('#sendAnother').addEventListener('click', () => {
  form.reset();
  counter.textContent = '0 / 5000';
  formStart.t = Date.now();
  setStatus('');
  resetTurnstile();
  $('#sent').hidden = true;
  form.hidden = false;
  gsap.fromTo(form, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
});

/* ───────────── submit ───────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('');

  const firstBad = validateAll();
  if (firstBad) { firstBad.focus(); return; }

  setSending(true);
  setStatus('Verifying you’re human…');
  const captcha = await getToken();
  if (!captcha) {
    setSending(false);
    setStatus('The spam check didn’t finish. Please try again in a moment.', 'error');
    resetTurnstile();
    return;
  }

  setStatus('');
  const data = new FormData(form);
  const payload = {
    name: data.get('name'),
    email: data.get('email'),
    company: data.get('company'),
    topics: data.getAll('topics'),
    message: data.get('message'),
    website: data.get('website'),   // honeypot
    t: Date.now() - formStart.t,    // time-to-submit
    token: captcha,
  };

  let succeeded = false;
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));

    if (res.ok && out.ok) {
      succeeded = true;
      showSent(String(payload.name || ''));
      return;
    }
    if (res.status === 422 && out.errors) {
      Object.entries(out.errors).forEach(([k, v]) => setFieldError(k, v));
      form.querySelector('.has-error input, .has-error textarea')?.focus();
    } else if (res.status === 429) {
      setStatus(`You’ve sent a few messages already. Please try again later, or email ${SITE_EMAIL}.`, 'error');
    } else if (out.error === 'captcha') {
      setStatus('The spam check failed. Please try once more.', 'error');
    } else {
      setStatus(`Something went wrong on my end. Please email ${SITE_EMAIL} directly.`, 'error');
    }
  } catch {
    setStatus(`Couldn’t reach the server. Check your connection or email ${SITE_EMAIL}.`, 'error');
  } finally {
    setSending(false);
    resetTurnstile(); // tokens are single-use; "send another" resets again after success
    if (succeeded) token = '';
  }
});

/* ───────────── intro ───────────── */
function playIntro() {
  const words = splitWords($('#cTitle .line'), { mask: true });
  scene?.setAlphaScale(window.innerWidth < 1000 ? 0.4 : 0.6);
  scene?.intro('galaxy');
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.from('.nav', { yPercent: -120, duration: 1, ease: 'power3.out' })
    .from(words, { yPercent: 115, rotate: 4, duration: 1.3, stagger: 0.1 }, 0.1)
    .from('[data-in]', { y: 36, opacity: 0, duration: 1, stagger: 0.09 }, 0.25)
    .from('.field, .topics, .form__foot', { y: 24, opacity: 0, duration: 0.9, stagger: 0.07 }, 0.5);
}

async function boot() {
  const viaTransition = arrivedViaTransition();
  initShared();
  await fontsReady();
  initCursor();
  initMagnetic();
  initTilt();
  initTurnstile();

  if (viaTransition) curtainReveal();
  playIntro();
  lenis.start();
  // let people type immediately when they came here to write
  if (window.matchMedia('(min-width: 1001px)').matches) setTimeout(() => $('#f-name')?.focus({ preventScroll: true }), 900);
}

boot();
