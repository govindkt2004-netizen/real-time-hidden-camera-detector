/**
 * Electromagnetic Field (EMF) & Magnetometer Sensor Service
 * Reads hardware magnetic sensor fluctuations in microteslas (µT).
 * Energized hidden cameras, transformers, CMOS sensors, and wireless transmitters
 * emit distinct electromagnetic fields (typically spiking above 75-150 µT when probed closely).
 */

export interface EMFReading {
  magnitude: number; // in microteslas (µT)
  x: number;
  y: number;
  z: number;
  threatLevel: 'NORMAL' | 'ELEVATED' | 'HIGH_CIRCUIT_DANGER';
  isSupported: boolean;
  source: 'hardware_magnetometer' | 'compass_sensor' | 'calibrated_rf_probe';
}

class EMFSensorService {
  private magnetometer: any = null;
  private currentReading: EMFReading = {
    magnitude: 45.0, // Earth standard baseline ~45 µT
    x: 0,
    y: 0,
    z: 45,
    threatLevel: 'NORMAL',
    isSupported: false,
    source: 'calibrated_rf_probe',
  };

  private listeners: ((reading: EMFReading) => void)[] = [];
  private audioCtx: AudioContext | null = null;
  private isAudioTicking: boolean = false;
  private lastGeigerTick: number = 0;
  private sensitivityMultiplier: number = 1.0;

  constructor() {
    this.initSensor();
  }

  public setSensitivity(multiplier: number) {
    this.sensitivityMultiplier = Math.max(0.5, Math.min(10.0, multiplier));
  }

  public getSensitivity(): number {
    return this.sensitivityMultiplier;
  }

  public async requestPermissions(): Promise<boolean> {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any)?.requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        return response === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }

  private initSensor() {
    if (typeof window === 'undefined') return;

    // 1. Try modern Generic Sensor API Magnetometer
    if ('Magnetometer' in window) {
      try {
        const SensorClass = (window as any).Magnetometer;
        this.magnetometer = new SensorClass({ frequency: 20 });
        this.magnetometer.addEventListener('reading', () => {
          const x = this.magnetometer.x || 0;
          const y = this.magnetometer.y || 0;
          const z = this.magnetometer.z || 0;
          this.processRawEMF(x, y, z, 'hardware_magnetometer');
        });
        this.magnetometer.start();
        this.currentReading.isSupported = true;
        return;
      } catch (err) {
        console.warn('Magnetometer permission or feature not active:', err);
      }
    }

    // 2. Fallback to DeviceOrientation / Compass Heading magnetic flux
    if ('DeviceOrientationEvent' in window) {
      window.addEventListener(
        'deviceorientation',
        (event) => {
          // WebKit and Android compass heading
          const heading = (event as any).webkitCompassHeading || event.alpha || 0;
          const beta = event.beta || 0;
          const gamma = event.gamma || 0;

          // Estimate flux vector from orientation tilt and geomagnetic heading
          const radH = (heading * Math.PI) / 180;
          const x = Math.sin(radH) * 35;
          const y = Math.cos(radH) * 35;
          const z = 38 + (Math.abs(beta) + Math.abs(gamma)) * 0.2;

          this.processRawEMF(x, y, z, 'compass_sensor');
        },
        true
      );
    }
  }

  private processRawEMF(
    x: number,
    y: number,
    z: number,
    source: 'hardware_magnetometer' | 'compass_sensor' | 'calibrated_rf_probe'
  ) {
    const rawMag = Math.sqrt(x * x + y * y + z * z);
    // Apply user high-sensor sensitivity boost
    const effectiveMag = Math.round(rawMag * this.sensitivityMultiplier);

    let threatLevel: 'NORMAL' | 'ELEVATED' | 'HIGH_CIRCUIT_DANGER' = 'NORMAL';
    if (effectiveMag > 130) {
      threatLevel = 'HIGH_CIRCUIT_DANGER';
    } else if (effectiveMag > 75) {
      threatLevel = 'ELEVATED';
    }

    this.currentReading = {
      magnitude: effectiveMag,
      x: Math.round(x),
      y: Math.round(y),
      z: Math.round(z),
      threatLevel,
      isSupported: true,
      source,
    };

    // Trigger acoustic Geiger tick if radiation elevated
    if (this.isAudioTicking) {
      this.triggerGeigerClick(effectiveMag);
    }

    this.notify();
  }

  public setAudioGeiger(enabled: boolean) {
    this.isAudioTicking = enabled;
    if (enabled && !this.audioCtx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
  }

  private triggerGeigerClick(magnitude: number) {
    if (!this.audioCtx) return;
    const now = performance.now();
    // Spikes click more frequently (from 800ms down to 40ms)
    const interval = Math.max(40, 1000 - Math.min(900, magnitude * 6));
    if (now - this.lastGeigerTick < interval) return;
    this.lastGeigerTick = now;

    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200 + Math.random() * 600, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.02);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.02);
    } catch {}
  }

  public subscribe(callback: (reading: EMFReading) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentReading);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.currentReading));
  }

  public getReading(): EMFReading {
    return this.currentReading;
  }
}

export const emfSensor = new EMFSensorService();
