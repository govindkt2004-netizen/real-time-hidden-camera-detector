import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface DetectionResult {
  bbox: [number, number, number, number];
  class: string;
  score: number;
  threatLevel: 'DANGER' | 'INFO';
  label: string;
  isCameraTarget: boolean;
  imageWidth: number;
  imageHeight: number;
  detectedAt: number;
  isIgnored?: boolean;
  ignoredReason?: string;
}

export type SensitivityLevel = 'high' | 'balanced' | 'strict';
export type ScanPerformance = 'fast' | 'detail';

const SUPPORTED_TARGET_LABELS: Record<string, string> = {
  'cell phone': 'PHONE — CAMERA-CAPABLE DEVICE',
  laptop: 'LAPTOP — CAMERA MAY BE PRESENT',
};
const TILE_SCALE = 0.6;

export class DetectorService {
  private model: cocoSsd.ObjectDetection | null = null;
  private loadPromise: Promise<void> | null = null;
  private loadError: string | null = null;
  private readonly tileCanvas = document.createElement('canvas');
  private readonly tileContext = this.tileCanvas.getContext('2d');

  public async init(): Promise<void> {
    if (this.model) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadError = null;
    this.loadPromise = (async () => {
      try {
        try {
          const webglAvailable = await tf.setBackend('webgl');
          if (!webglAvailable) {
            console.warn('TensorFlow.js WebGL backend unavailable; using the default backend.');
          }
        } catch (error: unknown) {
          console.warn('TensorFlow.js WebGL initialization failed; using the default backend.', error);
        }
        await tf.ready();
        this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load TensorFlow.js model';
        this.loadError = message;
        console.error('Detector initialization error:', error);
        throw new Error(message);
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  public isLoaded(): boolean {
    return this.model !== null;
  }

  public getLoadError(): string | null {
    return this.loadError;
  }

  public async detect(
    videoElement: HTMLVideoElement,
    sensitivity: SensitivityLevel = 'balanced',
    performance: ScanPerformance = 'fast'
  ): Promise<DetectionResult[]> {
    if (!this.model) {
      throw new Error('Detection model is not loaded yet');
    }
    if (videoElement.readyState < 2 || !videoElement.videoWidth || !videoElement.videoHeight) {
      return [];
    }

    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;
    const scoreThreshold = sensitivity === 'high' ? 0.38 : sensitivity === 'balanced' ? 0.48 : 0.62;
    const predictions: DetectionResult[] = [];

    const fullFrame = await this.model.detect(videoElement, 10, scoreThreshold);
    predictions.push(...this.toResults(fullFrame, 0, 0, width, height, width, height));

    if (performance === 'detail' && this.tileContext) {
      const tileWidth = Math.ceil(width * TILE_SCALE);
      const tileHeight = Math.ceil(height * TILE_SCALE);
      const regions = [
        [0, 0],
        [width - tileWidth, 0],
        [0, height - tileHeight],
        [width - tileWidth, height - tileHeight],
      ] as const;
      const resize = Math.min(1, 640 / Math.max(tileWidth, tileHeight));
      this.tileCanvas.width = Math.max(1, Math.round(tileWidth * resize));
      this.tileCanvas.height = Math.max(1, Math.round(tileHeight * resize));

      for (const [left, top] of regions) {
        this.tileContext.drawImage(
          videoElement,
          left,
          top,
          tileWidth,
          tileHeight,
          0,
          0,
          this.tileCanvas.width,
          this.tileCanvas.height
        );
        const tilePredictions = await this.model.detect(this.tileCanvas, 10, scoreThreshold);
        predictions.push(
          ...this.toResults(
            tilePredictions,
            left,
            top,
            tileWidth,
            tileHeight,
            this.tileCanvas.width,
            this.tileCanvas.height,
            width,
            height
          )
        );
      }
    }

    return this.removeDuplicates(predictions);
  }

  private toResults(
    predictions: cocoSsd.DetectedObject[],
    offsetX: number,
    offsetY: number,
    regionWidth: number,
    regionHeight: number,
    inferenceWidth: number,
    inferenceHeight: number,
    imageWidth = inferenceWidth,
    imageHeight = inferenceHeight
  ): DetectionResult[] {
    return predictions
      .flatMap((prediction) => {
        const label = SUPPORTED_TARGET_LABELS[prediction.class.toLowerCase()];
        if (!label) return [];
        const scaleX = regionWidth / inferenceWidth;
        const scaleY = regionHeight / inferenceHeight;
        const [x, y, boxWidth, boxHeight] = prediction.bbox;
        return [{
          bbox: [
            offsetX + x * scaleX,
            offsetY + y * scaleY,
            boxWidth * scaleX,
            boxHeight * scaleY,
          ] as [number, number, number, number],
          class: prediction.class,
          score: prediction.score,
          threatLevel: 'DANGER' as const,
          label,
          isCameraTarget: true,
          imageWidth,
          imageHeight,
          detectedAt: Date.now(),
        }];
      });
  }

  private removeDuplicates(detections: DetectionResult[]): DetectionResult[] {
    const sorted = detections.sort((a, b) => b.score - a.score);
    const kept: DetectionResult[] = [];

    for (const candidate of sorted) {
      const [x1, y1, w1, h1] = candidate.bbox;
      const overlaps = kept.some((accepted) => {
        const [x2, y2, w2, h2] = accepted.bbox;
        const intersectionWidth = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2));
        const intersectionHeight = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
        const intersection = intersectionWidth * intersectionHeight;
        const union = w1 * h1 + w2 * h2 - intersection;
        return union > 0 && intersection / union > 0.5;
      });
      if (!overlaps) kept.push(candidate);
    }

    return kept;
  }
}

export const detectorService = new DetectorService();
