// AudioWorklet processor: owns one Voice and applies messages from the page.
// Messages carrying a `time` (seconds on the audio clock) are queued and
// applied at the matching sample inside the render block, so the sequencer
// is sample-accurate.

import { Voice } from './dsp/voice.js';

class MegaMikeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voice = new Voice(sampleRate);
    this.frames = 0;
    this.queue = [];
    this.port.onmessage = (e) => this.handle(e.data);
  }

  handle(m) {
    if (typeof m.time === 'number') {
      let i = this.queue.length;
      while (i > 0 && this.queue[i - 1].time > m.time) i--;
      this.queue.splice(i, 0, m);
      return;
    }
    if (m.type === 'clearQueue') { this.queue.length = 0; return; }
    this.apply(m);
  }

  apply(m) {
    const v = this.voice;
    switch (m.type) {
      case 'param': v.setParam(m.id, m.value); break;
      case 'patch': v.setPatch(m.patch); break;
      case 'noteOn': v.noteOn(m.note); break;
      case 'noteOff': v.noteOff(m.note); break;
      case 'allOff': v.allNotesOff(); break;
      case 'bend': v.setBend(m.value); break;
      case 'mod': v.setModWheel(m.value); break;
      default: break;
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || !out.length) return true;
    const ch0 = out[0];
    const n = ch0.length;
    const blockStart = currentTime;
    const blockEnd = blockStart + n / sampleRate;
    let offset = 0;
    while (this.queue.length && this.queue[0].time < blockEnd) {
      const ev = this.queue.shift();
      let at = Math.round((ev.time - blockStart) * sampleRate);
      if (at < offset) at = offset;
      if (at > n) at = n;
      if (at > offset) {
        this.voice.process(ch0.subarray(offset, at));
        offset = at;
      }
      this.apply(ev);
    }
    if (offset < n) this.voice.process(ch0.subarray(offset));
    for (let c = 1; c < out.length; c++) out[c].set(ch0);
    this.frames += n;
    if (this.frames >= 2048) {
      this.frames = 0;
      this.port.postMessage({ type: 'meter', overload: this.voice.overload, gate: this.voice.gateOn });
    }
    return true;
  }
}

registerProcessor('megamike', MegaMikeProcessor);
