// PolyBLEP oscillator with the six MegaMike waveforms.
// Waveform indices: 0 triangle, 1 triangle/saw ("shark tooth"), 2 sawtooth,
// 3 square, 4 wide rectangle, 5 narrow rectangle.

export function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

export function triangle(t) {
  return t < 0.5 ? -1 + 4 * t : 3 - 4 * t;
}

export function saw(t, dt) {
  return 2 * t - 1 - polyBlep(t, dt);
}

export function pulse(t, dt, width) {
  let y = t < width ? 1 : -1;
  y += polyBlep(t, dt);
  let t2 = t - width;
  if (t2 < 0) t2 += 1;
  y -= polyBlep(t2, dt);
  return y;
}

export class Oscillator {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.phase = 0;
    this.frequency = 440;
    this.waveform = 2;
  }

  reset() {
    this.phase = 0;
  }

  process() {
    let dt = this.frequency / this.sampleRate;
    if (dt > 0.45) dt = 0.45;
    if (dt < 0) dt = 0;
    const t = this.phase;
    let y;
    switch (this.waveform) {
      case 0: y = triangle(t); break;
      case 1: y = 0.5 * triangle(t) + 0.5 * saw(t, dt); break;
      case 3: y = pulse(t, dt, 0.5); break;
      case 4: y = pulse(t, dt, 0.3); break;
      case 5: y = pulse(t, dt, 0.1); break;
      default: y = saw(t, dt);
    }
    let p = t + dt;
    if (p >= 1) p -= 1;
    this.phase = p;
    return y;
  }
}
