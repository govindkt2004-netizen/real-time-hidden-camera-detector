import type { ProgressInfo, ZeroShotObjectDetectionOutput } from '@huggingface/transformers';
import type { DetectionResult, SensitivityLevel } from './detector';

const MODEL_ID = 'onnx-community/grounding-dino-tiny-ONNX';
const CAMERA_LABELS = ['a camera.'];
const MIN_BOX_EDGE_PIXELS = 16;
const MIN_BOX_AREA_RATIO = 0.00005;

type CameraPipeline = import('@huggingface/transformers').AllTasks['zero-shot-object-detection'];

export class VisibleCameraDetector {
  private model: CameraPipeline | null = null;
  private loadPromise: Promise<void> | null = null;
  private readonly canvas = document.createElement('canvas');
  private readonly context = this.canvas.getContext('2d');

  public isLoaded(): boolean {
    return this.model !== null;
  }

  public async load(onProgress: (progress: ProgressInfo) => void): Promise<void> {
    if (this.model) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const { pipeline } = await import('@huggingface/transformers');
        const supportsWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
        try {
          this.model = await pipeline('zero-shot-object-detection', MODEL_ID, {
            device: supportsWebGpu ? 'webgpu' : 'wasm',
            dtype: 'q4',
            progress_callback: onProgress,
          });
        } catch (error) {
          if (!supportsWebGpu) throw error;
          console.warn('Camera model WebGPU initialization failed; retrying with WASM.', error);
          this.model = await pipeline('zero-shot-object-detection', MODEL_ID, {
            device: 'wasm',
            dtype: 'q4',
            progress_callback: onProgress,
          });
        }
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  public async detect(
    image: HTMLVideoElement,
    sensitivity: SensitivityLevel
  ): Promise<DetectionResult[]> {
    if (!this.model) throw new Error('The visible camera model has not finished loading.');
    if (image.readyState < 2 || !image.videoWidth || !image.videoHeight) return [];
    if (!this.context) throw new Error('The browser could not create a canvas for camera-model inference.');

    const threshold = sensitivity === 'high' ? 0.2 : sensitivity === 'balanced' ? 0.3 : 0.4;
    this.canvas.width = image.videoWidth;
    this.canvas.height = image.videoHeight;
    this.context.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
    const output = await this.model([this.canvas], CAMERA_LABELS, { threshold, top_k: 20 });
    const results = (Array.isArray(output[0]) ? output[0] : output) as ZeroShotObjectDetectionOutput;
    const detections: DetectionResult[] = results
      .filter((result) => {
        const width = result.box.xmax - result.box.xmin;
        const height = result.box.ymax - result.box.ymin;
        return (
          width >= MIN_BOX_EDGE_PIXELS &&
          height >= MIN_BOX_EDGE_PIXELS &&
          width * height >= image.videoWidth * image.videoHeight * MIN_BOX_AREA_RATIO
        );
      })
      .map((result) => {
        const label = result.label.replace(/^a /i, '').replace(/\.$/, '');
        return {
          bbox: [
            result.box.xmin,
            result.box.ymin,
            result.box.xmax - result.box.xmin,
            result.box.ymax - result.box.ymin,
          ],
          class: label,
          score: result.score,
          evidence: 'camera-model',
          scoreMeaning: 'open-vocabulary-model-score',
          threatLevel: 'DANGER',
          label: `CAMERA-LIKE OBJECT — UNCONFIRMED (${label.toUpperCase()})`,
          isCameraTarget: true,
          imageWidth: image.videoWidth,
          imageHeight: image.videoHeight,
          detectedAt: Date.now(),
        };
      });

    return detections
      .sort((a, b) => b.score - a.score)
      .filter((candidate, index, sorted) => {
        const [x1, y1, width1, height1] = candidate.bbox;
        return !sorted.slice(0, index).some((accepted) => {
          const [x2, y2, width2, height2] = accepted.bbox;
          const intersectionWidth = Math.max(0, Math.min(x1 + width1, x2 + width2) - Math.max(x1, x2));
          const intersectionHeight = Math.max(0, Math.min(y1 + height1, y2 + height2) - Math.max(y1, y2));
          const intersection = intersectionWidth * intersectionHeight;
          const union = width1 * height1 + width2 * height2 - intersection;
          return union > 0 && intersection / union > 0.5;
        });
      });
  }
}

export const visibleCameraDetector = new VisibleCameraDetector();
