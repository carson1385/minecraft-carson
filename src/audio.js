// Web Audio API Procedural Sound Engine for Minecraft Web
// 100% generated sounds - zero external audio files, zero CORS or loading lag!

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.5;
    this.isMuted = false;
    this.lastStepTime = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Play White / Pink Noise Burst with Filter & Decay
  playNoise({ duration = 0.1, filterFreq = 1000, filterType = 'lowpass', gain = 0.2, attack = 0.005, pitchDecay = false }) {
    if (!this.enabled || this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
    if (pitchDecay) {
      filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + duration);
    }

    const gainNode = this.ctx.createGain();
    const finalGain = gain * this.volume;
    gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(finalGain, this.ctx.currentTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + duration);
  }

  // Play Tone Oscillator
  playTone({ freq = 440, type = 'sine', duration = 0.1, gain = 0.2, endFreq = null }) {
    if (!this.enabled || this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), this.ctx.currentTime + duration);
    }

    const finalGain = gain * this.volume;
    gainNode.gain.setValueAtTime(finalGain, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Footstep Sound based on Block Type
  playFootstep(blockId = 1) {
    const now = performance.now();
    if (now - this.lastStepTime < 280) return; // Prevent spamming
    this.lastStepTime = now;

    // Grass / Leaves / Plants
    if (blockId === 1 || blockId === 6 || blockId === 23) {
      this.playNoise({ duration: 0.08, filterFreq: 1200, filterType: 'bandpass', gain: 0.15 });
    }
    // Stone / Cobble / Ores / Bedrock
    else if (blockId === 3 || blockId === 4 || blockId === 8 || (blockId >= 12 && blockId <= 17) || blockId === 22) {
      this.playNoise({ duration: 0.06, filterFreq: 2400, filterType: 'highpass', gain: 0.18 });
      this.playTone({ freq: 120, type: 'triangle', duration: 0.04, gain: 0.15 });
    }
    // Wood / Planks / Bookshelf / Crafting Table
    else if (blockId === 5 || blockId === 7 || blockId === 18 || blockId === 20) {
      this.playTone({ freq: 140, endFreq: 80, type: 'square', duration: 0.07, gain: 0.12 });
      this.playNoise({ duration: 0.05, filterFreq: 800, gain: 0.1 });
    }
    // Sand
    else if (blockId === 9) {
      this.playNoise({ duration: 0.09, filterFreq: 900, filterType: 'lowpass', gain: 0.15 });
    }
    // Water
    else if (blockId === 11) {
      this.playTone({ freq: 350, endFreq: 150, type: 'sine', duration: 0.12, gain: 0.15 });
    }
    // Default Dirt
    else {
      this.playNoise({ duration: 0.07, filterFreq: 800, filterType: 'lowpass', gain: 0.16 });
    }
  }

  // Block Break Sound (Crisp crunch / crack)
  playBlockBreak(blockId = 1) {
    this.playNoise({ duration: 0.14, filterFreq: 1800, filterType: 'bandpass', gain: 0.35, pitchDecay: true });
    this.playTone({ freq: 180, endFreq: 60, type: 'sawtooth', duration: 0.1, gain: 0.2 });
  }

  // Block Place Sound (Solid thump)
  playBlockPlace(blockId = 1) {
    this.playTone({ freq: 220, endFreq: 90, type: 'triangle', duration: 0.08, gain: 0.28 });
    this.playNoise({ duration: 0.05, filterFreq: 1400, filterType: 'lowpass', gain: 0.2 });
  }

  // Jump Sound
  playJump() {
    this.playTone({ freq: 160, endFreq: 340, type: 'sine', duration: 0.14, gain: 0.18 });
  }

  // Landing Impact
  playLand() {
    this.playNoise({ duration: 0.1, filterFreq: 600, filterType: 'lowpass', gain: 0.3 });
    this.playTone({ freq: 110, endFreq: 50, type: 'triangle', duration: 0.08, gain: 0.25 });
  }

  // Pick Block / Hotbar Select Pop
  playPop() {
    this.playTone({ freq: 950, endFreq: 1400, type: 'sine', duration: 0.04, gain: 0.15 });
  }

  // TNT Hiss
  playTNTFuse() {
    this.playNoise({ duration: 2.4, filterFreq: 3200, filterType: 'highpass', gain: 0.22 });
  }

  // TNT Explosion
  playExplosion() {
    // Massive sub rumble
    this.playTone({ freq: 90, endFreq: 25, type: 'triangle', duration: 1.2, gain: 0.5 });
    // Blasting noise
    this.playNoise({ duration: 0.9, filterFreq: 800, filterType: 'lowpass', gain: 0.55, pitchDecay: true });
    // Crisp blast initial crack
    this.playNoise({ duration: 0.15, filterFreq: 4000, filterType: 'bandpass', gain: 0.4 });
  }

  // Splash in water
  playSplash() {
    this.playTone({ freq: 420, endFreq: 160, type: 'sine', duration: 0.25, gain: 0.3 });
    this.playNoise({ duration: 0.2, filterFreq: 1200, filterType: 'bandpass', gain: 0.25 });
  }

  // Classic Steve "OOF" Hurt Sound
  playHurt() {
    this.playTone({ freq: 280, endFreq: 110, type: 'sawtooth', duration: 0.16, gain: 0.4 });
    this.playNoise({ duration: 0.08, filterFreq: 1000, filterType: 'bandpass', gain: 0.25 });
  }
}

