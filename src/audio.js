// Procedural train sound: exhaust beats tied to the drivers, rail joints,
// rolling rumble, steam hiss, a chime whistle and show-hall ambience.
// Nothing is a recording, so every sound follows the simulation.

export class TrainAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.proximity = 1; // 0..1, from camera distance
    this.inCab = false;
  }

  async start() {
    if (!this.ctx) this.build();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.enabled = true;
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.2);
  }

  stop() {
    if (!this.ctx) return;
    this.enabled = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    // Shared noise buffers.
    const len = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;
      b[i] = last * 3.5;
    }

    // Train bus (scaled by proximity) and ambience bus.
    this.trainBus = ctx.createGain();
    this.trainBus.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.5;
    this.ambBus.connect(this.master);

    // Rolling rumble.
    this.rumble = this.loop(this.brown, 'lowpass', 180, 0.7);
    this.rumble.gain.connect(this.trainBus);
    // Steam hiss (blower / cylinder cocks).
    this.hiss = this.loop(this.white, 'bandpass', 4200, 0.8);
    this.hiss.gain.connect(this.trainBus);
    // Hall murmur: low band noise with a slow swell.
    this.hall = this.loop(this.brown, 'bandpass', 420, 0.6);
    this.hall.gain.gain.value = 0.18;
    this.hall.gain.connect(this.ambBus);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(this.hall.gain.gain);
    lfo.start();
  }

  loop(buffer, type, freq, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = Math.random();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g);
    src.start(0, Math.random());
    return { src, filter: f, gain: g };
  }

  burst({ freq, q = 1, type = 'bandpass', attack = 0.004, decay = 0.12, level = 0.5, buffer, dest }) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer || this.white;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(dest || this.trainBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  }

  // Called by the train on each exhaust beat.
  chuff({ accent, throttle, speed }) {
    if (!this.enabled) return;
    const work = 0.25 + throttle * 0.75;
    const rate = Math.min(1, speed / 0.3);
    const decay = 0.16 - rate * 0.1;
    const level = (accent ? 0.75 : 0.5) * work;
    this.burst({ freq: 650 + Math.random() * 250, q: 0.9, decay, level });
    this.burst({ freq: 170, q: 0.7, type: 'lowpass', decay: decay * 0.8, level: level * 0.8, buffer: this.brown });
  }

  joint() {
    if (!this.enabled) return;
    const ctx = this.ctx;
    this.burst({ freq: 2600, q: 2.5, decay: 0.03, level: 0.22 });
    // A short metallic ring.
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 1900 + Math.random() * 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(this.trainBus);
    o.start(t);
    o.stop(t + 0.08);
  }

  whistle(on) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (on && !this.whistleNodes) {
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.18, t + 0.12);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      out.connect(lp).connect(this.trainBus);
      // A three-chime steam whistle chord with a pitch rise on opening.
      const oscs = [349, 440, 523].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 0.94, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
        const og = ctx.createGain();
        og.gain.value = 0.25;
        o.connect(og).connect(out);
        o.start(t);
        return o;
      });
      const breath = this.loop(this.white, 'bandpass', 1600, 1.5);
      breath.gain.gain.value = 0.25;
      breath.gain.connect(out);
      this.whistleNodes = { out, oscs, breath };
    } else if (!on && this.whistleNodes) {
      const { out, oscs, breath } = this.whistleNodes;
      out.gain.setTargetAtTime(0.0001, t, 0.06);
      oscs.forEach((o) => {
        o.frequency.exponentialRampToValueAtTime(o.frequency.value * 0.96, t + 0.3);
        o.stop(t + 0.4);
      });
      breath.src.stop(t + 0.4);
      this.whistleNodes = null;
    }
  }

  // Continuous layers, updated every frame.
  update({ speed, throttle, proximity, inCab }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const rate = Math.min(1, speed / 0.3);
    this.trainBus.gain.setTargetAtTime(proximity, t, 0.15);
    this.rumble.gain.gain.setTargetAtTime(rate * 0.55, t, 0.2);
    this.rumble.filter.frequency.setTargetAtTime(120 + rate * 160, t, 0.2);
    const cocks = throttle > 0.05 && speed < 0.05 ? 0.25 : 0;
    this.hiss.gain.gain.setTargetAtTime(0.025 + cocks, t, 0.1);
    this.ambBus.gain.setTargetAtTime(inCab ? 0.12 : 0.5, t, 0.4);
  }
}
