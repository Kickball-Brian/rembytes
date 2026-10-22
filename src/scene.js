import * as THREE from 'three';
import gsap from 'gsap';

/* ──────────────────────────────────────────────────────────────
   One persistent particle field. Every section owns a "formation";
   the field morphs between them, flees the cursor, shockwaves on click
   and jitters with scroll velocity.
   ────────────────────────────────────────────────────────────── */

const CAM_Z = 3.5;
const FOV = 40;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

/* ---------- formation generators (unit space, returns Float32Array) ---------- */

function sampleText(lines, count) {
  const fontSize = 320;
  const lineH = fontSize * 0.84;
  const meas = document.createElement('canvas').getContext('2d');
  const font = `800 ${fontSize}px "Bricolage Grotesque Variable", "Helvetica Neue", Arial, sans-serif`;
  meas.font = font;
  const maxW = Math.ceil(Math.max(...lines.map((l) => meas.measureText(l).width)));
  const W = maxW + 80;
  const H = Math.ceil(lineH * lines.length + 100);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 50 + lineH * (i + 0.5)));

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts = [];
  const step = 2;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 140) pts.push(x, y);
    }
  }
  const n = pts.length / 2;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // more glyph pixels than particles → random subset; fewer → use all, then jitter-duplicate
    const exact = n <= count && i < n;
    const k = exact ? i : Math.floor(Math.random() * n);
    const px = pts[k * 2] + (exact ? 0 : rand(-1, 1) * step);
    const py = pts[k * 2 + 1] + (exact ? 0 : rand(-1, 1) * step);
    out[i * 3] = (px - W / 2) / maxW;
    out[i * 3 + 1] = -(py - H / 2) / maxW;
    out[i * 3 + 2] = rand(-1, 1) * 0.012;
  }
  // shuffle so the "random pick" subset isn't spatially clustered by index
  return shuffle(out, count);
}

function shuffle(arr, count) {
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    for (let k = 0; k < 3; k++) {
      const t = arr[i * 3 + k];
      arr[i * 3 + k] = arr[j * 3 + k];
      arr[j * 3 + k] = t;
    }
  }
  return arr;
}

function tiltX(arr, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < arr.length; i += 3) {
    const y = arr[i + 1], z = arr[i + 2];
    arr[i + 1] = y * c - z * s;
    arr[i + 2] = y * s + z * c;
  }
  return arr;
}

function genField(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = rand(-0.62, 0.62);
    const z = rand(-0.9, 0.5);
    const y = Math.sin(x * 9) * 0.045 + Math.cos(z * 7) * 0.04;
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return tiltX(out, 1.05);
}

function genTorus(count) {
  const out = new Float32Array(count * 3);
  const R = 0.3, r = 0.12;
  for (let i = 0; i < count; i++) {
    const u = rand(0, Math.PI * 2), v = rand(0, Math.PI * 2);
    const rr = r * (0.82 + Math.random() * 0.18);
    out[i * 3] = (R + rr * Math.cos(v)) * Math.cos(u);
    out[i * 3 + 1] = (R + rr * Math.cos(v)) * Math.sin(u);
    out[i * 3 + 2] = rr * Math.sin(v);
  }
  return out;
}

function genSphere(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand(-1, 1), th = rand(0, Math.PI * 2);
    const s = Math.sqrt(1 - u * u);
    const r = 0.34 * (0.9 + Math.random() * 0.1);
    out[i * 3] = r * s * Math.cos(th);
    out[i * 3 + 1] = r * u;
    out[i * 3 + 2] = r * s * Math.sin(th);
  }
  return out;
}

function genHelix(count) {
  const out = new Float32Array(count * 3);
  const R = 0.14, turns = 3.2;
  for (let i = 0; i < count; i++) {
    const t = rand(-1, 1);
    const a = t * turns * Math.PI * 2;
    const rung = Math.random() < 0.14;
    if (rung) {
      const k = rand(-1, 1);
      out[i * 3] = Math.cos(a) * R * k;
      out[i * 3 + 2] = Math.sin(a) * R * k;
    } else {
      const strand = Math.random() < 0.5 ? 0 : Math.PI;
      out[i * 3] = Math.cos(a + strand) * R + rand(-1, 1) * 0.008;
      out[i * 3 + 2] = Math.sin(a + strand) * R + rand(-1, 1) * 0.008;
    }
    out[i * 3 + 1] = t * 0.5;
  }
  return out;
}

