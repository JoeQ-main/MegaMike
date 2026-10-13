import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LadderFilter } from '../src/dsp/filter.js';
import { magnitudeAt, render, rms } from './helpers.js';

const SR = 48000;

function sineThrough(filter, hz, n = 24000, amp = 0.3) {
  let i = 0;
  return render(() => filter.process(amp * Math.sin((2 * Math.PI * hz * i++) / SR)), n);
}

test('passes low frequencies and attenuates high ones', () => {
  const f = new LadderFilter(SR);
  f.setCutoff(1000);
  const low = sineThrough(f, 100);
  const lowGain = magnitudeAt(low.subarray(12000), 100, SR) / 0.3;
  assert.ok(lowGain > 0.85 && lowGain < 1.1, `low gain ${lowGain}`);

  f.reset();
  const high = sineThrough(f, 8000);
  const highGain = magnitudeAt(high.subarray(12000), 8000, SR) / 0.3;
  assert.ok(highGain < 0.01, `high gain ${highGain}`); // > 40 dB down
});

test('cutoff moves the corner', () => {
  const f = new LadderFilter(SR);
  f.setCutoff(200);
  const buf = sineThrough(f, 2000);
  const g = magnitudeAt(buf.subarray(12000), 2000, SR) / 0.3;
  assert.ok(g < 0.001, `gain ${g}`);
});

test('self-oscillates at high resonance, near the cutoff frequency', () => {
  const f = new LadderFilter(SR);
  f.setCutoff(1000);
  f.setResonance(1.1);
  f.process(0.5); // kick
  render(() => f.process(0), 96000); // let it build up
  const tail = render(() => f.process(0), 24000);
  assert.ok(rms(tail) > 0.05, `tail rms ${rms(tail)}`);
  let best = 0, bestHz = 0;
  for (let hz = 800; hz <= 1200; hz += 1) {
    const m = magnitudeAt(tail, hz, SR);
    if (m > best) { best = m; bestHz = hz; }
  }
  assert.ok(Math.abs(bestHz - 1000) < 50, `oscillates at ${bestHz}`);
  assert.ok(best > 0.05, `peak ${best}`);
});

test('does not blow up on loud input', () => {
  const f = new LadderFilter(SR);
  f.setCutoff(5000);
  f.setResonance(1.2);
  const buf = sineThrough(f, 300, 48000, 5);
  for (const s of buf) assert.ok(Number.isFinite(s) && Math.abs(s) < 4);
});
