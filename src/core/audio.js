function midiFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

class EngineVoice {
  constructor(ctx, dest) {
    this.ctx = ctx;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 600;
    this.filter.Q.value = 1.1;
    this.oscA = ctx.createOscillator();
    this.oscA.type = "sawtooth";
    this.oscB = ctx.createOscillator();
    this.oscB.type = "square";
    this.detune = ctx.createOscillator();
    this.detune.frequency.value = 11;
    this.detuneGain = ctx.createGain();
    this.detuneGain.gain.value = 6;
    this.detune.connect(this.detuneGain);
    this.detuneGain.connect(this.oscB.detune);
    this.oscA.frequency.value = 50;
    this.oscB.frequency.value = 50;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.oscA.connect(shaper);
    this.oscB.connect(shaper);
    shaper.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(dest);
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = "bandpass";
    this.noiseFilter.frequency.value = 2400;
    this.noiseFilter.Q.value = 0.6;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noiseSrc = null;
    this.oscA.start();
    this.oscB.start();
    this.detune.start();
    this._noiseBuf = null;
  }
  attachNoise(buffer) {
    if (this.noiseSrc) return;
    this.noiseSrc = this.ctx.createBufferSource();
    this.noiseSrc.buffer = buffer;
    this.noiseSrc.loop = true;
    this.noiseSrc.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.gain);
    this.noiseSrc.start();
  }
  set(rpm, load, boost, dt) {
    const t = this.ctx.currentTime;
    const f = 42 + rpm * 195 + boost * 40;
    this.oscA.frequency.setTargetAtTime(f, t, 0.03);
    this.oscB.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.filter.frequency.setTargetAtTime(280 + rpm * 3600 + boost * 2600, t, 0.05);
    const vol = 0.05 + load * 0.12 + rpm * 0.08 + boost * 0.06;
    this.gain.gain.setTargetAtTime(vol, t, 0.06);
    this.noiseGain.gain.setTargetAtTime(boost * 0.35, t, 0.05);
  }
  dispose() {
    try {
      this.oscA.stop();
      this.oscB.stop();
      this.detune.stop();
      if (this.noiseSrc) this.noiseSrc.stop();
    } catch (e) { /* ignore */ }
  }
}

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.engines = [];
    this.musicTimer = null;
    this.intensity = 0;
    this._targetIntensity = 0;
    this._step = 0;
    this._nextTime = 0;
    this.bpm = 126;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) {
      return false;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.applyVolumes();
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (let i = 0; i < 2; i++) {
      const e = new EngineVoice(c, this.sfxBus);
      e.attachNoise(this.noiseBuf);
      this.engines.push(e);
    }
    this.skidFilter = c.createBiquadFilter();
    this.skidFilter.type = "bandpass";
    this.skidFilter.frequency.value = 850;
    this.skidFilter.Q.value = 1.4;
    this.skidGain = c.createGain();
    this.skidGain.gain.value = 0;
    this.skidSrc = c.createBufferSource();
    this.skidSrc.buffer = this.noiseBuf;
    this.skidSrc.loop = true;
    this.skidSrc.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.sfxBus);
    this.skidSrc.start();
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 500;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    this.windSrc = c.createBufferSource();
    this.windSrc.buffer = this.noiseBuf;
    this.windSrc.loop = true;
    this.windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.sfxBus);
    this.windSrc.start();
    return true;
  }
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : this.settings.master;
    this.musicBus.gain.value = this.settings.music * 0.5;
    this.sfxBus.gain.value = this.settings.sfx;
  }
  toggleMute() {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }
  setSkid(amount) {
    if (!this.ctx) return;
    this.skidGain.gain.setTargetAtTime(Math.min(0.25, amount * 0.25), this.ctx.currentTime, 0.05);
  }
  stopDrivingAudio() {
    if (!this.ctx) return;
    this.updateEngines([null, null]);
    this.setSkid(0);
    this.setWind(0);
  }
  setWind(speed01) {
    if (!this.ctx) return;
    this.windGain.gain.setTargetAtTime(speed01 * 0.14, this.ctx.currentTime, 0.1);
    this.windFilter.frequency.setTargetAtTime(300 + speed01 * 900, this.ctx.currentTime, 0.1);
  }
  updateEngines(entries) {
    if (!this.ctx) return;
    for (let i = 0; i < this.engines.length; i++) {
      const e = this.engines[i];
      const d = entries[i];
      if (d) e.set(d.rpm, d.load, d.boost, 0.016);
      else e.set(0, 0, 0, 0.016);
    }
  }
  _blip(type, f0, f1, dur, vol, bus) {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    const g = c.createGain();
    o.frequency.setValueAtTime(f0, c.currentTime);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }
  _noiseHit(dur, vol, filterType, freq, q) {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start();
    src.stop(c.currentTime + dur + 0.02);
  }
  collision(intensity) {
    const v = Math.min(1, intensity);
    this._noiseHit(0.18 + v * 0.2, 0.3 * v + 0.1, "lowpass", 900 + v * 900, 0.8);
    this._blip("sine", 90 + v * 60, 38, 0.22, 0.5 * v + 0.15);
  }
  scrape() {
    this._noiseHit(0.08, 0.06, "highpass", 3000, 1);
  }
  nitroStart(level) {
    if (level >= 2) {
      this._blip("sine", 160, 32, 0.7, 0.7);
      this._noiseHit(0.8, 0.4, "lowpass", 1400, 0.7);
      this._blip("sawtooth", 220, 880, 0.45, 0.2);
    } else if (level === 1) {
      this._blip("square", 660, 990, 0.09, 0.22);
      this._blip("square", 990, 1320, 0.12, 0.2);
      this._noiseHit(0.5, 0.18, "bandpass", 2600, 1.2);
    } else {
      this._noiseHit(0.4, 0.16, "bandpass", 2000, 1);
      this._blip("sawtooth", 140, 420, 0.3, 0.14);
    }
  }
  nearMiss() {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2;
    f.frequency.setValueAtTime(500, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(3200, c.currentTime + 0.28);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.24, c.currentTime + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.32);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start();
    src.stop(c.currentTime + 0.36);
  }
  knockdown() {
    this.collision(1);
    this._blip("sawtooth", 320, 60, 0.4, 0.3);
  }
  checkpoint() {
    this._blip("sine", 880, 880, 0.09, 0.18);
    this._blip("sine", 1318, 1318, 0.16, 0.16);
  }
  countdown(final) {
    if (final) this._blip("square", 880, 880, 0.5, 0.3);
    else this._blip("square", 440, 440, 0.16, 0.26);
  }
  pickup() {
    this._blip("triangle", 700, 1200, 0.12, 0.22);
  }
  uiClick() {
    this._blip("square", 340, 300, 0.05, 0.12);
  }
  buy() {
    const seq = [523, 659, 784, 1046];
    seq.forEach((f, i) => setTimeout(() => this._blip("triangle", f, f, 0.14, 0.2), i * 90));
  }
  finish(win) {
    const seq = win ? [523, 659, 784, 1046, 1318] : [392, 330, 262];
    seq.forEach((f, i) => setTimeout(() => this._blip(win ? "square" : "sawtooth", f, f, 0.22, 0.2), i * 130));
  }
  eliminated() {
    this._blip("sine", 200, 40, 0.8, 0.5);
    this._noiseHit(0.7, 0.35, "lowpass", 800, 0.7);
  }
  thunder() {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(400, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(80, c.currentTime + 1.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.4, c.currentTime + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.8);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start();
    src.stop(c.currentTime + 1.9);
  }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this._nextTime = this.ctx.currentTime + 0.1;
    this._step = 0;
    this.musicTimer = setInterval(() => this._schedule(), 25);
  }
  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
  setIntensity(x) {
    this._targetIntensity = x;
  }
  _schedule() {
    if (!this.ctx) return;
    this.intensity += (this._targetIntensity - this.intensity) * 0.04;
    const stepDur = 60 / this.bpm / 4;
    while (this._nextTime < this.ctx.currentTime + 0.18) {
      this._playStep(this._step % 64, this._nextTime);
      this._nextTime += stepDur;
      this._step++;
    }
  }
  _mnote(type, midi, t, dur, vol, dest) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = midiFreq(midi);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  _mdrum(kind, t, vol) {
    const c = this.ctx;
    if (kind === "kick") {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.2);
    } else {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = kind === "hat" ? "highpass" : "bandpass";
      f.frequency.value = kind === "hat" ? 7500 : 1900;
      const g = c.createGain();
      const dur = kind === "hat" ? 0.035 : 0.13;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      src.start(t);
      src.stop(t + dur + 0.02);
    }
  }
  _playStep(step, t) {
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const roots = [45, 41, 48, 43];
    const root = roots[bar];
    if (s16 % 4 === 0) this._mdrum("kick", t, 0.5);
    if (s16 === 4 || s16 === 12) this._mdrum("snare", t, 0.24 + this.intensity * 0.1);
    if (this.intensity > 0.15 && s16 % 2 === 0) this._mdrum("hat", t, 0.07 + this.intensity * 0.06);
    const bassPat = [0, null, 0, null, 0, 12, null, 0, 0, null, 0, null, 7, null, 12, null];
    const bn = bassPat[s16];
    if (bn !== null && bn !== undefined) this._mnote("sawtooth", root + bn - 12, t, 0.14, 0.16, this.musicBus);
    if (this.intensity > 0.35) {
      const scale = [0, 3, 5, 7, 10, 12];
      if (s16 % 2 === 0) {
        const idx = (step * 7 + bar * 3) % scale.length;
        const oct = this.intensity > 0.7 && s16 % 8 === 0 ? 12 : 0;
        this._mnote("square", root + 24 + scale[idx] + oct, t, 0.09, 0.05 + this.intensity * 0.05, this.musicBus);
      }
    }
    if (this.intensity > 0.85 && s16 % 8 === 6) this._mnote("square", root + 31, t, 0.07, 0.05, this.musicBus);
  }
}