function genGalaxy(count) {
  const out = new Float32Array(count * 3);
  const arms = 3;
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 0.62) * 0.56;
    const arm = (i % arms) * ((Math.PI * 2) / arms);
    const th = r * 9 + arm + rand(-1, 1) * (0.22 + r * 0.5);
    out[i * 3] = Math.cos(th) * r;
    out[i * 3 + 1] = Math.sin(th) * r;
    out[i * 3 + 2] = rand(-1, 1) * 0.04 * (1 - r);
  }
  return tiltX(out, -0.9);
}

function genChaos(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand(-1, 1), th = rand(0, Math.PI * 2), r = rand(0.7, 1.6);
    const s = Math.sqrt(1 - u * u);
    out[i * 3] = r * s * Math.cos(th);
    out[i * 3 + 1] = r * u * 0.8;
    out[i * 3 + 2] = r * s * Math.sin(th) - 0.4;
  }
  return out;
}

/* ---------- shaders ---------- */

const vert = /* glsl */ `
  attribute vec3 aTo;
  attribute vec4 aRand;
  uniform float uTime, uMix, uPx, uSize, uVel, uAlpha;
  uniform float uScaleA, uScaleB, uModeA, uModeB;
  uniform vec2 uMouse, uBurstPos;
  uniform float uMouseOn, uBurstT;
  varying float vHeat, vAcc, vA;

  vec3 rot(vec3 p, float mode, float a) {
    float c = cos(a), s = sin(a);
    if (mode > 1.5) return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
    if (mode > 0.5) return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
    return p;
  }

  void main() {
    float t = clamp((uMix - aRand.x * 0.45) / 0.55, 0.0, 1.0);
    float e = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;

    vec3 a = rot(position * uScaleA, uModeA, uTime * 0.2);
    vec3 b = rot(aTo * uScaleB, uModeB, uTime * 0.2);
    vec3 p = mix(a, b, e);

    // swirl + depth scatter while travelling between formations
    float arc = sin(e * 3.14159265);
    float ang = arc * (aRand.z - 0.5) * 2.6;
    float ca = cos(ang), sa = sin(ang);
    p.xy = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
    p.z += arc * (aRand.w - 0.5) * 1.8;

    // idle breathing + scroll-velocity turbulence
    float n = 0.0045 + uVel * 0.05 + arc * 0.02;
    p += vec3(
      sin(p.y * 4.0 + uTime * 0.7 + aRand.z * 6.283),
      sin(p.x * 4.0 + uTime * 0.6 + aRand.w * 6.283),
      sin((p.x + p.y) * 3.0 + uTime * 0.5 + aRand.x * 6.283)
    ) * n * (0.4 + aRand.y);

    // cursor repulsion
    vec2 dm = p.xy - uMouse;
    float dist = length(dm);
    float f = smoothstep(0.75, 0.0, dist) * uMouseOn;
    p.xy += normalize(dm + 1e-5) * f * f * 0.55;
    p.z += f * 0.7;
    float heat = f;

    // click shockwave
    float bd = length(p.xy - uBurstPos);
    float w = exp(-pow((bd - uBurstT * 4.2) * 2.0, 2.0)) * (1.0 - uBurstT);
    p.xy += normalize(p.xy - uBurstPos + 1e-5) * w * 0.7;
    p.z += w * 1.0;
    heat += w;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPx * (0.55 + aRand.y * 1.1) * (1.0 + heat * 1.3) / -mv.z;
    gl_Position = projectionMatrix * mv;

    vHeat = clamp(heat, 0.0, 1.0);
    vAcc = step(0.915, aRand.z);
    vA = uAlpha * (0.5 + aRand.y * 0.5);
  }
`;

const frag = /* glsl */ `
  uniform vec3 uBone, uAccent;
  varying float vHeat, vAcc, vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.05, r);
    vec3 col = mix(uBone, uAccent, clamp(vAcc * 0.95 + vHeat, 0.0, 1.0));
    gl_FragColor = vec4(col, a * a * vA);
  }
`;

