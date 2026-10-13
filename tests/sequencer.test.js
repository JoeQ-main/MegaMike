import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sequencer, STEP_COUNT, noteName } from '../src/sequencer.js';

test('note names', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(61), 'C#4');
  assert.equal(noteName(47), 'B2');
});

test('produces nothing until started', () => {
  const s = new Sequencer();
  assert.deepEqual(s.advance(10), []);
});

test('steps are eighth notes at the tempo, with gate length', () => {
  const s = new Sequencer();
  s.tempo = 120; // step = 0.25 s
  s.gate = 0.5;
  s.steps.forEach((st, i) => { st.pitch = i; st.on = true; });
  s.start(1);
  const ev = s.advance(1.6); // steps at 1.0, 1.25, 1.5
  const ons = ev.filter((e) => e.type === 'noteOn');
  const offs = ev.filter((e) => e.type === 'noteOff');
  assert.deepEqual(ons.map((e) => e.time), [1, 1.25, 1.5]);
  assert.deepEqual(ons.map((e) => e.note), [48, 49, 50]);
  assert.deepEqual(offs.map((e) => e.time), [1.125, 1.375, 1.625]);
  assert.deepEqual(ev.filter((e) => e.type === 'step').map((e) => e.index), [0, 1, 2]);
  assert.deepEqual(s.advance(1.6), [], 'nothing new before the next step');
});

test('wraps around after the last step and skips steps that are off', () => {
  const s = new Sequencer();
  s.tempo = 240; // 0.125 s
  s.steps[1].on = false;
  s.start(0);
  const ev = s.advance(0.125 * (STEP_COUNT + 1) - 0.001);
  const ons = ev.filter((e) => e.type === 'noteOn');
  assert.equal(ons.length, STEP_COUNT); // 9 steps minus one rest
  assert.equal(ev.filter((e) => e.type === 'step').length, STEP_COUNT + 1);
  assert.equal(ev.filter((e) => e.type === 'step').at(-1).index, 0);
});

test('root transposes the sequence', () => {
  const s = new Sequencer();
  s.steps[0].pitch = 7;
  s.setRoot(60);
  s.start(0);
  assert.equal(s.advance(0.01).find((e) => e.type === 'noteOn').note, 67);
});

test('stop silences a sounding note', () => {
  const s = new Sequencer();
  s.start(0);
  s.advance(0.01);
  const ev = s.stop(0.02);
  assert.deepEqual(ev, [{ time: 0.02, type: 'noteOff', note: 48 }]);
  assert.deepEqual(s.advance(5), []);
  assert.deepEqual(s.stop(1), [], 'nothing left to silence');
});

test('round-trips through JSON and clamps bad data', () => {
  const s = new Sequencer();
  s.tempo = 99; s.gate = 0.3; s.steps[2].pitch = 5; s.steps[3].on = false;
  const t = new Sequencer();
  t.load(JSON.parse(JSON.stringify(s)));
  assert.equal(t.tempo, 99);
  assert.equal(t.gate, 0.3);
  assert.equal(t.steps[2].pitch, 5);
  assert.equal(t.steps[3].on, false);
  t.load({ tempo: 9999, gate: -1, steps: [{ pitch: 99, on: 1 }] });
  assert.equal(t.tempo, 240);
  assert.equal(t.gate, 0.05);
  assert.equal(t.steps[0].pitch, 24);
  t.load(null);
  t.load('junk');
});
