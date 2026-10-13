import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Noise } from '../src/dsp/noise.js';
import { rms, render, magnitudeAt } from './helpers.js';

test('white noise is zero-mean and roughly uniform', () => {
  const n = new Noise(1234);
  const buf = render(() => n.process(), 100000);
  let mean = 0;
  for (const s of buf) mean += s;
  mean /= buf.length;
  assert.ok(Math.abs(mean) < 0.02);
  assert.ok(Math.abs(rms(buf) - 0.577) < 0.03);
});

test('pink noise is bounded and has more low than high energy', () => {
  const n = new Noise(99);
  n.pink = true;
  const buf = render(() => n.process(), 200000);
  for (const s of buf) assert.ok(Math.abs(s) < 1.5);
  let lo = 0, hi = 0;
  for (let k = 1; k <= 5; k++) {
    lo += magnitudeAt(buf, 50 * k, 48000);
    hi += magnitudeAt(buf, 10000 + 50 * k, 48000);
  }
  assert.ok(lo > hi * 2, `lo ${lo} hi ${hi}`);
});

test('same seed gives the same sequence', () => {
  const a = new Noise(7), b = new Noise(7);
  for (let i = 0; i < 100; i++) assert.equal(a.process(), b.process());
});
