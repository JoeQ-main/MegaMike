// MegaMike "contour": attack, decay, sustain. Release equals the decay time
// when the DECAY switch is on, otherwise it is a quick 10 ms. Triggering
// always starts the attack from the current level, like the analog circuit.

export const IDLE = 0, ATTACK = 1, DECAY = 2, SUSTAIN = 3, RELEASE = 4;

const ATTACK_TARGET = 1.25; // overshoot target makes the attack near-linear

export class Envelope {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.level = 0;
    this.stage = IDLE;
    this.sustain = 0.5;
    this.releaseEnabled = false;
    this.setAttack(0.001);
    this.setDecay(0.5);
    this.quickRelease = this.decayCoef(0.01);
  }

  decayCoef(seconds) {
    const tau = Math.max(seconds, 0.0005) / 3;
    return 1 - Math.exp(-1 / (tau * this.sampleRate));
  }

  setAttack(seconds) {
    const n = Math.max(seconds * this.sampleRate, 1);
    this.attackCoef = 1 - Math.pow(1 - 1 / ATTACK_TARGET, 1 / n);
  }

  setDecay(seconds) {
    this.decaySeconds = seconds;
    this.decayCoefValue = this.decayCoef(seconds);
  }

  setSustain(v) {
    this.sustain = Math.min(Math.max(v, 0), 1);
  }

  trigger() {
    this.stage = ATTACK;
  }

  release() {
    if (this.stage !== IDLE) this.stage = RELEASE;
  }

  process() {
    switch (this.stage) {
      case ATTACK:
        this.level += (ATTACK_TARGET - this.level) * this.attackCoef;
        if (this.level >= 1) {
          this.level = 1;
          this.stage = DECAY;
        }
        break;
      case DECAY:
        this.level += (this.sustain - this.level) * this.decayCoefValue;
        if (Math.abs(this.level - this.sustain) < 0.0005) {
          this.level = this.sustain;
          this.stage = SUSTAIN;
        }
        break;
      case SUSTAIN:
        this.level = this.sustain;
        break;
      case RELEASE: {
        const c = this.releaseEnabled ? this.decayCoefValue : this.quickRelease;
        this.level -= this.level * c;
        if (this.level < 1e-4) {
          this.level = 0;
          this.stage = IDLE;
        }
        break;
      }
      default:
        break;
    }
    return this.level;
  }
}
