// The sequencer module UI: builds the panel with the shared widgets, runs the
// look-ahead scheduler against the audio clock and sends timed events to the
// engine.

import { Knob, Rocker } from './widgets.js';
import { Sequencer, STEP_COUNT, noteName } from './sequencer.js';

const STORAGE_KEY = 'megamike.sequencer.v1';
const LOOKAHEAD = 0.12; // seconds scheduled ahead of the audio clock
const TICK_MS = 25;

function div(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

export function buildSequencer(container, { engine, powerUp, onRunningChange }) {
  const seq = new Sequencer();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) seq.load(JSON.parse(raw));
  } catch { /* no saved pattern */ }

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seq)); } catch { /* storage unavailable */ }
  };

  // --- transport controls --------------------------------------------------

  const transport = div('seq-transport');
  const tempoKnob = Knob({
    id: 'seqTempo', label: 'Tempo', min: 40, max: 240, default: 120,
    labels: { 40: '40', 80: '80', 120: '120', 160: '160', 200: '200', 240: '240' },
    format: (v) => `${Math.round(v)} bpm`,
  }, (v) => { seq.tempo = Math.round(v); save(); });
  const gateKnob = Knob({
    id: 'seqGate', label: 'Gate', min: 0, max: 10, default: 5,
    format: (v) => `${Math.round(v * 10)}%`,
  }, (v) => { seq.gate = Math.max(0.05, v / 10); save(); });
  const runRocker = Rocker({ id: 'seqRun', label: 'Run', color: 'orange', default: 0, onText: 'RUN', offText: 'STOP' },
    (v) => (v ? start() : stop()));
  transport.append(tempoKnob.el, gateKnob.el, runRocker.el);
  tempoKnob.set(seq.tempo);
  gateKnob.set(seq.gate * 10);

  // --- steps ---------------------------------------------------------------

  const stepsEl = div('seq-steps');
  const lamps = [];
  const pitchKnobs = [];
  seq.steps.forEach((step, i) => {
    const row = div('seq-step');
    const lamp = div('lamp led');
    lamps.push(lamp);
    const knob = Knob({
      id: `seqPitch${i}`, label: `Step ${i + 1}`, min: 0, max: 24, default: 0,
      labels: { 0: '0', 12: '12', 24: '24' },
      format: (v) => `+${Math.round(v)}  ${noteName(seq.root + Math.round(v))}`,
    }, (v) => { step.pitch = Math.round(v); save(); });
    knob.set(step.pitch);
    pitchKnobs.push(knob);
    const rocker = Rocker({ id: `seqOn${i}`, label: '', color: 'blue', default: step.on ? 1 : 0 },
      (v) => { step.on = !!v; save(); });
    row.append(lamp, knob.el, rocker.el);
    stepsEl.append(row);
  });

  container.append(div('seq-title', 'Sequencer'), transport, stepsEl);

  // --- scheduler -----------------------------------------------------------

  let timer = null;
  let lampTimers = [];

  function lightLamp(index) {
    lamps.forEach((l, i) => l.classList.toggle('lit', i === index));
  }

  function tick() {
    const ctx = engine.ctx;
    if (!ctx || !engine.ready) return;
    const now = ctx.currentTime;
    for (const ev of seq.advance(now + LOOKAHEAD)) {
      if (ev.type === 'step') {
        const delay = Math.max(0, (ev.time - now) * 1000);
        lampTimers.push(setTimeout(() => lightLamp(ev.index), delay));
      } else {
        engine.send({ type: ev.type, note: ev.note, time: ev.time });
      }
    }
  }

  async function start() {
    await powerUp();
    if (!engine.ready) { runRocker.set(0); return; }
    seq.start(engine.ctx.currentTime + 0.05);
    tick();
    timer = setInterval(tick, TICK_MS);
    onRunningChange && onRunningChange(true);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    lampTimers.forEach(clearTimeout);
    lampTimers = [];
    if (engine.ready) {
      engine.send({ type: 'clearQueue' });
      for (const ev of seq.stop(engine.ctx.currentTime)) engine.send({ type: ev.type, note: ev.note });
    } else {
      seq.stop(0);
    }
    lightLamp(-1);
    onRunningChange && onRunningChange(false);
  }

  return {
    seq,
    get running() { return seq.running; },
    setRoot(note) { seq.setRoot(note); },
    stop() { if (seq.running) runRocker.set(0, true); },
  };
}
