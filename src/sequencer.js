// Step sequencer logic. Pure and clock-agnostic: advance(until) returns the
// timed note events that fall before `until` (seconds on the audio clock).
// Each step is an eighth note at the current tempo.

export const STEP_COUNT = 8;
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(note) {
  return `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;
}

export class Sequencer {
  constructor() {
    this.steps = Array.from({ length: STEP_COUNT }, (_, i) => ({ pitch: [0, 3, 7, 10, 12, 10, 7, 3][i], on: true }));
    this.tempo = 120;
    this.gate = 0.5;
    this.root = 48; // C3
    this.running = false;
    this.position = 0;
    this.nextStepTime = 0;
    this.soundingNote = null;
  }

  get stepSeconds() {
    return 30 / Math.max(20, this.tempo);
  }

  start(now) {
    this.running = true;
    this.position = 0;
    this.nextStepTime = now;
  }

  /** Stops and returns the events needed to silence anything still sounding. */
  stop(now) {
    this.running = false;
    const events = [];
    if (this.soundingNote != null) {
      events.push({ time: now, type: 'noteOff', note: this.soundingNote });
      this.soundingNote = null;
    }
    return events;
  }

  setRoot(note) {
    this.root = note;
  }

  /** Produce every event scheduled before `until`. */
  advance(until) {
    const events = [];
    while (this.running && this.nextStepTime < until) {
      const t = this.nextStepTime;
      const step = this.steps[this.position];
      const dur = this.stepSeconds;
      events.push({ time: t, type: 'step', index: this.position });
      if (step.on) {
        const note = this.root + step.pitch;
        const gateEnd = t + dur * Math.min(1, Math.max(0.05, this.gate));
        events.push({ time: t, type: 'noteOn', note });
        events.push({ time: gateEnd, type: 'noteOff', note });
        this.soundingNote = note;
      }
      this.position = (this.position + 1) % STEP_COUNT;
      this.nextStepTime = t + dur;
    }
    return events;
  }

  toJSON() {
    return { steps: this.steps.map((s) => ({ pitch: s.pitch, on: s.on ? 1 : 0 })), tempo: this.tempo, gate: this.gate };
  }

  load(data) {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.steps)) {
      data.steps.slice(0, STEP_COUNT).forEach((s, i) => {
        if (!s) return;
        if (Number.isFinite(s.pitch)) this.steps[i].pitch = Math.max(0, Math.min(24, Math.round(s.pitch)));
        this.steps[i].on = !!s.on;
      });
    }
    if (Number.isFinite(data.tempo)) this.tempo = Math.max(40, Math.min(240, data.tempo));
    if (Number.isFinite(data.gate)) this.gate = Math.max(0.05, Math.min(1, data.gate));
  }
}
