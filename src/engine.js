// Web Audio plumbing: creates the context on the first user gesture, loads the
// worklet and forwards parameters and notes to it.

export class Engine {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.ready = false;
    this.pending = [];
    this.patch = {};
    this.onMeter = null;
    this.onStateChange = null;
  }

  async start() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.ctx = ctx;
    await ctx.audioWorklet.addModule(new URL('./worklet.js', import.meta.url));
    const node = new AudioWorkletNode(ctx, 'megamike', { outputChannelCount: [2] });
    node.port.onmessage = (e) => {
      if (e.data.type === 'meter' && this.onMeter) this.onMeter(e.data);
    };
    node.connect(ctx.destination);
    this.node = node;
    this.ready = true;
    this.send({ type: 'patch', patch: this.patch });
    for (const m of this.pending) this.send(m);
    this.pending.length = 0;
    if (ctx.state !== 'running') await ctx.resume();
    ctx.onstatechange = () => this.onStateChange && this.onStateChange(ctx.state);
    if (this.onStateChange) this.onStateChange(ctx.state);
  }

  send(m) {
    if (this.ready) this.node.port.postMessage(m);
    else if (m.type !== 'param' && m.type !== 'patch') this.pending.push(m);
  }

  setParam(id, value) {
    this.patch[id] = value;
    this.send({ type: 'param', id, value });
  }

  setPatch(patch) {
    Object.assign(this.patch, patch);
    this.send({ type: 'patch', patch });
  }

  noteOn(note) { this.send({ type: 'noteOn', note }); }
  noteOff(note) { this.send({ type: 'noteOff', note }); }
  allNotesOff() { this.send({ type: 'allOff' }); }
  setBend(value) { this.send({ type: 'bend', value }); }
  setModWheel(value) { this.send({ type: 'mod', value }); }
}
