// 声音：全部用 Web Audio 实时合成，不依赖音频文件。
//   环境音：风、鸟鸣、黄昏乌鸦、夏蝉、秋虫、游客低语
//   配乐：D 宫五声音阶（D E F♯ A B）的古筝拨弦与箫
//   脚步：石板 / 踩雪
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = { music: true, ambience: true };
    this.state = { hour: 10, season: 'autumn', snow: 0, night: 0, crowd: 0, height: 2, interior: false };
    this.nextNote = 0; this.nextBird = 0; this.nextCrow = 0; this.nextBug = 0;
    this.phrase = []; this.speaking = false;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this._impulse(3.2, 2.6);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain).connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master); this.musicBus.connect(this.reverb);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.8; this.ambBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.7; this.sfxBus.connect(this.master);
    this.noise = this._noiseBuffer(4);
    // 风
    const wind = ctx.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 420; this.windF.Q.value = 0.6;
    this.windG = ctx.createGain(); this.windG.gain.value = 0.05;
    wind.connect(this.windF).connect(this.windG).connect(this.ambBus); wind.start();
    // 人声低语
    const crowd = ctx.createBufferSource(); crowd.buffer = this.noise; crowd.loop = true; crowd.playbackRate.value = 0.7;
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 650; cf.Q.value = 1.4;
    const cf2 = ctx.createBiquadFilter(); cf2.type = 'peaking'; cf2.frequency.value = 1300; cf2.gain.value = 6;
    this.crowdG = ctx.createGain(); this.crowdG.gain.value = 0;
    this.crowdLfo = ctx.createOscillator(); this.crowdLfo.frequency.value = 0.35;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.004;
    this.crowdLfo.connect(lfoG).connect(this.crowdG.gain); this.crowdLfo.start();
    crowd.connect(cf).connect(cf2).connect(this.crowdG).connect(this.ambBus); crowd.start();
    this.t0 = ctx.currentTime;
    this.nextNote = ctx.currentTime + 1.2;
  }

  _noiseBuffer(sec) {
    const ctx = this.ctx, n = ctx.sampleRate * sec;
    const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
    return b;
  }
  _impulse(sec, decay) {
    const ctx = this.ctx, n = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }

  setMusic(on) { this.enabled.music = on; if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.4); }
  setAmbience(on) { this.enabled.ambience = on; if (this.ambBus) this.ambBus.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.4); }
  setMuted(m) { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.2); }

  /** 每帧更新环境参数并调度声音事件 */
  update(s) {
    Object.assign(this.state, s);
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const st = this.state;
    const day = 1 - st.night;
    // 风：高处更强，下雪时更轻柔
    const wind = (0.035 + Math.min(0.09, st.height / 900) + (st.snow ? 0.01 : 0)) * (st.interior ? 0.35 : 1);
    this.windG.gain.setTargetAtTime(wind, now, 1.5);
    this.windF.frequency.setTargetAtTime(380 + 140 * Math.sin(now * 0.13) + st.height * 0.4, now, 2);
    // 游客
    const crowd = Math.min(1, st.crowd / 12) * day * 0.022 * (st.interior ? 0.6 : 1);
    this.crowdG.gain.setTargetAtTime(crowd, now, 1.2);
    // 鸟鸣（白天，清晨最多；冬季少）
    if (now > this.nextBird) {
      const morning = Math.exp(-((st.hour - 7) ** 2) / 6);
      const rate = day * (0.25 + morning) * (st.season === 'winter' ? 0.3 : 1) * (st.snow ? 0.4 : 1) * (st.interior ? 0.3 : 1);
      if (rate > 0.05 && Math.random() < rate) this._bird(now);
      this.nextBird = now + 1.5 + Math.random() * 5;
    }
    // 乌鸦：黄昏时分成群归巢——紫禁城冬日傍晚的标志性声音
    if (now > this.nextCrow) {
      const dusk = Math.exp(-((st.hour - 17.3) ** 2) / 1.2) + (st.season === 'winter' ? 0.25 : 0) * day;
      if (Math.random() < dusk * 0.9) this._crow(now);
      this.nextCrow = now + 3 + Math.random() * 7;
    }
    // 虫鸣：夏日蝉、秋夜蟋蟀
    if (now > this.nextBug) {
      if (st.season === 'summer' && day > 0.5 && !st.snow) this._cicada(now);
      else if ((st.season === 'autumn' || st.season === 'summer') && st.night > 0.5 && !st.snow) this._cricket(now);
      this.nextBug = now + 2 + Math.random() * 4;
    }
    if (this.enabled.music) this._music(now);
  }

  _env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  _bird(t) {
    const ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 5);
    const base = 2600 + Math.random() * 2200;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(this.ambBus); }
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const tt = t + i * (0.09 + Math.random() * 0.08);
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), tt);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), tt + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.8, tt + 0.09);
      this._env(g, tt, 0.008, 0.035, 0.09);
      o.connect(g).connect(pan || this.ambBus);
      o.start(tt); o.stop(tt + 0.15);
    }
  }

  _crow(t) {
    const ctx = this.ctx;
    const n = 1 + Math.floor(Math.random() * 3);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 1.4 - 0.7; pan.connect(this.ambBus); }
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.42;
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, tt); o.frequency.linearRampToValueAtTime(380, tt + 0.3);
      f.type = 'bandpass'; f.frequency.value = 1150; f.Q.value = 3;
      const src = ctx.createBufferSource(); src.buffer = this.noise; const ng = ctx.createGain(); ng.gain.value = 0.4;
      src.connect(ng).connect(f);
      this._env(g, tt, 0.02, 0.05, 0.3);
      o.connect(f).connect(g).connect(pan || this.ambBus);
      o.start(tt); o.stop(tt + 0.36); src.start(tt, Math.random()); src.stop(tt + 0.36);
    }
  }

  _cicada(t) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 6;
    const g = ctx.createGain(); g.gain.value = 0;
    const am = ctx.createOscillator(); am.frequency.value = 38; const amg = ctx.createGain(); amg.gain.value = 0.012;
    am.connect(amg).connect(g.gain);
    g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.014, t + 0.8); g.gain.linearRampToValueAtTime(0.0, t + 3.2);
    src.connect(f).connect(g).connect(this.ambBus);
    src.start(t, Math.random()); src.stop(t + 3.3); am.start(t); am.stop(t + 3.3);
  }

  _cricket(t) {
    const ctx = this.ctx;
    for (let k = 0; k < 3; k++) {
      const tt = t + k * 0.32;
      for (let i = 0; i < 4; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 4400; o.type = 'sine';
        this._env(g, tt + i * 0.035, 0.004, 0.012, 0.025);
        o.connect(g).connect(this.ambBus); o.start(tt + i * 0.035); o.stop(tt + i * 0.035 + 0.04);
      }
    }
  }

  /** 古筝拨弦：多个谐波 + 指数衰减 + 偶尔的按音上滑 */
  _zheng(t, freq, vel = 1, bend = 0) {
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1100, t + 1.6);
    const parts = [[1, 1], [2, 0.5], [3, 0.28], [4, 0.14], [5.02, 0.07]];
    for (const [h, a] of parts) {
      const o = ctx.createOscillator(); o.type = h === 1 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(freq * h, t);
      if (bend) { o.frequency.setValueAtTime(freq * h, t + 0.25); o.frequency.exponentialRampToValueAtTime(freq * h * Math.pow(2, bend / 12), t + 0.45); }
      const g = ctx.createGain(); g.gain.value = a;
      o.connect(g).connect(lp);
      o.start(t); o.stop(t + 3.2);
    }
    lp.connect(out).connect(this.musicBus);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.004);
    out.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
  }

  /** 箫：正弦 + 气声 + 颤音 */
  _xiao(t, freq, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = freq * 0.006;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.35); g.gain.setValueAtTime(0.05, t + dur - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const n = ctx.createBufferSource(); n.buffer = this.noise; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = freq * 2; nf.Q.value = 2; const ng = ctx.createGain(); ng.gain.value = 0.25;
    n.connect(nf).connect(ng).connect(g);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.1); vib.start(t); vib.stop(t + dur + 0.1); n.start(t, Math.random()); n.stop(t + dur + 0.1);
  }

  _music(now) {
    if (now < this.nextNote - 0.15) return;
    const st = this.state;
    // D 宫五声音阶：宫 D、商 E、角 F♯、徵 A、羽 B
    const scale = [146.83, 164.81, 185.0, 220.0, 246.94];
    const note = (i) => scale[((i % 5) + 5) % 5] * Math.pow(2, Math.floor(i / 5));
    const slow = st.night > 0.5 ? 1.35 : 1;
    if (!this.phrase.length) {
      // 新乐句：随机游走 + 回到宫音或徵音落句
      const len = 5 + Math.floor(Math.random() * 6);
      let p = 5 + Math.floor(Math.random() * 5);
      const durs = [0.5, 0.5, 0.75, 1, 1, 1.5];
      for (let i = 0; i < len; i++) {
        p += [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
        p = Math.max(3, Math.min(13, p));
        this.phrase.push({ p, d: durs[Math.floor(Math.random() * durs.length)] * slow, bend: Math.random() < 0.15 ? 2 : 0 });
      }
      const end = Math.random() < 0.5 ? 5 : 8;
      this.phrase.push({ p: end, d: 2.4 * slow, bend: 0, last: true });
      if (Math.random() < 0.35) this._xiao(now + 0.2, note(end + 5) , len * 0.8 * slow);
    }
    const n = this.phrase.shift();
    const t = Math.max(now, this.nextNote);
    const vel = (this.speaking ? 0.35 : 1) * (0.7 + Math.random() * 0.3);
    this._zheng(t, note(n.p), vel, n.bend);
    if (n.last) this._zheng(t + 0.02, note(n.p - 5), vel * 0.6);
    // 摇指（快速重复）点缀
    if (!n.last && Math.random() < 0.08) for (let k = 1; k < 6; k++) this._zheng(t + k * 0.08, note(n.p), vel * 0.4);
    this.nextNote = t + n.d + (n.last ? 1.8 + Math.random() * 2.5 : 0);
  }

  step(run, snow) {
    const ctx = this.ctx; if (!ctx || !this.enabled.ambience) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (snow) { f.type = 'highpass'; f.frequency.value = 1800; this._env(g, t, 0.01, 0.12, 0.16); }
    else { f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 300; f.Q.value = 1.2; this._env(g, t, 0.004, run ? 0.22 : 0.16, 0.07); }
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 3); src.stop(t + 0.3);
  }

  /** 中文语音解说 */
  say(text, onend) {
    if (!('speechSynthesis' in window)) { onend && setTimeout(onend, text.length * 220); return false; }
    const ss = window.speechSynthesis;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 1.0; u.pitch = 1.0;
    const voices = ss.getVoices();
    const v = voices.find((x) => /zh[-_]CN/i.test(x.lang)) || voices.find((x) => /^zh/i.test(x.lang));
    if (v) u.voice = v;
    let done = false;
    const fin = () => { if (done) return; done = true; this.speaking = false; onend && onend(); };
    u.onend = fin; u.onerror = fin;
    this.speaking = true;
    ss.speak(u);
    // 某些浏览器没有中文语音时不会触发 onend：按字数兜底
    setTimeout(() => { if (!done && !ss.speaking) fin(); }, 1500);
    setTimeout(fin, text.length * 300 + 4000);
    return true;
  }
  stopSay() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); this.speaking = false; }
}
