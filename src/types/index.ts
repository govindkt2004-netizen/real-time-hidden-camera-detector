import { DetectionResult } from '../services/detector';
import { LensGlint } from '../services/glint';

export interface ScanIncident {
  id: string;
  timestamp: number;
  threatClass: string;
  threatLabel: string;
  confidence: number;
  snapshotDataUrl?: string;
  notes?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  isManualObservation?: boolean;
}

export interface IgnoreMask {
  id: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  widthPercent: number; // 0 to 100
  heightPercent: number; // 0 to 100
  label?: string;
  enabled?: boolean;
}

export type ThemeMode = 'dark' | 'tactical-red' | 'midnight';

export interface AppSettings {
  theme: ThemeMode;
  audioAlarmEnabled: boolean;
  sensitivity: 'high' | 'balanced' | 'strict';
  glintDetectionEnabled: boolean;
  biometricLockEnabled: boolean;
  cameraFacing: 'environment' | 'user';
  fpsLimit: number;
}

export interface ActiveScanState {
  isScanning: boolean;
  isModelReady: boolean;
  modelError: string | null;
  cameraError: string | null;
  hasCameraPermission: boolean;
  activeDetections: DetectionResult[];
  activeGlints: LensGlint[];
  threatDetected: boolean;
  fps: number;
  torchAvailable: boolean;
  isTorchOn: boolean;
}
