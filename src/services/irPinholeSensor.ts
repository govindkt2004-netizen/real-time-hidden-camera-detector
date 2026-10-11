/**
 * Infrared (IR) & Micro-Aperture Pinhole Sensor Engine
 * Analyzes video stream for:
 * 1. Night-vision 850nm/940nm infrared spy camera LED emissions (magenta/violet high-intensity peaks in low light)
 * 2. Concealed micro-aperture pinhole optical cavities (circular deep-shadow cavities inside screws/housings)
 * Supports adjustable sensor gain (1x to 5x) for low-end mobile hardware.
 */

export interface IRSensorTarget {
  x: number;
  y: number;
  radius: number;
  type: 'IR_EMITTER' | 'PINHOLE_APERTURE';
  confidence: number;
  label: string;
}

export class IRPinholeSensor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private gain: number = 2.0; // Sensor amplification

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  public setSensorGain(gain: number) {
    this.gain = Math.max(1.0, Math.min(5.0, gain));
  }

  public getSensorGain(): number {
    return this.gain;
  }

  public analyzeFrame(
    video: HTMLVideoElement,
    detectIR: boolean = true,
    detectPinhole: boolean = true
  ): IRSensorTarget[] {
    if (!this.ctx || !video.videoWidth || !video.videoHeight) {
      return [];
    }

    const scale = 0.4;
    const w = Math.floor(video.videoWidth * scale);
    const h = Math.floor(video.videoHeight * scale);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    this.ctx.drawImage(video, 0, 0, w, h);
    let imgData: ImageData;
    try {
      imgData = this.ctx.getImageData(0, 0, w, h);
    } catch {
      return [];
    }

    const data = imgData.data;
    const targets: IRSensorTarget[] = [];
    const thresholdIR = Math.max(180, 230 - this.gain * 15);

    // Fast grid scan
    for (let y = 6; y < h - 6; y += 4) {
      for (let x = 6; x < w - 6; x += 4) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 1. Detect Infrared (IR) Night-Vision LED Emissions
        // IR light on CMOS sensors renders with high Red & Blue, lower Green, and extreme local brightness
        if (detectIR) {
          const isMagentaWhite = r > thresholdIR && b > thresholdIR && (r + b) > g * 2.2;
          if (isMagentaWhite) {
            // Check local isolation (IR LED is a concentrated pinpoint source)
            const edgeIdx = ((y - 4) * w + (x - 4)) * 4;
            const edgeLum = (data[edgeIdx] + data[edgeIdx + 1] + data[edgeIdx + 2]) / 3;
            const centerLum = (r + g + b) / 3;

            if (centerLum - edgeLum > 55 - this.gain * 6) {
              const conf = Math.min(0.96, 0.65 + ((centerLum - edgeLum) / 180) * (this.gain / 2));
              targets.push({
                x: Math.round(x / scale),
                y: Math.round(y / scale),
                radius: 10,
                type: 'IR_EMITTER',
                confidence: conf,
                label: 'IR NIGHT-VISION EMITTER',
              });
            }
          }
        }

        // 2. Detect Concealed Pinhole Aperture (Micro dark cavity surrounded by rim)
        if (detectPinhole && targets.length < 5) {
          const centerLum = (r + g + b) / 3;
          if (centerLum < 45) {
            // Very dark pit
            const rightIdx = (y * w + (x + 3)) * 4;
            const leftIdx = (y * w + (x - 3)) * 4;
            const topIdx = ((y - 3) * w + x) * 4;
            const bottomIdx = ((y + 3) * w + x) * 4;

            const rimAvg = (
              (data[rightIdx] + data[leftIdx] + data[topIdx] + data[bottomIdx]) / 4 +
              (data[rightIdx + 1] + data[leftIdx + 1] + data[topIdx + 1] + data[bottomIdx + 1]) / 4 +
              (data[rightIdx + 2] + data[leftIdx + 2] + data[topIdx + 2] + data[bottomIdx + 2]) / 4
            ) / 3;

            // Sharp dark center against bright/reflective rim indicates optical cavity
            if (rimAvg - centerLum > 70 - this.gain * 8) {
              targets.push({
                x: Math.round(x / scale),
                y: Math.round(y / scale),
                radius: 9,
                type: 'PINHOLE_APERTURE',
                confidence: Math.min(0.92, 0.58 + ((rimAvg - centerLum) / 200)),
                label: 'CONCEALED PINHOLE APERTURE',
              });
            }
          }
        }

        if (targets.length >= 8) break;
      }
      if (targets.length >= 8) break;
    }

    // Cluster close detections
    const clustered: IRSensorTarget[] = [];
    for (const t of targets) {
      const exists = clustered.some((c) => {
        const dx = c.x - t.x;
        const dy = c.y - t.y;
        return Math.sqrt(dx * dx + dy * dy) < 30;
      });
      if (!exists) {
        clustered.push(t);
      }
    }

    return clustered;
  }
}
