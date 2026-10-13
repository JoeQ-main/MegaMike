// The whole MegaMike signal path for one monophonic voice, plus the keyboard
// logic: lowest-note priority, single triggering, glide. Pure JavaScript with
// no browser globals so it runs both in an AudioWorklet and under Node tests.

import { Oscillator } from './oscillator.js';
import { Noise } from './noise.js';
import { Envelope } from './envelope.js';
import { LadderFilter } from './filter.js';
import { defaultPatch, contourSeconds, glideSeconds, RANGE_SEMITONES } from '../params.js';

const PITCH_BEND_SEMITONES = 7;
const OSC_MOD_SEMITONES = 7;
const FILTER_MOD_OCTAVES = 4;
const CONTOUR_OCTAVES = 7;
const TWO_PI = Math.PI * 2;

export function midiToHz(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.p = defaultPatch();
    this.osc = [new Oscillator(sampleRate), new Oscillator(sampleRate), new Oscillator(sampleRate)];
    this.noise = new Noise();
    this.filter = new LadderFilter(sampleRate);
    this.filterEnv = new Envelope(sampleRate);
    this.ampEnv = new Envelope(sampleRate);

    this.held = [];
    this.pitch = 60;
    this.targetPitch = 60;
    this.glideCoef = 1;
    this.bend = 0;
    this.modWheel = 0;
    this.osc3Out = 0;
    this.lastOut = 0;
    this.a440Phase = 0;
    this.overload = 0;

    for (const id of Object.keys(this.p)) this.applyParam(id);
  }

  setParam(id, value) {
    if (!(id in this.p)) return;
    this.p[id] = value;
    this.applyParam(id);
  }

  setPatch(patch) {
    for (const [id, value] of Object.entries(patch)) this.setParam(id, value);
  }

  applyParam(id) {
    const p = this.p;
    switch (id) {
      case 'osc1Wave': this.osc[0].waveform = p.osc1Wave | 0; break;
      case 'osc2Wave': this.osc[1].waveform = p.osc2Wave | 0; break;
      case 'osc3Wave': this.osc[2].waveform = p.osc3Wave | 0; break;
      case 'noiseType': this.noise.pink = !!p.noiseType; break;
      case 'fAttack': this.filterEnv.setAttack(contourSeconds(p.fAttack)); break;
      case 'fDecay': this.filterEnv.setDecay(contourSeconds(p.fDecay)); break;
      case 'fSustain': this.filterEnv.setSustain(p.fSustain / 10); break;
      case 'lAttack': this.ampEnv.setAttack(contourSeconds(p.lAttack)); break;
      case 'lDecay': this.ampEnv.setDecay(contourSeconds(p.lDecay)); break;
      case 'lSustain': this.ampEnv.setSustain(p.lSustain / 10); break;
      case 'decayOn':
        this.filterEnv.releaseEnabled = !!p.decayOn;
        this.ampEnv.releaseEnabled = !!p.decayOn;
        break;
      case 'emphasis': this.filter.setResonance((p.emphasis / 10) * 1.4); break;
      case 'glide': {
        const s = glideSeconds(p.glide);
        this.glideCoef = s <= 0 ? 1 : 1 - Math.exp(-1 / ((s / 3) * this.sampleRate));
        break;
      }
      default: break;
    }
  }

  // --- keyboard -----------------------------------------------------------

  noteOn(note) {
    if (!this.held.includes(note)) this.held.push(note);
    const first = this.held.length === 1;
    const lowest = Math.min(...this.held);
    this.targetPitch = lowest;
    if (first) {
      this.filterEnv.trigger();
      this.ampEnv.trigger();
      if (!this.p.glideOn) this.pitch = lowest;
    }
  }

  noteOff(note) {
    const i = this.held.indexOf(note);
    if (i < 0) return;
    this.held.splice(i, 1);
    if (this.held.length) {
      this.targetPitch = Math.min(...this.held);
    } else {
      this.filterEnv.release();
      this.ampEnv.release();
    }
  }

  allNotesOff() {
    this.held.length = 0;
    this.filterEnv.release();
    this.ampEnv.release();
  }

  setBend(v) { this.bend = Math.max(-1, Math.min(1, v)); }
  setModWheel(v) { this.modWheel = Math.max(0, Math.min(1, v)); }

  get gateOn() { return this.held.length > 0; }

  // --- audio --------------------------------------------------------------

  oscFrequency(index, base, rangeIdx, fine, tracksKeyboard) {
    const range = RANGE_SEMITONES[rangeIdx] ?? 0;
    const lo = rangeIdx === 0;
    const fineSemis = lo ? fine * (24 / 7) : fine;
    const root = tracksKeyboard ? base : 60;
    return midiToHz(root + range + fineSemis);
  }

  tick() {
    const p = this.p;
    const sr = this.sampleRate;

    if (p.glideOn) this.pitch += (this.targetPitch - this.pitch) * this.glideCoef;
    else this.pitch = this.targetPitch;

    const fEnv = this.filterEnv.process();
    const aEnv = this.ampEnv.process();

    const n = this.noise.process();
    const mix = p.modMix / 10;
    const mod = ((1 - mix) * this.osc3Out + mix * n) * this.modWheel;

    const pitchMod = p.oscMod ? mod * OSC_MOD_SEMITONES : 0;
    const base = this.pitch + p.tune * 0.5 + this.bend * PITCH_BEND_SEMITONES + pitchMod;
    const nyq = sr * 0.45;

    this.osc[0].frequency = Math.min(this.oscFrequency(0, base, p.osc1Range, 0, true), nyq);
    this.osc[1].frequency = Math.min(this.oscFrequency(1, base, p.osc2Range, p.osc2Freq, true), nyq);
    this.osc[2].frequency = Math.min(this.oscFrequency(2, base, p.osc3Range, p.osc3Freq, !!p.osc3Control), nyq);

    const o1 = this.osc[0].process();
    const o2 = this.osc[1].process();
    const o3 = this.osc[2].process();
    this.osc3Out = o3;

    let sum = 0;
    if (p.osc1On) sum += o1 * p.osc1Vol * 0.07;
    if (p.osc2On) sum += o2 * p.osc2Vol * 0.07;
    if (p.osc3On) sum += o3 * p.osc3Vol * 0.07;
    if (p.extOn) sum += this.lastOut * p.extVol * 0.3;
    if (p.noiseOn) sum += n * p.noiseVol * 0.04;
    const mixed = Math.tanh(sum);
    this.overload += (Math.abs(sum) - this.overload) * 0.002;

    const track = (p.kbd1 ? 1 / 3 : 0) + (p.kbd2 ? 2 / 3 : 0);
    const octaves = p.cutoff * 0.9
      + track * (this.pitch - 60) / 12
      + (p.contourAmt / 10) * CONTOUR_OCTAVES * fEnv
      + (p.filterMod ? mod * FILTER_MOD_OCTAVES : 0);
    this.filter.setCutoff(1000 * Math.pow(2, octaves));
    const filtered = this.filter.process(mixed);

    let out = filtered * aEnv * (p.mainOn ? p.mainVol / 10 : 0);
    this.lastOut = out;

    if (p.a440) {
      this.a440Phase += 440 / sr;
      if (this.a440Phase >= 1) this.a440Phase -= 1;
      out += 0.15 * Math.sin(TWO_PI * this.a440Phase);
    }
    if (!p.power) out = 0;
    return out > 1 ? 1 : out < -1 ? -1 : out;
  }

  process(out) {
    for (let i = 0; i < out.length; i++) out[i] = this.tick();
  }
}
