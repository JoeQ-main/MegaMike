// Panel widgets drawn with SVG and CSS: knobs, rotary selectors, rocker
// switches and performance wheels. Each returns { el, set(value), get() } and
// reports changes through onChange(value).

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(c);
  return el;
}

function div(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const deg = (d) => (d * Math.PI) / 180;

function polar(cx, cy, r, angleDeg) {
  // 0 degrees points up, positive is clockwise.
  return [cx + r * Math.sin(deg(angleDeg)), cy - r * Math.cos(deg(angleDeg))];
}

/** Vertical-drag behaviour shared by knobs and wheels. */
function dragVertical(el, { onStart, onDelta, onEnd, onTap }) {
  let startY = 0, moved = false, active = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    moved = false;
    active = true;
    onStart && onStart(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (!active) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 2) moved = true;
    onDelta(dy, e.shiftKey, e);
  });
  const finish = (e) => {
    if (!active) return;
    active = false;
    if (!moved && onTap) onTap(e);
    onEnd && onEnd(e);
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
}

// --- Knob -------------------------------------------------------------------

export function Knob(spec, onChange) {
  const { min, max } = spec;
  const span = max - min;
  const SWEEP = 300; // degrees of rotation from min to max
  let value = spec.default;

  const el = div(`ctl knob ${spec.cls || ''}`);
  el.dataset.id = spec.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-label', spec.label);

  const s = svg('svg', { viewBox: '0 0 100 100', class: 'knob-svg' });
  if (spec.size) s.setAttribute('style', `width:${spec.size}px;height:${spec.size}px`);

  // Printed scale: ticks and numbers.
  const scale = svg('g', { class: 'scale' });
  const labels = spec.labels
    ? Object.entries(spec.labels).map(([v, t]) => [parseFloat(v), t])
    : (() => {
      const out = [];
      const step = span > 10 ? 2 : 1;
      for (let v = min; v <= max; v += step) out.push([v, String(v)]);
      if (span > 10 && !out.some(([v]) => v === 0) && min < 0) out.push([0, '0']);
      return out;
    })();
  const ticksEvery = span > 10 ? 1 : 0.5;
  for (let v = min; v <= max + 1e-9; v += ticksEvery) {
    const a = -SWEEP / 2 + (SWEEP * (v - min)) / span;
    const major = labels.some(([lv]) => Math.abs(lv - v) < 1e-6);
    const [x1, y1] = polar(50, 50, major ? 36 : 37.5, a);
    const [x2, y2] = polar(50, 50, 40, a);
    scale.append(svg('line', { x1, y1, x2, y2, class: major ? 'tick major' : 'tick' }));
  }
  for (const [v, t] of labels) {
    const a = -SWEEP / 2 + (SWEEP * (v - min)) / span;
    const [x, y] = polar(50, 50, 46.5, a);
    scale.append(svg('text', { x, y, class: 'scale-text', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, [t]));
  }
  s.append(scale);

  // The knob itself.
  const cap = svg('g', { class: 'cap' });
  cap.append(svg('circle', { cx: 50, cy: 50, r: 31, class: 'knob-skirt' }));
  cap.append(svg('circle', { cx: 50, cy: 50, r: 25, class: 'knob-body' }));
  cap.append(svg('circle', { cx: 50, cy: 50, r: 18, class: 'knob-top' }));
  cap.append(svg('path', { d: 'M50 22 L52 32 L50 34 L48 32 Z', class: 'knob-pointer' }));
  cap.append(svg('line', { x1: 50, y1: 25, x2: 50, y2: 45, class: 'knob-line' }));
  s.append(cap);
  el.append(s);
  el.append(div('ctl-label', spec.label));
  const readout = div('readout');
  el.append(readout);

  function render() {
    const a = -SWEEP / 2 + (SWEEP * (value - min)) / span;
    cap.setAttribute('transform', `rotate(${a} 50 50)`);
    el.setAttribute('aria-valuenow', value.toFixed(2));
    readout.textContent = spec.format ? spec.format(value) : value.toFixed(1);
  }

  function set(v, fire = false) {
    const nv = clamp(v, min, max);
    if (nv === value && !fire) return;
    value = nv;
    render();
    if (fire) onChange(value);
  }

  let dragStart = value;
  dragVertical(el, {
    onStart: () => { dragStart = value; el.classList.add('dragging'); },
    onDelta: (dy, fine) => set(dragStart - (dy / (fine ? 1200 : 200)) * span, true),
    onEnd: () => el.classList.remove('dragging'),
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    set(value - Math.sign(e.deltaY) * span / (e.shiftKey ? 200 : 50), true);
  }, { passive: false });
  el.addEventListener('dblclick', () => set(spec.default, true));
  el.addEventListener('keydown', (e) => {
    const step = span / (e.shiftKey ? 100 : 20);
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(value + step, true); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(value - step, true); e.preventDefault(); }
  });

  render();
  return { el, set, get: () => value, spec };
}

// --- Rotary selector (range / waveform) -----------------------------------

const WAVE_GLYPHS = {
  triangle: 'M0 6 L4 0 L8 6 L12 0 L16 6',
  trisaw: 'M0 6 L5 0 L8 4 L8 0 L16 6',
  saw: 'M0 6 L8 0 L8 6 L16 0 L16 6',
  square: 'M0 6 L0 0 L8 0 L8 6 L16 6 L16 0',
  wide: 'M0 6 L0 0 L5 0 L5 6 L16 6 L16 0',
  narrow: 'M0 6 L0 0 L3 0 L3 6 L16 6 L16 0',
};

