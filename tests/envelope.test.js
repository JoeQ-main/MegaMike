import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Envelope, ATTACK, DECAY, SUSTAIN, RELEASE, IDLE } from '../src/dsp/envelope.js';

const SR = 1000;

function run(env, n) {
  let v = 0;
  for (let i = 0; i < n; i++) v = env.process();
  return v;
}

test('attack reaches full level in the attack time', () => {
  const env = new Envelope(SR);
  env.setAttack(0.1);
  env.trigger();
  assert.equal(env.stage, ATTACK);
  const mid = run(env, 50);
  assert.ok(mid > 0.3 && mid < 0.9, `mid ${mid}`);
  const end = run(env, 52);
  assert.ok(end >= 0.99, `end ${end}`);
  assert.ok(env.stage === DECAY || env.stage === SUSTAIN);
});

test('decays to the sustain level and holds', () => {
  const env = new Envelope(SR);
  env.setAttack(0.001);
  env.setDecay(0.1);
  env.setSustain(0.4);
  env.trigger();
  run(env, 2000);
  assert.equal(env.stage, SUSTAIN);
  assert.ok(Math.abs(env.level - 0.4) < 0.01);
});

test('release is quick without DECAY switch and slow with it', () => {
  const quick = new Envelope(SR);
  quick.setDecay(1);
  quick.setSustain(1);
  quick.trigger();
  run(quick, 100);
  quick.release();
  assert.equal(quick.stage, RELEASE);
  run(quick, 30);
  assert.ok(quick.level < 0.05, `quick ${quick.level}`);

  const slow = new Envelope(SR);
  slow.setDecay(1);
  slow.setSustain(1);
  slow.releaseEnabled = true;
  slow.trigger();
  run(slow, 100);
  slow.release();
  run(slow, 30);
  assert.ok(slow.level > 0.8, `slow ${slow.level}`);
  run(slow, 5000);
  assert.equal(slow.stage, IDLE);
  assert.equal(slow.level, 0);
});

test('retrigger starts from the current level, not zero', () => {
  const env = new Envelope(SR);
  env.setAttack(0.5);
  env.setSustain(1);
  env.trigger();
  run(env, 200);
  const before = env.level;
  env.trigger();
  assert.ok(env.process() >= before);
});
