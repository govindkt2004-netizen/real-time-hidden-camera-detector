/**
 * Audio Alarm Synthesizer using Web Audio API
 * Provides instant, zero-latency emergency alarm sounds without external assets.
 */

class SoundAlarmManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isAlarmPlaying: boolean = false;
  private alarmOscillator: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private alarmInterval: number | null = null;

  public init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch((error: unknown) => {
        console.warn('Audio playback is blocked until the browser allows audio.', error);
      });
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isAlarmPlaying) {
      this.stopAlarm();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Play a single tactical beep (e.g. scanning pulse or click)
   */
  public playScanTick() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (error: unknown) {
      console.warn('Unable to play scan tick.', error);
    }
  }

  /**
   * Play a sharp danger alert pulse for detected cameras
   */
  public playDangerPulse() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(960, now);
      osc1.frequency.linearRampToValueAtTime(1440, now + 0.12);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(980, now);
      osc2.frequency.linearRampToValueAtTime(1470, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.23);
      osc2.stop(now + 0.23);
    } catch (error: unknown) {
      console.warn('Unable to play danger alert.', error);
    }
  }

  /**
   * Play continuous pulsed danger siren when a camera is in sight
   */
  public triggerAlarmSequence() {
    if (this.isMuted || this.isAlarmPlaying) return;
    this.init();
    if (!this.ctx) return;
    this.isAlarmPlaying = true;
    this.playDangerPulse();

    // Pulse every 350ms
    this.alarmInterval = window.setInterval(() => {
      this.playDangerPulse();
    }, 350);
  }

  public stopAlarm() {
    this.isAlarmPlaying = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    if (this.alarmOscillator) {
      try {
        this.alarmOscillator.stop();
      } catch {}
      this.alarmOscillator = null;
    }
  }
}

export const soundAlarm = new SoundAlarmManager();
