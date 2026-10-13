// Four-pole transistor ladder low-pass filter, after Huovilainen's model with
// tanh stage saturation, run at 2x oversampling. Resonance above about 1.0
// makes it self-oscillate like the original.

export class LadderFilter {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.stage = [0, 0, 0, 0];
    this.stageTanh = [0, 0, 0];
    this.delay = [0, 0, 0, 0, 0, 0];
    this.resonance = 0;
    this.acr = 1;
    this.tune = 0;
    this.resQuad = 0;
    this.setCutoff(1000);
  }

  setCutoff(hz) {
    const max = this.sampleRate * 0.45;
    if (hz > max) hz = max;
    if (hz < 10) hz = 10;
    this.cutoff = hz;
    const fc = hz / this.sampleRate;
    const f = fc * 0.5; // the ladder runs at twice the sample rate
    const fcr = 1.8730 * fc * fc * fc + 0.4955 * fc * fc - 0.6490 * fc + 0.9988;
    this.acr = -3.9364 * fc * fc + 1.8409 * fc + 0.9968;
    this.tune = 1 - Math.exp(-2 * Math.PI * f * fcr);
    this.resQuad = 4 * this.resonance * this.acr;
  }

  setResonance(r) {
    this.resonance = r < 0 ? 0 : r;
    this.resQuad = 4 * this.resonance * this.acr;
  }

  reset() {
    this.stage.fill(0);
    this.stageTanh.fill(0);
    this.delay.fill(0);
  }

  step(x) {
    const d = this.delay, s = this.stage, st = this.stageTanh, tune = this.tune;
    let input = x - this.resQuad * d[5];
    s[0] = d[0] + tune * (Math.tanh(input) - st[0]);
    d[0] = s[0];
    for (let k = 1; k < 4; k++) {
      input = s[k - 1];
      st[k - 1] = Math.tanh(input);
      s[k] = d[k] + tune * (st[k - 1] - (k !== 3 ? st[k] : Math.tanh(d[k])));
      d[k] = s[k];
    }
    d[5] = (s[3] + d[4]) * 0.5;
    d[4] = s[3];
    return d[5];
  }

  process(x) {
    this.step(x);
    return this.step(x);
  }
}