export function Rotary(spec, onChange) {
  const positions = spec.positions;
  const n = positions.length;
  const SWEEP = 150;
  let value = spec.default;

  const el = div(`ctl rotary ${spec.cls || ''}`);
  el.dataset.id = spec.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', spec.label);
  const s = svg('svg', { viewBox: '0 0 100 100', class: 'rotary-svg' });
  const scale = svg('g', { class: 'scale' });
  positions.forEach((label, i) => {
    const a = -SWEEP / 2 + (SWEEP * i) / (n - 1);
    const [x1, y1] = polar(50, 52, 30, a);
    const [x2, y2] = polar(50, 52, 34, a);
    scale.append(svg('line', { x1, y1, x2, y2, class: 'tick major' }));
    const [x, y] = polar(50, 52, 43, a);
    if (WAVE_GLYPHS[label]) {
      const g = svg('g', { transform: `translate(${x - 8} ${y - 3})`, class: 'wave-glyph' });
      g.append(svg('path', { d: WAVE_GLYPHS[label], fill: 'none' }));
      g.append(svg('title', {}, [label]));
      scale.append(g);
    } else {
      scale.append(svg('text', { x, y, class: 'scale-text', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, [label]));
    }
  });
  s.append(scale);
  const cap = svg('g', { class: 'cap' });
  cap.append(svg('circle', { cx: 50, cy: 52, r: 24, class: 'knob-skirt' }));
  cap.append(svg('path', { d: 'M50 26 L58 44 L58 60 A8 8 0 0 1 42 60 L42 44 Z', class: 'chicken-head' }));
  cap.append(svg('line', { x1: 50, y1: 30, x2: 50, y2: 44, class: 'knob-line' }));
  s.append(cap);
  el.append(s);
  el.append(div('ctl-label', spec.label));

  function render() {
    const a = -SWEEP / 2 + (SWEEP * value) / (n - 1);
    cap.setAttribute('transform', `rotate(${a} 50 52)`);
    el.setAttribute('aria-valuetext', positions[value]);
  }
  function set(v, fire = false) {
    const nv = clamp(Math.round(v), 0, n - 1);
    if (nv === value && !fire) return;
    value = nv;
    render();
    if (fire) onChange(value);
  }

  let dragStart = value;
  dragVertical(el, {
    onStart: () => { dragStart = value; },
    onDelta: (dy) => set(dragStart - dy / 25, true),
    onTap: (e) => set(value + (e.shiftKey ? -1 : 1) > n - 1 ? 0 : value + (e.shiftKey ? -1 : 1), true),
  });
  el.addEventListener('wheel', (e) => { e.preventDefault(); set(value - Math.sign(e.deltaY), true); }, { passive: false });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(value + 1, true); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(value - 1, true); e.preventDefault(); }
  });
  render();
  return { el, set, get: () => value, spec };
}

// --- Rocker switch ---------------------------------------------------------

export function Rocker(spec, onChange) {
  let value = spec.default ? 1 : 0;
  const el = div(`ctl rocker ${spec.color || 'blue'} ${spec.cls || ''}`);
  el.dataset.id = spec.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'switch');
  el.setAttribute('aria-label', spec.label);
  const onLabel = div('rocker-cap', spec.onText || 'ON');
  const body = div('rocker-body');
  body.append(div('rocker-top'), div('rocker-bottom'));
  const offLabel = div('rocker-cap', spec.offText || 'OFF');
  el.append(onLabel, body, offLabel, div('ctl-label', spec.label));

  function render() {
    el.classList.toggle('on', !!value);
    el.setAttribute('aria-checked', value ? 'true' : 'false');
  }
  function set(v, fire = false) {
    const nv = v ? 1 : 0;
    if (nv === value && !fire) return;
    value = nv;
    render();
    if (fire) onChange(value);
  }
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    set(!value, true);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { set(!value, true); e.preventDefault(); }
  });
  render();
  return { el, set, get: () => value, spec };
}

// --- Performance wheel -----------------------------------------------------

export function Wheel(spec, onChange) {
  // spec.spring: returns to centre on release (pitch). Otherwise stays (mod).
  const { min, max } = spec;
  let value = spec.default;
  const el = div(`ctl wheel ${spec.cls || ''}`);
  el.dataset.id = spec.id;
  el.setAttribute('aria-label', spec.label);
  const face = div('wheel-face');
  const ridges = div('wheel-ridges');
  face.append(ridges, div('wheel-line'));
  el.append(face, div('ctl-label', spec.label));

  function render() {
    const t = (value - min) / (max - min); // 0..1
    ridges.style.backgroundPositionY = `${-t * 60}px`;
    const line = face.querySelector('.wheel-line');
    line.style.top = `${(1 - t) * 100}%`;
  }
  function set(v, fire = false) {
    const nv = clamp(v, min, max);
    if (nv === value && !fire) return;
    value = nv;
    render();
    if (fire) onChange(value);
  }
  let dragStart = value;
  dragVertical(el, {
    onStart: () => { dragStart = value; },
    onDelta: (dy) => set(dragStart - (dy / 120) * (max - min), true),
    onEnd: () => { if (spec.spring) set(spec.default, true); },
  });
  el.addEventListener('wheel', (e) => { e.preventDefault(); set(value - Math.sign(e.deltaY) * (max - min) / 40, true); }, { passive: false });
  render();
  return { el, set, get: () => value, spec };
}
