import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Voice, midiToHz } from '../src/dsp/voice.js';
import { ATTACK, RELEASE, IDLE } from '../src/dsp/envelope.js';
import { magnitudeAt, render, rms } from './helpers.js';

const SR = 48000;

function silent(v, n = 4800) {
  return rms(render(() => v.tick(), n)) < 1e-4;
}

test('midi to Hz', () => {
  assert.equal(midiToHz(69), 440);
  assert.ok(Math.abs(midiToHz(60) - 261.63) < 0.01);
});

test('silent until a key is pressed, then sounds, then stops', () => {
  const v = new Voice(SR);
  assert.ok(silent(v));
  v.noteOn(60);
  const buf = render(() => v.tick(), 9600);
  assert.ok(rms(buf) > 0.05, 'sounding');
  v.noteOff(60);
  render(() => v.tick(), 9600);
  assert.ok(silent(v));
});

test('plays the pressed note at 8 foot range', () => {
  const v = new Voice(SR);
  v.setParam('cutoff', 5);
  v.setParam('contourAmt', 0);
  v.noteOn(69);
  render(() => v.tick(), 4800);
  const buf = render(() => v.tick(), 48000);
  assert.ok(magnitudeAt(buf, 440, SR) > 0.1);
  assert.ok(magnitudeAt(buf, 440, SR) > 10 * magnitudeAt(buf, 466, SR));
});

test('range switch transposes by octaves', () => {
  const v = new Voice(SR);
  v.setParam('cutoff', 5);
  v.setParam('contourAmt', 0);
  v.setParam('osc1Range', 4); // 4'
  v.noteOn(69);
  render(() => v.tick(), 4800);
  const buf = render(() => v.tick(), 48000);
  assert.ok(magnitudeAt(buf, 880, SR) > 5 * magnitudeAt(buf, 440, SR));
});

test('lowest-note priority with single trigger', () => {
  const v = new Voice(SR);
  v.noteOn(64);
  assert.equal(v.targetPitch, 64);
  assert.equal(v.ampEnv.stage, ATTACK);
  render(() => v.tick(), 48000);
  const stageBefore = v.ampEnv.stage;
  v.noteOn(60);
  assert.equal(v.targetPitch, 60, 'lower note takes over');
  assert.equal(v.ampEnv.stage, stageBefore, 'no retrigger on legato');
  v.noteOn(67);
  assert.equal(v.targetPitch, 60, 'higher note does not take over');
  v.noteOff(60);
  assert.equal(v.targetPitch, 64, 'falls back to lowest remaining');
  assert.notEqual(v.ampEnv.stage, RELEASE);
  v.noteOff(64);
  v.noteOff(67);
  assert.equal(v.ampEnv.stage, RELEASE);
});

test('glide slews pitch when enabled and jumps when not', () => {
  const v = new Voice(SR);
  v.setParam('glideOn', 1);
  v.setParam('glide', 5);
  v.noteOn(48);
  render(() => v.tick(), 48000);
  v.noteOff(48);
  v.noteOn(72);
  v.tick();
  assert.ok(v.pitch < 60, `pitch mid-glide ${v.pitch}`);
  render(() => v.tick(), 96000);
  assert.ok(Math.abs(v.pitch - 72) < 0.1);

  v.setParam('glideOn', 0);
  v.noteOff(72);
  v.noteOn(48);
  v.tick();
  assert.equal(v.pitch, 48);
});

test('mixer switches silence oscillators', () => {
  const v = new Voice(SR);
  v.setParam('osc1On', 0);
  v.noteOn(60);
  assert.ok(silent(v));
});

test('main output switch and power switch mute', () => {
  const v = new Voice(SR);
  v.noteOn(60);
  v.setParam('mainOn', 0);
  assert.ok(silent(v));
  v.setParam('mainOn', 1);
  v.setParam('power', 0);
  assert.ok(silent(v));
});

test('A-440 reference tone', () => {
  const v = new Voice(SR);
  v.setParam('a440', 1);
  const buf = render(() => v.tick(), 48000);
  assert.ok(Math.abs(magnitudeAt(buf, 440, SR) - 0.15) < 0.01);
});

test('decay switch keeps the sound ringing after release', () => {
  const v = new Voice(SR);
  v.setParam('decayOn', 1);
  v.setParam('lDecay', 8);
  v.noteOn(60);
  render(() => v.tick(), 4800);
  v.noteOff(60);
  render(() => v.tick(), 4800);
  assert.ok(!silent(v));
  assert.equal(v.ampEnv.stage, RELEASE);
});

test('setPatch applies every parameter', () => {
  const v = new Voice(SR);
  v.setPatch({ emphasis: 10, osc2Wave: 4, bogus: 1 });
  assert.equal(v.p.emphasis, 10);
  assert.equal(v.osc[1].waveform, 4);
  assert.ok(!('bogus' in v.p));
  assert.ok(v.filter.resonance > 1);
});

test('never produces NaN or out-of-range output under extreme settings', () => {
  const v = new Voice(SR);
  v.setPatch({ osc1On: 1, osc2On: 1, osc3On: 1, osc1Vol: 10, osc2Vol: 10, osc3Vol: 10,
    extOn: 1, extVol: 10, noiseOn: 1, noiseVol: 10, emphasis: 10, cutoff: 5, contourAmt: 10,
    oscMod: 1, filterMod: 1, mainVol: 10 });
  v.setModWheel(1);
  v.noteOn(30);
  const buf = render(() => v.tick(), 48000);
  for (const s of buf) assert.ok(Number.isFinite(s) && Math.abs(s) <= 1);
  v.noteOff(30);
  render(() => v.tick(), 480000);
  assert.equal(v.ampEnv.stage, IDLE);
});
