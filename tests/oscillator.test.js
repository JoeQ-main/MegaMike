import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Oscillator, polyBlep } from '../src/dsp/oscillator.js';
import { magnitudeAt, render } from './helpers.js';

const SR = 48000;

test('polyBlep is zero away from discontinuities', () => {
  assert.equal(polyBlep(0.5, 0.01), 0);
  assert.notEqual(polyBlep(0.001, 0.01), 0);
  assert.notEqual(polyBlep(0.999, 0.01), 0);
});

test('sawtooth has the right harmonic amplitudes', () => {
  const osc = new Oscillator(SR);
  osc.frequency = 1000;
  osc.waveform = 2;
  const buf = render(() => osc.process(), 4800);
  // Ideal saw of amplitude 1: harmonic k has amplitude 2/(pi k).
  assert.ok(Math.abs(magnitudeAt(buf, 1000, SR) - 2 / Math.PI) < 0.04);
  assert.ok(Math.abs(magnitudeAt(buf, 2000, SR) - 1 / Math.PI) < 0.04);
  assert.ok(magnitudeAt(buf, 1500, SR) < 0.02, 'no energy between harmonics');
});

test('square has no even harmonics, narrow pulse does', () => {
  const sq = new Oscillator(SR);
  sq.frequency = 1000; sq.waveform = 3;
  const sqBuf = render(() => sq.process(), 4800);
  assert.ok(magnitudeAt(sqBuf, 2000, SR) < 0.02);
  assert.ok(Math.abs(magnitudeAt(sqBuf, 1000, SR) - 4 / Math.PI) < 0.05);

  const pulse = new Oscillator(SR);
  pulse.frequency = 1000; pulse.waveform = 5;
  const pBuf = render(() => pulse.process(), 4800);
  assert.ok(magnitudeAt(pBuf, 2000, SR) > 0.3);
});

test('all waveforms stay within a sane amplitude range', () => {
  for (let w = 0; w < 6; w++) {
    const osc = new Oscillator(SR);
    osc.frequency = 220; osc.waveform = w;
    const buf = render(() => osc.process(), 20000);
    let max = 0;
    for (const s of buf) max = Math.max(max, Math.abs(s));
    assert.ok(max <= 1.2 && max > 0.8, `waveform ${w} peak ${max}`);
  }
});

test('frequency follows the setting', () => {
  const osc = new Oscillator(SR);
  osc.frequency = 100; osc.waveform = 0;
  const buf = render(() => osc.process(), 48000);
  assert.ok(magnitudeAt(buf, 100, SR) > 0.7);
  assert.ok(magnitudeAt(buf, 110, SR) < 0.05);
});
