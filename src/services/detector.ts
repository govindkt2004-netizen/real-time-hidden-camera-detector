export interface DetectionResult {
  bbox: [number, number, number, number];
  class: string;
  score: number;
  evidence?: 'visible-optical-cue' | 'camera-model';
  scoreMeaning?: 'visual-signal-strength' | 'open-vocabulary-model-score';
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
