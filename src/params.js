// Parameter table for the MegaMike panel. One entry per control; the ids are
// shared by the UI widgets, presets and the DSP voice.

export const RANGES = ['LO', "32'", "16'", "8'", "4'", "2'"];
export const RANGE_SEMITONES = [-72, -24, -12, 0, 12, 24];
export const WAVES = ['triangle', 'trisaw', 'saw', 'square', 'wide', 'narrow'];

const TIME_LABELS = { 0: '1m', 2.5: '10m', 5: '100m', 7.5: '1s', 10: '10s' };

const knob = (id, label, def, extra = {}) =>
  ({ id, label, type: 'knob', min: 0, max: 10, default: def, ...extra });
const rocker = (id, label, def, color = 'blue') =>
  ({ id, label, type: 'rocker', color, default: def });
const rotary = (id, label, positions, def) =>
  ({ id, label, type: 'rotary', positions, default: def });

export const PARAMS = [
  // Controllers
  knob('tune', 'Tune', 0, { min: -5, max: 5 }),
  knob('glide', 'Glide', 0),
  knob('modMix', 'Modulation Mix', 0),
  rocker('oscMod', 'Osc. Modulation', 0),
  rocker('osc3Control', 'Osc. 3 Control', 1),

  // Oscillator bank
  rotary('osc1Range', 'Range', RANGES, 3),
  rotary('osc1Wave', 'Waveform', WAVES, 2),
  rotary('osc2Range', 'Range', RANGES, 3),
  knob('osc2Freq', 'Frequency', 0, { min: -7, max: 7 }),
  rotary('osc2Wave', 'Waveform', WAVES, 2),
  rotary('osc3Range', 'Range', RANGES, 3),
  knob('osc3Freq', 'Frequency', 0, { min: -7, max: 7 }),
  rotary('osc3Wave', 'Waveform', WAVES, 2),

  // Mixer
  knob('osc1Vol', 'Volume', 8),
  rocker('osc1On', 'Osc. 1', 1, 'orange'),
  knob('osc2Vol', 'Volume', 0),
  rocker('osc2On', 'Osc. 2', 0, 'orange'),
  knob('osc3Vol', 'Volume', 0),
  rocker('osc3On', 'Osc. 3', 0, 'orange'),
  knob('extVol', 'External Input Volume', 0),
  rocker('extOn', 'External Input', 0, 'orange'),
  knob('noiseVol', 'Noise Volume', 0),
  rocker('noiseOn', 'Noise', 0, 'orange'),
  rocker('noiseType', 'White / Pink', 0, 'orange'),

  // Modifiers: filter
  rocker('filterMod', 'Filter Modulation', 0),
  rocker('kbd1', 'Keyboard Control 1', 0),
  rocker('kbd2', 'Keyboard Control 2', 0),
  knob('cutoff', 'Cutoff Frequency', 0, { min: -5, max: 5 }),
  knob('emphasis', 'Emphasis', 0),
  knob('contourAmt', 'Amount of Contour', 5),
  knob('fAttack', 'Attack Time', 0, { labels: TIME_LABELS }),
  knob('fDecay', 'Decay Time', 4, { labels: TIME_LABELS }),
  knob('fSustain', 'Sustain Level', 5),

  // Modifiers: loudness contour
  knob('lAttack', 'Attack Time', 0, { labels: TIME_LABELS }),
  knob('lDecay', 'Decay Time', 4, { labels: TIME_LABELS }),
  knob('lSustain', 'Sustain Level', 8),

  // Output
  knob('mainVol', 'Main Output Volume', 7),
  rocker('mainOn', 'Main Output', 1, 'orange'),
  rocker('a440', 'A-440', 0, 'orange'),
  rocker('power', 'Power', 1, 'orange'),

  // Lower deck
  rocker('glideOn', 'Glide', 0),
  rocker('decayOn', 'Decay', 0),
];

export const PARAM_BY_ID = Object.fromEntries(PARAMS.map((p) => [p.id, p]));

export function defaultPatch() {
  const patch = {};
  for (const p of PARAMS) patch[p.id] = p.default;
  return patch;
}

/** Contour knob position (0..10) to seconds: 1 ms at 0, 10 s at 10, log scale. */
export function contourSeconds(v) {
  return 0.001 * 10 ** (0.4 * v);
}

/** Glide knob position (0..10) to slew time in seconds. */
export function glideSeconds(v) {
  return v <= 0 ? 0 : 0.005 * 10 ** (0.3 * v);
}