/* ---------- scene ---------- */

export function createScene(canvas, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }

  const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
  const COUNT = coarse ? 20000 : 50000;
  const maxDpr = coarse ? 1.5 : 2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.z = CAM_Z;

  /* geometry */
  const geo = new THREE.BufferGeometry();
  const aFrom = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
  const aTo = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
  const aRand = new THREE.BufferAttribute(new Float32Array(COUNT * 4), 4);
  for (let i = 0; i < COUNT; i++) {
    aRand.array[i * 4] = Math.random();
    aRand.array[i * 4 + 1] = Math.random();
    aRand.array[i * 4 + 2] = Math.random();
    aRand.array[i * 4 + 3] = Math.random();
  }
  aFrom.setUsage(THREE.DynamicDrawUsage);
  aTo.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aFrom);
  geo.setAttribute('aTo', aTo);
  geo.setAttribute('aRand', aRand);

  const accentCol = new THREE.Color('#ff4d1c');
  const uniforms = {
    uTime: { value: 0 },
    uMix: { value: 0 },
    uPx: { value: 1 },
    uSize: { value: 9 },
    uVel: { value: 0 },
    uAlpha: { value: 0 },
    uScaleA: { value: 1 },
    uScaleB: { value: 1 },
    uModeA: { value: 0 },
    uModeB: { value: 0 },
    uMouse: { value: new THREE.Vector2(99, 99) },
    uMouseOn: { value: 0 },
    uBurstPos: { value: new THREE.Vector2() },
    uBurstT: { value: 1 },
    uBone: { value: new THREE.Color('#ecebe4') },
    uAccent: { value: accentCol },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  /* formations */
  const portrait = () => window.innerWidth / window.innerHeight < 0.85;
  let namePortrait = portrait();
  let data = {};
  const view = { w: 1, h: 1 };

  // mode: 0 static, 1 spin Y, 2 spin Z. fit: world scale of the unit-space shape.
  const defs = {
    name:   { alpha: 1.0,  mode: 0, build: () => sampleText(namePortrait ? ['REM', 'BYTES'] : ['REMBYTES'], COUNT),
              fit: (v) => namePortrait ? Math.min(v.w * 0.88, v.h * 0.5 / 0.6) : v.w * 0.86 },
    field:  { alpha: 0.55, mode: 0, build: () => genField(COUNT),  fit: (v) => v.w * 1.5 },
    torus:  { alpha: 0.6,  mode: 1, build: () => genTorus(COUNT),  fit: (v) => Math.min(v.h * 1.05, v.w * 0.9) },
    sphere: { alpha: 0.6,  mode: 1, build: () => genSphere(COUNT), fit: (v) => Math.min(v.h * 1.15, v.w * 0.95) },
    helix:  { alpha: 0.45, mode: 1, build: () => genHelix(COUNT),  fit: (v) => Math.min(v.h * 1.25, v.w * 1.3) },
    galaxy: { alpha: 0.75, mode: 2, build: () => genGalaxy(COUNT), fit: (v) => Math.min(v.w * 1.3, v.h * 1.9) },
    chaos:  { alpha: 0.0,  mode: 0, build: () => genChaos(COUNT),  fit: (v) => Math.max(v.w, v.h) },
  };

  function buildAll() {
    data = {};
    for (const k of Object.keys(defs)) data[k] = defs[k].build();
  }

  let cur = 'chaos';
  let next = 'chaos';
  let pending = null;
  let alphaScale = 1;
  let morphing = false;
  let tween = null;

  function applyScales() {
    uniforms.uScaleA.value = defs[cur].fit(view);
    uniforms.uScaleB.value = defs[next].fit(view);
  }
  function loadBuffers() {
    aFrom.array.set(data[cur]);
    aTo.array.set(data[next]);
    aFrom.needsUpdate = true;
    aTo.needsUpdate = true;
    uniforms.uModeA.value = defs[cur].mode;
    uniforms.uModeB.value = defs[next].mode;
    applyScales();
  }

  /* sizing */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uPx.value = dpr * (h / 900);
    view.h = 2 * Math.tan((FOV * Math.PI) / 360) * CAM_Z;
    view.w = view.h * camera.aspect;
    const p = portrait();
    if (p !== namePortrait) {
      namePortrait = p;
      data.name = defs.name.build();
      loadBuffers();
    }
    applyScales();
  }

  /* morph between formations */
  function start(name) {
    cur = next;
    next = name;
    loadBuffers();
    uniforms.uMix.value = 0;
    morphing = true;
    gsap.to(uniforms.uAlpha, { value: defs[name].alpha * alphaScale, duration: 1.6, ease: 'power2.inOut' });
    tween = gsap.to(uniforms.uMix, {
      value: 1,
      duration: reduced ? 0.01 : 2.4,
      ease: 'none',
      onComplete() {
        morphing = false;
        if (pending && pending !== next) {
          const n = pending;
          pending = null;
          start(n);
        } else pending = null;
      },
    });
  }

  function morphTo(name) {
    if (!defs[name]) return;
    if (morphing) {
      pending = name === next ? null : name;
      if (tween) tween.timeScale(2.2); // catch up when scrolling fast
      return;
    }
    if (name === next) return;
    start(name);
  }

  /* interaction state */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, on: 0, targetOn: 0 };
  let vel = 0, velTarget = 0;
  let paused = false;

  function setPointer(clientX, clientY) {
    const nx = (clientX / window.innerWidth) * 2 - 1;
    const ny = -((clientY / window.innerHeight) * 2 - 1);
    mouse.tx = nx;
    mouse.ty = ny;
    mouse.targetOn = 1;
  }
  function pointerLeave() { mouse.targetOn = 0; }

  function pulse(clientX, clientY) {
    if (reduced) return;
    const nx = (clientX / window.innerWidth) * 2 - 1;
    const ny = -((clientY / window.innerHeight) * 2 - 1);
    uniforms.uBurstPos.value.set((nx * view.w) / 2, (ny * view.h) / 2);
    uniforms.uBurstT.value = 0;
    gsap.fromTo(uniforms.uBurstT, { value: 0 }, { value: 1, duration: 2.2, ease: 'power2.out', overwrite: true });
  }

  /* loop */
  let last = performance.now();
  const clock = { getDelta() { const n = performance.now(); const d = (n - last) / 1000; last = n; return d; } };
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (paused) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduced) uniforms.uTime.value += dt;

    mouse.x += (mouse.tx - mouse.x) * 0.18;
    mouse.y += (mouse.ty - mouse.y) * 0.18;
    mouse.on += (mouse.targetOn - mouse.on) * 0.08;
    uniforms.uMouse.value.set((mouse.x * view.w) / 2, (mouse.y * view.h) / 2);
    uniforms.uMouseOn.value = reduced ? 0 : mouse.on;

    vel += (velTarget - vel) * 0.1;
    velTarget *= 0.9;
    uniforms.uVel.value = Math.min(vel, 1.5);

    // gentle camera parallax
    camera.position.x += (mouse.x * 0.18 - camera.position.x) * 0.04;
    camera.position.y += (mouse.y * 0.1 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  /* boot */
  buildAll();
  resize();
  loadBuffers();
  // first formation is "chaos" → "name"; run the intro on demand
  window.addEventListener('resize', debounce(resize, 120));
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    clock.getDelta();
  });
  frame();

  return {
    intro(name = 'name') {
      start(name); // chaos → formation
      return tween;
    },
    morphTo,
    setAlphaScale(v) { alphaScale = v; gsap.to(uniforms.uAlpha, { value: defs[next].alpha * v, duration: 0.8 }); },
    setPointer,
    pointerLeave,
    pulse,
    setVelocity(v) { velTarget = Math.max(velTarget, Math.min(Math.abs(v) * 0.06, 1.5)); },
    setAccent(hex) {
      const c = new THREE.Color(hex);
      gsap.to(accentCol, { r: c.r, g: c.g, b: c.b, duration: 0.6 });
    },
    setPaused(v) { paused = v; if (!v) clock.getDelta(); },
    get paused() { return paused; },
    destroy() { cancelAnimationFrame(raf); renderer.dispose(); geo.dispose(); mat.dispose(); },
  };
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
