// Built-in patches plus user presets kept in localStorage.

import { defaultPatch } from './params.js';

const STORAGE_KEY = 'megamike.presets.v1';

const patch = (overrides) => ({ ...defaultPatch(), ...overrides });

export const FACTORY = [
  { name: 'Init', patch: patch({}) },
  {
    name: 'Classic Lead',
    patch: patch({
      osc1Range: 3, osc1Wave: 2, osc1Vol: 8, osc1On: 1,
      osc2Range: 3, osc2Wave: 2, osc2Freq: 0.12, osc2Vol: 7, osc2On: 1,
      osc3Range: 2, osc3Wave: 2, osc3Freq: -0.1, osc3Vol: 6, osc3On: 1,
      cutoff: -0.5, emphasis: 3, contourAmt: 4, fAttack: 2, fDecay: 6, fSustain: 4,
      lAttack: 1, lDecay: 6, lSustain: 9, kbd1: 1, kbd2: 1, glide: 3, glideOn: 1, decayOn: 1,
    }),
  },
  {
    name: 'Fat Bass',
    patch: patch({
      osc1Range: 1, osc1Wave: 2, osc1Vol: 9, osc1On: 1,
      osc2Range: 1, osc2Wave: 3, osc2Freq: 0.08, osc2Vol: 8, osc2On: 1,
      osc3Range: 2, osc3Wave: 2, osc3Freq: 0, osc3Vol: 5, osc3On: 1,
      cutoff: -2.5, emphasis: 2, contourAmt: 6, fAttack: 0, fDecay: 5, fSustain: 2,
      lAttack: 0, lDecay: 5, lSustain: 7, kbd1: 1,
    }),
  },
  {
    name: 'Brass',
    patch: patch({
      osc1Range: 3, osc1Wave: 2, osc1Vol: 8, osc1On: 1,
      osc2Range: 3, osc2Wave: 2, osc2Freq: 0.07, osc2Vol: 8, osc2On: 1,
      osc3Range: 3, osc3Wave: 2, osc3Freq: -0.07, osc3Vol: 8, osc3On: 1,
      cutoff: -1.5, emphasis: 1.5, contourAmt: 6, fAttack: 4, fDecay: 5, fSustain: 6,
      lAttack: 3, lDecay: 5, lSustain: 10, kbd2: 1,
    }),
  },
  {
    name: 'Resonant Sweep',
    patch: patch({
      osc1Range: 2, osc1Wave: 3, osc1Vol: 8, osc1On: 1,
      osc2Range: 2, osc2Wave: 4, osc2Freq: 7, osc2Vol: 6, osc2On: 1,
      cutoff: -3, emphasis: 8.5, contourAmt: 8, fAttack: 5.5, fDecay: 7, fSustain: 0,
      lAttack: 2, lDecay: 7, lSustain: 8, decayOn: 1,
    }),
  },
  {
    name: 'Vibrato Flute',
    patch: patch({
      osc1Range: 4, osc1Wave: 0, osc1Vol: 7, osc1On: 1,
      osc3Range: 0, osc3Wave: 0, osc3Freq: 1.5, osc3On: 0, osc3Control: 0,
      oscMod: 1, modMix: 0, cutoff: 1, emphasis: 0.5, contourAmt: 2,
      fAttack: 3, fDecay: 5, fSustain: 5, lAttack: 4, lDecay: 5, lSustain: 9, kbd2: 1,
    }),
  },
  {
    name: 'Overload Growl',
    patch: patch({
      osc1Range: 2, osc1Wave: 2, osc1Vol: 10, osc1On: 1,
      osc2Range: 2, osc2Wave: 2, osc2Freq: 0.15, osc2Vol: 10, osc2On: 1,
      extOn: 1, extVol: 6, cutoff: -1, emphasis: 4, contourAmt: 5,
      fAttack: 0, fDecay: 6, fSustain: 3, lAttack: 0, lDecay: 6, lSustain: 8, kbd1: 1,
    }),
  },
  {
    name: 'Wind & Noise',
    patch: patch({
      osc1On: 0, noiseOn: 1, noiseVol: 8, noiseType: 1,
      filterMod: 1, osc3Range: 0, osc3Wave: 0, osc3Freq: -3, osc3Control: 0, modMix: 0,
      cutoff: -2, emphasis: 7, contourAmt: 4, fAttack: 6, fDecay: 7, fSustain: 5,
      lAttack: 6, lDecay: 7, lSustain: 8, decayOn: 1,
    }),
  },
];

export function loadUserPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.name === 'string' && p.patch) : [];
  } catch {
    return [];
  }
}

export function saveUserPresets(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private window etc.) - presets just will not persist.
  }
}

/** Keep only known parameter ids and numeric values. */
export function sanitizePatch(obj) {
  const base = defaultPatch();
  const out = {};
  for (const id of Object.keys(base)) {
    const v = obj && obj[id];
    out[id] = typeof v === 'number' && Number.isFinite(v) ? v : base[id];
  }
  return out;
}
