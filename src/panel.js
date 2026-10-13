// Builds the panel from the parameter table, wires widgets, keyboard, MIDI and
// presets to the audio engine.

import { PARAMS, RANGES, defaultPatch, contourSeconds } from './params.js';
import { Knob, Rotary, Rocker, Wheel } from './widgets.js';
import { Engine } from './engine.js';
import { buildKeyboard, attachComputerKeyboard, attachMidi } from './keyboard.js';
import { FACTORY, loadUserPresets, saveUserPresets, sanitizePatch } from './presets.js';
import { buildSequencer } from './seqpanel.js';

const engine = new Engine();
const widgets = {};
const $ = (sel) => document.querySelector(sel);

// --- panel widgets ---------------------------------------------------------

const ROCKER_TEXT = {
  noiseType: { onText: 'PINK', offText: 'WHITE' },
  osc3Control: { onText: 'KBD', offText: 'FREE' },
};

function formatFor(spec) {
  if (spec.labels) return (v) => {
    const s = contourSeconds(v);
    return s >= 1 ? `${s.toFixed(1)} s` : `${Math.round(s * 1000)} ms`;
  };
  return (v) => (spec.min < 0 ? (v >= 0 ? '+' : '') : '') + v.toFixed(1);
}

for (const spec of PARAMS) {
  const slot = document.querySelector(`[data-ctl="${spec.id}"]`);
  if (!slot) continue;
  const onChange = (value) => {
    engine.setParam(spec.id, value);
    markDirty();
  };
  let w;
  if (spec.type === 'knob') w = Knob({ ...spec, format: formatFor(spec) }, onChange);
  else if (spec.type === 'rotary') w = Rotary(spec, onChange);
  else w = Rocker({ ...spec, ...(ROCKER_TEXT[spec.id] || {}) }, onChange);
  slot.append(w.el);
  widgets[spec.id] = w;
  engine.patch[spec.id] = spec.default;
}

const pitchWheel = Wheel({ id: 'pitchWheel', label: 'Pitch', min: -1, max: 1, default: 0, spring: true },
  (v) => engine.setBend(v));
const modWheel = Wheel({ id: 'modWheel', label: 'Mod.', min: 0, max: 1, default: 0 },
  (v) => engine.setModWheel(v));
$('[data-ctl="pitchWheel"]').append(pitchWheel.el);
$('[data-ctl="modWheel"]').append(modWheel.el);

function currentPatch() {
  const p = {};
  for (const spec of PARAMS) p[spec.id] = widgets[spec.id].get();
  return p;
}

function applyPatch(patch) {
  const clean = sanitizePatch(patch);
  for (const spec of PARAMS) widgets[spec.id].set(clean[spec.id]);
  engine.setPatch(clean);
}

// --- audio power-up --------------------------------------------------------

const overlay = $('#power-overlay');
const statusAudio = $('#status-audio');
let starting = false;

async function powerUp() {
  if (engine.ready || starting) return;
  starting = true;
  try {
    await engine.start();
    overlay.classList.add('hidden');
  } catch (err) {
    statusAudio.textContent = 'audio: failed';
    statusAudio.title = String(err);
    overlay.querySelector('p').textContent = `Audio could not start: ${err.message}. ` +
      'This page must be served over http(s), not opened as a file.';
  } finally {
    starting = false;
  }
}
engine.onStateChange = (state) => {
  statusAudio.textContent = `audio: ${state}`;
  statusAudio.classList.toggle('on', state === 'running');
};
window.addEventListener('pointerdown', powerUp, { capture: true });
window.addEventListener('keydown', powerUp, { capture: true });

// --- overload lamp ---------------------------------------------------------

const lamp = $('#overload-lamp');
engine.onMeter = ({ overload }) => {
  const lit = overload > 0.9;
  lamp.classList.toggle('lit', lit);
  lamp.style.opacity = lit ? String(Math.min(1, 0.5 + (overload - 0.9) / 2)) : '1';
};

// --- notes -----------------------------------------------------------------

const keyboardEl = $('#keyboard');
const heldBy = new Map(); // note -> Set(source)

function noteOn(note, source) {
  if (note < 0 || note > 127) return;
  if (sequencer && sequencer.running) {
    // A running sequencer treats the keyboard as its transpose control.
    sequencer.setRoot(note);
    keys.setPressed(note, true);
    return;
  }
  let set = heldBy.get(note);
  if (!set) { set = new Set(); heldBy.set(note, set); }
  const wasHeld = set.size > 0;
  set.add(source);
  if (!wasHeld) {
    engine.noteOn(note);
    keys.setPressed(note, true);
  }
}
function noteOff(note, source) {
  const set = heldBy.get(note);
  if (!set) { keys.setPressed(note, false); return; }
  set.delete(source);
  if (set.size === 0) {
    heldBy.delete(note);
    engine.noteOff(note);
    keys.setPressed(note, false);
  }
}
function panic() {
  for (const note of [...heldBy.keys()]) keys.setPressed(note, false);
  heldBy.clear();
  engine.allNotesOff();
}

