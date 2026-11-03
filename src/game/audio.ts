/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class BeeAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Flight drone
  private flightOsc1: OscillatorNode | null = null;
  private flightOsc2: OscillatorNode | null = null;
  private flightFilter: BiquadFilterNode | null = null;
  private flightGain: GainNode | null = null;

  // Hive ambient hum
  private hiveOsc1: OscillatorNode | null = null;
  private hiveOsc2: OscillatorNode | null = null;
  private hiveFilter: BiquadFilterNode | null = null;
  private hiveGain: GainNode | null = null;

  // Rain sound generator
  private rainNoiseNode: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  // Grass blade rustle generator
  private grassNoiseNode: AudioBufferSourceNode | null = null;
  private grassFilter: BiquadFilterNode | null = null;
  private grassGain: GainNode | null = null;

  private isInitialized: boolean = false;

  public init() {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupFlightSynth();
      this.setupHiveSynth();
      this.setupRainSynth();
      this.setupGrassSynth();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API could not initialize:', e);
    }
  }

  public ensureRunning() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupFlightSynth() {
    if (!this.ctx || !this.masterGain) return;

    this.flightOsc1 = this.ctx.createOscillator();
    this.flightOsc2 = this.ctx.createOscillator();
    this.flightFilter = this.ctx.createBiquadFilter();
    this.flightGain = this.ctx.createGain();

    this.flightOsc1.type = 'sawtooth';
    this.flightOsc2.type = 'triangle';

    // Base bee flight frequency (~210 Hz, detuned)
    this.flightOsc1.frequency.setValueAtTime(215, this.ctx.currentTime);
    this.flightOsc2.frequency.setValueAtTime(212, this.ctx.currentTime);

    this.flightFilter.type = 'lowpass';
    this.flightFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.flightFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.flightGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.flightOsc1.connect(this.flightFilter);
    this.flightOsc2.connect(this.flightFilter);
    this.flightFilter.connect(this.flightGain);
    this.flightGain.connect(this.masterGain);

    this.flightOsc1.start();
    this.flightOsc2.start();
  }

  private setupHiveSynth() {
    if (!this.ctx || !this.masterGain) return;

    this.hiveOsc1 = this.ctx.createOscillator();
    this.hiveOsc2 = this.ctx.createOscillator();
    this.hiveFilter = this.ctx.createBiquadFilter();
    this.hiveGain = this.ctx.createGain();

    this.hiveOsc1.type = 'sawtooth';
    this.hiveOsc2.type = 'sawtooth';

    // Deep hive swarm drone (~140 Hz)
    this.hiveOsc1.frequency.setValueAtTime(138, this.ctx.currentTime);
    this.hiveOsc2.frequency.setValueAtTime(142, this.ctx.currentTime);

    this.hiveFilter.type = 'bandpass';
    this.hiveFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
    this.hiveFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.hiveGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    this.hiveOsc1.connect(this.hiveFilter);
    this.hiveOsc2.connect(this.hiveFilter);
    this.hiveFilter.connect(this.hiveGain);
    this.hiveGain.connect(this.masterGain);

    this.hiveOsc1.start();
    this.hiveOsc2.start();
  }

  private setupRainSynth() {
    if (!this.ctx || !this.masterGain) return;

    // Procedural pink-ish rain noise
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.1378875;
      b2 = 0.57000 * b2 + white * 0.4428055;
      data[i] = (b0 + b1 + b2) * 0.06;
    }

    this.rainNoiseNode = this.ctx.createBufferSource();
    this.rainNoiseNode.buffer = buffer;
    this.rainNoiseNode.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    rainFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.rainNoiseNode.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    this.rainNoiseNode.start();
  }

  private setupGrassSynth() {
    if (!this.ctx || !this.masterGain) return;

    // Organic soft hiss / whisper for grass stalks brushing against insect carapace
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.12;
    }

    this.grassNoiseNode = this.ctx.createBufferSource();
    this.grassNoiseNode.buffer = buffer;
    this.grassNoiseNode.loop = true;

    this.grassFilter = this.ctx.createBiquadFilter();
    this.grassFilter.type = 'bandpass';
    this.grassFilter.frequency.setValueAtTime(2600, this.ctx.currentTime);
    this.grassFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.grassGain = this.ctx.createGain();
    this.grassGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.grassNoiseNode.connect(this.grassFilter);
    this.grassFilter.connect(this.grassGain);
    this.grassGain.connect(this.masterGain);

    this.grassNoiseNode.start();
  }

  public updateGrassRustle(speed: number, inGrass: boolean) {
    if (!this.ctx || !this.grassGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    if (!inGrass || speed < 0.5) {
      this.grassGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Rustling intensity scales with speed through the blades
    const targetGain = Math.min(0.02 + speed * 0.012, 0.14);
    this.grassGain.gain.setTargetAtTime(targetGain, now, 0.06);
  }

  public updateFlight(speed: number, isFlying: boolean, role: string) {
    if (!this.ctx || !this.flightGain || !this.flightOsc1 || !this.flightOsc2 || this.isMuted) return;

    const now = this.ctx.currentTime;
    if (!isFlying) {
      this.flightGain.gain.setTargetAtTime(0.01, now, 0.1);
      return;
    }

    // Queen is heavier (~180 Hz), Guard (~230 Hz), Forager (~250 Hz)
    const baseFreq = role === 'queen' ? 180 : role === 'guard' ? 230 : 250;
    const targetFreq = baseFreq + Math.min(speed * 3.5, 75);

    this.flightOsc1.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.flightOsc2.frequency.setTargetAtTime(targetFreq * 0.985, now, 0.08);

    const targetGain = Math.min(0.08 + speed * 0.005, 0.22);
    this.flightGain.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  public updateHiveAmbience(distanceToHive: number, populationCount: number) {
    if (!this.ctx || !this.hiveGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    // Closer to hive = louder resonant hum
    const proximity = Math.max(0, 1 - distanceToHive / 60);
    const popScale = Math.min(populationCount / 20, 1.5);
    const targetGain = (0.01 + proximity * 0.15) * popScale;

    this.hiveGain.gain.setTargetAtTime(targetGain, now, 0.2);
  }

  public updateWeatherAudio(weather: string) {
    if (!this.ctx || !this.rainGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    if (weather === 'rain') {
      this.rainGain.gain.setTargetAtTime(0.18, now, 0.5);
    } else {
      this.rainGain.gain.setTargetAtTime(0, now, 0.5);
    }
  }

  public playNectarSip() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playStingAttack() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playCombBuild() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playEggLay() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playRaindropImpact() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260 + Math.random() * 80, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playChitinThud(strength: number = 1.0) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.ensureRunning();

    const now = this.ctx.currentTime;
    const clampedStrength = Math.min(Math.max(strength, 0.2), 2.0);

    // Deep woody/chitin tap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    gain.gain.setValueAtTime(0.22 * clampedStrength, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const audioEngine = new BeeAudioEngine();
