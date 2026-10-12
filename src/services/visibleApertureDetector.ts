/**
 * Visible-RGB dark-aperture heuristic only.
 * It cannot measure infrared wavelengths or identify a camera.
 */

export interface ApertureCue {
  x: number;
  y: number;
  radius: number;
  type: 'PINHOLE_APERTURE';
  signalStrength: number;
  label: string;
}

export class VisibleApertureDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private cueSensitivity: number = 2.0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  public setCueSensitivity(sensitivity: number) {
    this.cueSensitivity = Math.max(1.0, Math.min(5.0, sensitivity));
  }

  public getCueSensitivity(): number {
    return this.cueSensitivity;
  }

  public analyzeFrame(video: HTMLVideoElement): ApertureCue[] {
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
    const targets: ApertureCue[] = [];
    // Fast grid scan
    for (let y = 6; y < h - 6; y += 4) {
      for (let x = 6; x < w - 6; x += 4) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Detect a dark spot with a brighter local rim. This pattern is not camera-specific.
        if (targets.length < 8) {
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
            const contrast = rimAvg - centerLum;
            if (contrast > 70 - this.cueSensitivity * 8) {
              targets.push({
                x: Math.round(x / scale),
                y: Math.round(y / scale),
                radius: 9,
                type: 'PINHOLE_APERTURE',
                signalStrength: Math.min(1, contrast / 200),
                label: 'DARK APERTURE-LIKE FEATURE — NOT IDENTIFIED',
              });
            }
          }
        }

        if (targets.length >= 8) break;
      }
      if (targets.length >= 8) break;
    }

    // Cluster close detections
    const clustered: ApertureCue[] = [];
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
