/**
 * Optical Retroreflection & Lens Glint Analyzer
 * Simulates physical TSCM (Technical Surveillance Counter-Measures) optical sweepers.
 * Detects pinpoint specular reflections produced when camera flash or ambient lighting
 * bounces off curved glass camera lenses and anti-reflective dielectric coatings.
 */

export interface LensGlint {
  x: number;
  y: number;
  radius: number;
  intensity: number; // 0 to 1
  confidence: number;
}

export class GlintDetector {
  private sampleCanvas: HTMLCanvasElement;
  private sampleCtx: CanvasRenderingContext2D | null;

  constructor() {
    this.sampleCanvas = document.createElement('canvas');
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Analyze the video frame for intense pinpoint specular retroreflections
   */
  public analyzeFrame(
    video: HTMLVideoElement,
    threshold: number = 240, // 0 - 255 luminance
    maxGlints: number = 5,
    isTorchActive: boolean = false
  ): LensGlint[] {
    if (!this.sampleCtx || !video.videoWidth || !video.videoHeight) {
      return [];
    }

    // When torch is active, retroreflection glints are sharper and higher contrast
    const effectiveThreshold = isTorchActive ? Math.max(225, threshold - 12) : threshold;

    // Downscale for real-time 60fps performance
    const scale = 0.5;
    const w = Math.floor(video.videoWidth * scale);
    const h = Math.floor(video.videoHeight * scale);

    if (this.sampleCanvas.width !== w || this.sampleCanvas.height !== h) {
      this.sampleCanvas.width = w;
      this.sampleCanvas.height = h;
    }

    this.sampleCtx.drawImage(video, 0, 0, w, h);
    let imgData: ImageData;
    try {
      imgData = this.sampleCtx.getImageData(0, 0, w, h);
    } catch {
      return [];
    }

    const data = imgData.data;
    const candidates: { x: number; y: number; val: number }[] = [];

    // Scan pixel brightness
    for (let y = 4; y < h - 4; y += 3) {
      for (let x = 4; x < w - 4; x += 3) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Standard luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum > effectiveThreshold) {
          // Check local contrast with immediate ring (pinhole optical glint has sharp drop-off)
          const ringIdx = ((y - 3) * w + (x - 3)) * 4;
          const ringLum = 0.299 * data[ringIdx] + 0.587 * data[ringIdx + 1] + 0.114 * data[ringIdx + 2];
          const contrast = lum - ringLum;

          if (contrast > (isTorchActive ? 38 : 45)) {
            candidates.push({ x: x / scale, y: y / scale, val: contrast });
          }
        }
      }
    }

    // Cluster close peaks
    const glints: LensGlint[] = [];
    const minDistance = 25;

    for (const c of candidates) {
      const isDuplicate = glints.some(g => {
        const dx = g.x - c.x;
        const dy = g.y - c.y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });

      if (!isDuplicate) {
        const baseConfidence = Math.min(0.95, 0.5 + (c.val / 200));
        glints.push({
          x: Math.round(c.x),
          y: Math.round(c.y),
          radius: 8,
          intensity: Math.min(1, c.val / 120),
          confidence: isTorchActive ? Math.min(0.98, baseConfidence + 0.08) : baseConfidence,
        });
      }

      if (glints.length >= maxGlints) break;
    }

    return glints;
  }
}
