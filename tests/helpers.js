// Tiny signal-analysis helpers for the DSP tests.

export function rms(samples, from = 0, to = samples.length) {
  let acc = 0;
  for (let i = from; i < to; i++) acc += samples[i] * samples[i];
  return Math.sqrt(acc / (to - from));
}

/** Magnitude of one frequency bin (amplitude of a sinusoid at hz). */
export function magnitudeAt(samples, hz, sampleRate) {
  let re = 0, im = 0;
  const w = (2 * Math.PI * hz) / sampleRate;
  for (let i = 0; i < samples.length; i++) {
    re += samples[i] * Math.cos(w * i);
    im -= samples[i] * Math.sin(w * i);
  }
  return (2 * Math.hypot(re, im)) / samples.length;
}

export function render(fn, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn();
  return out;
}