const keys = buildKeyboard(keyboardEl, { noteOn, noteOff });
const octaveStatus = $('#status-octave');
attachComputerKeyboard({
  noteOn, noteOff, panic,
  octaveChanged: (o) => {
    octaveStatus.textContent = `keys: Z=C${3 + o} Q=C${4 + o}`;
  },
});
const midiStatus = $('#status-midi');
attachMidi({
  noteOn, noteOff, panic,
  modWheel: (v) => { modWheel.set(v); engine.setModWheel(v); },
  bend: (v) => { pitchWheel.set(v); engine.setBend(v); },
  midiChanged: (names) => {
    midiStatus.textContent = names.length ? `midi: ${names.join(', ')}` : 'midi: none';
    midiStatus.classList.toggle('on', names.length > 0);
  },
});
$('#panic').addEventListener('click', () => { sequencer.stop(); panic(); });

const sequencer = buildSequencer($('#sequencer'), {
  engine,
  powerUp,
  onRunningChange: (running) => {
    if (!running) return;
    // Keys held on the synth would fight the sequence for lowest-note priority.
    if (heldBy.size) sequencer.setRoot(Math.min(...heldBy.keys()));
    for (const note of [...heldBy.keys()]) keys.setPressed(note, false);
    heldBy.clear();
    engine.allNotesOff();
  },
});

// --- presets ---------------------------------------------------------------

const select = $('#preset-select');
let userPresets = loadUserPresets();
let dirty = false;

function markDirty() {
  if (dirty) return;
  dirty = true;
  const opt = select.selectedOptions[0];
  if (opt && !opt.textContent.endsWith(' *')) opt.textContent += ' *';
}

function refreshPresetList(selectValue) {
  select.innerHTML = '';
  const factory = document.createElement('optgroup');
  factory.label = 'Factory';
  FACTORY.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = `f${i}`; o.textContent = p.name;
    factory.append(o);
  });
  select.append(factory);
  if (userPresets.length) {
    const user = document.createElement('optgroup');
    user.label = 'User';
    userPresets.forEach((p, i) => {
      const o = document.createElement('option');
      o.value = `u${i}`; o.textContent = p.name;
      user.append(o);
    });
    select.append(user);
  }
  if (selectValue) select.value = selectValue;
  dirty = false;
}

function selectedPreset() {
  const v = select.value;
  if (v.startsWith('f')) return FACTORY[parseInt(v.slice(1), 10)];
  if (v.startsWith('u')) return userPresets[parseInt(v.slice(1), 10)];
  return null;
}

select.addEventListener('change', () => {
  const p = selectedPreset();
  if (p) applyPatch(p.patch);
  dirty = false;
  select.blur();
});

$('#preset-save').addEventListener('click', () => {
  const current = selectedPreset();
  const suggested = current && select.value.startsWith('u') ? current.name : '';
  const name = window.prompt('Preset name', suggested);
  if (!name) return;
  const patch = currentPatch();
  const existing = userPresets.findIndex((p) => p.name === name);
  if (existing >= 0) userPresets[existing] = { name, patch };
  else userPresets.push({ name, patch });
  saveUserPresets(userPresets);
  refreshPresetList(`u${existing >= 0 ? existing : userPresets.length - 1}`);
});

$('#preset-delete').addEventListener('click', () => {
  if (!select.value.startsWith('u')) { window.alert('Only user presets can be deleted.'); return; }
  const i = parseInt(select.value.slice(1), 10);
  if (!window.confirm(`Delete preset "${userPresets[i].name}"?`)) return;
  userPresets.splice(i, 1);
  saveUserPresets(userPresets);
  refreshPresetList('f0');
});

$('#preset-export').addEventListener('click', () => {
  const p = selectedPreset();
  const name = (p ? p.name : 'patch').replace(/[^\w\- ]+/g, '') || 'patch';
  const blob = new Blob([JSON.stringify({ name, patch: currentPatch() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.megamike.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

const fileInput = $('#preset-file');
$('#preset-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : [data];
    let last = null;
    for (const item of list) {
      const patch = sanitizePatch(item.patch || item);
      const name = typeof item.name === 'string' && item.name ? item.name : file.name.replace(/\.[^.]*$/, '');
      const existing = userPresets.findIndex((p) => p.name === name);
      if (existing >= 0) userPresets[existing] = { name, patch };
      else userPresets.push({ name, patch });
      last = userPresets.findIndex((p) => p.name === name);
    }
    saveUserPresets(userPresets);
    refreshPresetList(last != null ? `u${last}` : undefined);
    const p = selectedPreset();
    if (p) applyPatch(p.patch);
  } catch (err) {
    window.alert(`Could not import: ${err.message}`);
  }
});

refreshPresetList('f0');
applyPatch(defaultPatch());

// --- help ------------------------------------------------------------------

const help = $('#help-overlay');
$('#help-btn').addEventListener('click', () => help.classList.remove('hidden'));
$('#help-close').addEventListener('click', () => help.classList.add('hidden'));
help.addEventListener('pointerdown', (e) => { if (e.target === help) help.classList.add('hidden'); });

// --- fit to window -----------------------------------------------------------

const rig = $('#rig');
function fit() {
  const stage = $('.stage');
  const w = rig.offsetWidth, h = rig.offsetHeight;
  const scale = Math.min(1.25, (stage.clientWidth - 24) / w, (stage.clientHeight - 24) / h);
  rig.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fit);
fit();

// Native launcher hook: pywebview exposes window.pywebview when embedded.
window.megamike = { engine, widgets, currentPatch, applyPatch, sequencer, RANGES };
