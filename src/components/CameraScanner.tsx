import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Flashlight,
  FlashlightOff,
  Volume2,
  VolumeX,
  Download,
  Play,
  Square,
  PauseCircle,
  AlertTriangle,
  Radio,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Zap,
  ShieldOff,
  Edit3,
  Check,
  X,
  Plus,
  Bookmark,
  CheckCircle2,
  Focus,
  Target,
  Crosshair,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { detectorService } from '../services/detector';
import type { DetectionResult } from '../services/detector';
import { GlintDetector } from '../services/glint';
import { VisibleApertureDetector } from '../services/visibleApertureDetector';
import { visibleCameraDetector } from '../services/visibleCameraDetector';
import { soundAlarm } from '../services/audio';
import { AppSettings, ScanIncident, IgnoreMask } from '../types';
import { FlashlightMode } from './QuickFlashlightBar';

export interface CenterLockInfo {
  index: number;
  label: string;
  score: number;
  distPercent: number;
  cxPercent: number;
  cyPercent: number;
  totalCandidates: number;
  isAutoZoomActive: boolean;
}

interface Props {
  settings: AppSettings;
  onThreatDetected: (threats: DetectionResult[], snapshot?: string) => void;
  onStatusChange: (status: {
    isScanning: boolean;
    isPaused: boolean;
    threatDetected: boolean;
    threatCount: number;
    highestThreatLabel?: string;
    fps: number;
    ignoredThreatsCount?: number;
    cameraModelReady: boolean;
  }) => void;
  onSaveIncident: (incident: ScanIncident) => void;
  flashlightMode: FlashlightMode;
  onSetFlashlightMode: (mode: FlashlightMode) => void;
  screenIlluminator: boolean;
  onToggleScreenIlluminator: () => void;
  onHardwareTorchStatusChange?: (hasTorch: boolean) => void;
  onSetAlarmEnabled: (enabled: boolean) => void;
  ignoreMasks: IgnoreMask[];
  onAddIgnoreMask: (mask: IgnoreMask) => void;
  onRemoveIgnoreMask: (id: string) => void;
  isDrawingMask: boolean;
  onToggleDrawingMask: (active?: boolean) => void;
  showMaskOverlays: boolean;
  onToggleShowMaskOverlays?: () => void;
}

export const CameraScanner: React.FC<Props> = ({
  settings,
  onThreatDetected,
  onStatusChange,
  onSaveIncident,
  flashlightMode,
  onSetFlashlightMode,
  screenIlluminator,
  onToggleScreenIlluminator,
  onHardwareTorchStatusChange,
  onSetAlarmEnabled,
  ignoreMasks,
  onAddIgnoreMask,
  onRemoveIgnoreMask,
  isDrawingMask,
  onToggleDrawingMask,
  showMaskOverlays,
  onToggleShowMaskOverlays,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glintDetector = useMemo(() => new GlintDetector(), []);
  const apertureDetector = useMemo(() => new VisibleApertureDetector(), []);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isCameraStarting, setIsCameraStarting] = useState<boolean>(false);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const [modelLoading, setModelLoading] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const lastDetectionsRef = useRef<DetectionResult[]>([]);
  const cameraPredictionsRef = useRef<DetectionResult[]>([]);
  const lastCameraInferenceTimeRef = useRef<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [threatActive, setThreatActive] = useState<boolean>(false);
  const [manualInspectionMode, setManualInspectionMode] = useState<boolean>(false);
  const [cameraModelStatus, setCameraModelStatus] = useState<'not-loaded' | 'loading' | 'ready' | 'error'>('not-loaded');
  const [cameraModelProgress, setCameraModelProgress] = useState<number>(0);
  const [cameraModelError, setCameraModelError] = useState<string | null>(null);
  const cameraModelLoadInProgressRef = useRef(false);

  // Drawing state for ignore masks
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [pendingMask, setPendingMask] = useState<IgnoreMask | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string>('🪞 Wall Mirror');

  // Quick Snapshot toast feedback state
  const [snapshotFeedback, setSnapshotFeedback] = useState<{
    show: boolean;
    previewUrl?: string;
    message: string;
  } | null>(null);
  const snapshotToastTimerRef = useRef<number | null>(null);

  // Auto-Center Focus & Focal Zoom states for multi-candidate detection
  const [autoZoomEnabled, setAutoZoomEnabled] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.45);
  const [currentZoom, setCurrentZoom] = useState<number>(1.0);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [centerLock, setCenterLock] = useState<CenterLockInfo | null>(null);
  const [testDistance, setTestDistance] = useState<'near' | '10' | '15' | '20'>('near');

  // Mutable refs for frame loop
  const autoZoomEnabledRef = useRef<boolean>(true);
  const zoomLevelRef = useRef<number>(1.45);
  const isDrawingMaskRef = useRef<boolean>(isDrawingMask);

  useEffect(() => {
    autoZoomEnabledRef.current = autoZoomEnabled;
  }, [autoZoomEnabled]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    isDrawingMaskRef.current = isDrawingMask;
  }, [isDrawingMask]);

  // Keep a ref of ignoreMasks so main processing loop always reads latest masks without tearing down RAF
  const ignoreMasksRef = useRef<IgnoreMask[]>(ignoreMasks);
  useEffect(() => {
    ignoreMasksRef.current = ignoreMasks;
  }, [ignoreMasks]);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef<number>(0);
  const cameraStartInProgressRef = useRef<boolean>(false);
  const animFrameId = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(performance.now());
  const frameCount = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const lastThreatLoggedTime = useRef<number>(0);
  const lastInferenceTime = useRef<number>(0);
  const lastStatusPublishTime = useRef<number>(0);
  const lastPublishedThreat = useRef<boolean>(false);
  const lastPublishedThreatCount = useRef<number>(0);
  const zoomOriginRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });

  // Strobe timer reference
  const strobeTimerRef = useRef<number | null>(null);
  const strobeStateRef = useRef<boolean>(false);

  // Initialize TFJS / COCO-SSD Model
  useEffect(() => {
    let isMounted = true;
    setModelLoading(true);
    setModelError(null);

    detectorService
      .init()
      .then(() => {
        if (isMounted) {
          setModelReady(true);
          setModelLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Detection model failed to load';
          setModelError(msg);
          setModelLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update soundAlarm mute state from settings
  useEffect(() => {
    soundAlarm.setMuted(!settings.audioAlarmEnabled);
  }, [settings.audioAlarmEnabled]);

  // Start Video Stream
  const startCamera = useCallback(async () => {
    const requestId = ++cameraRequestIdRef.current;
    setCameraError(null);

    if (streamRef.current) {
      const previousStream = streamRef.current;
      streamRef.current = null;
      if (videoRef.current?.srcObject === previousStream) videoRef.current.srcObject = null;
      previousStream.getTracks().forEach((track) => track.stop());
    }

    let requestedStream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Camera access requires a supported browser in a secure context (HTTPS or localhost).'
        );
      }

      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: facingMode },
        width: { ideal: settings.cameraResolution === 'high' ? 1920 : 1280 },
        height: { ideal: settings.cameraResolution === 'high' ? 1080 : 720 },
      };
      try {
        requestedStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch (error: unknown) {
        const isFacingModeError =
          error instanceof DOMException &&
          (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError');
        if (!isFacingModeError || facingMode !== 'environment') throw error;
        requestedStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: videoConstraints.width,
            height: videoConstraints.height,
          },
          audio: false,
        });
      }
      if (!requestedStream) throw new Error('Camera stream could not be started.');
      const activeStream = requestedStream;

      if (requestId !== cameraRequestIdRef.current) {
        activeStream.getTracks().forEach((track) => track.stop());
        return false;
      }

      streamRef.current = activeStream;
      activeStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current !== activeStream) return;
        streamRef.current = null;
        if (videoRef.current?.srcObject === activeStream) videoRef.current.srcObject = null;
        activeStream.getTracks().forEach((streamTrack) => streamTrack.stop());
        setCameraError('The camera feed ended. It may have been disconnected or its permission revoked. Start scanning to reconnect.');
        setIsScanning(false);
        setIsPaused(false);
        setThreatActive(false);
        lastDetectionsRef.current = [];
        cameraPredictionsRef.current = [];
        onThreatDetected([]);
        soundAlarm.stopAlarm();
        setHasTorch(false);
        onHardwareTorchStatusChange?.(false);
      });

      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        await videoRef.current.play();
      }

      if (requestId !== cameraRequestIdRef.current) {
        if (streamRef.current === activeStream) streamRef.current = null;
        activeStream.getTracks().forEach((track) => track.stop());
        if (videoRef.current?.srcObject === activeStream) videoRef.current.srcObject = null;
        return false;
      }

      // Check torch capability on camera track
      const track = activeStream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() as { torch?: boolean };
        const torchSupported = Boolean(capabilities && capabilities.torch);
        setHasTorch(torchSupported);
        if (onHardwareTorchStatusChange) {
          onHardwareTorchStatusChange(torchSupported);
        }
      } else {
        setHasTorch(false);
        if (onHardwareTorchStatusChange) {
          onHardwareTorchStatusChange(false);
        }
      }
      return true;
    } catch (err: unknown) {
      if (requestId !== cameraRequestIdRef.current) {
        requestedStream?.getTracks().forEach((track) => track.stop());
        return false;
      }
      console.error('Camera stream error:', err);
      if (streamRef.current === requestedStream) streamRef.current = null;
      requestedStream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current?.srcObject === requestedStream) {
        videoRef.current.srcObject = null;
      }
      setIsScanning(false);
      setIsPaused(false);
      soundAlarm.stopAlarm();
      setHasTorch(false);
      onHardwareTorchStatusChange?.(false);
      let message = 'Unable to access camera.';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Camera permission denied. Please allow camera permissions in your browser address bar.';
        } else if (err.name === 'SecurityError') {
          message = 'Camera access is blocked. Open the deployed site over HTTPS and check browser privacy permissions.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No video camera detected on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Camera is already in use by another application or tab.';
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          message = 'The camera could not provide the requested resolution. Try standard image quality or another camera.';
        } else if (err.name === 'AbortError') {
          message = 'The camera request was interrupted. Please try again.';
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setCameraError(message);
      return false;
    }
  }, [facingMode, onHardwareTorchStatusChange, settings.cameraResolution]);

  const stopCamera = useCallback(() => {
    cameraRequestIdRef.current++;
    const activeStream = streamRef.current;
    streamRef.current = null;
    activeStream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setHasTorch(false);
    onHardwareTorchStatusChange?.(false);
    onSetFlashlightMode('off');
    setThreatActive(false);
    lastDetectionsRef.current = [];
    cameraPredictionsRef.current = [];
    lastCameraInferenceTimeRef.current = 0;
    setFps(0);
    fpsRef.current = 0;
    frameCount.current = 0;
    onThreatDetected([]);
    soundAlarm.stopAlarm();
  }, [onHardwareTorchStatusChange, onSetFlashlightMode, onThreatDetected]);

  const handleStartScan = async () => {
    if (cameraStartInProgressRef.current) return;
    cameraStartInProgressRef.current = true;
    setIsCameraStarting(true);
    soundAlarm.init();
    try {
      const cameraReady = streamRef.current !== null || (await startCamera());
      if (cameraReady) {
        setIsScanning(true);
        setIsPaused(false);
        void handleLoadCameraModel();
      }
    } finally {
      cameraStartInProgressRef.current = false;
      setIsCameraStarting(false);
    }
  };

  const handleLoadCameraModel = async () => {
    if (
      cameraModelLoadInProgressRef.current ||
      cameraModelStatus === 'loading' ||
      cameraModelStatus === 'ready'
    ) return;
    cameraModelLoadInProgressRef.current = true;
    setCameraModelStatus('loading');
    setCameraModelProgress(0);
    setCameraModelError(null);
    try {
      await visibleCameraDetector.load((progress) => {
        if ('progress' in progress && Number.isFinite(progress.progress)) {
          setCameraModelProgress((current) => Math.max(current, progress.progress));
        }
      });
      setCameraModelStatus('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Camera model could not be loaded.';
      console.error('Visible camera model loading failed:', error);
      setCameraModelError(message);
      setCameraModelStatus('error');
    } finally {
      cameraModelLoadInProgressRef.current = false;
    }
  };

  useEffect(() => {
    if (streamRef.current) void startCamera();
  }, [facingMode, settings.cameraResolution, startCamera]);

  useEffect(() => {
    return () => {
      cameraRequestIdRef.current++;
      if (streamRef.current) {
        const activeStream = streamRef.current;
        streamRef.current = null;
        activeStream.getTracks().forEach((track) => track.stop());
      }
      soundAlarm.stopAlarm();
    };
  }, []);

  // Apply Hardware Torch constraint
  const applyHardwareTorch = useCallback(async (state: boolean) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: state }],
      });
    } catch (err) {
      // Ignore if device rejected constraint
    }
  }, []);

  // Flashlight mode effect (off / steady / strobe)
  useEffect(() => {
    if (strobeTimerRef.current) {
      clearInterval(strobeTimerRef.current);
      strobeTimerRef.current = null;
    }

    if (flashlightMode === 'steady') {
      applyHardwareTorch(true);
    } else if (flashlightMode === 'strobe') {
      strobeStateRef.current = true;
      applyHardwareTorch(true);

      strobeTimerRef.current = window.setInterval(() => {
        strobeStateRef.current = !strobeStateRef.current;
        applyHardwareTorch(strobeStateRef.current);
      }, 190);
    } else {
      applyHardwareTorch(false);
    }

    return () => {
      if (strobeTimerRef.current) {
        clearInterval(strobeTimerRef.current);
        strobeTimerRef.current = null;
      }
      applyHardwareTorch(false);
    };
  }, [flashlightMode, applyHardwareTorch]);

  const cycleFlashlightMode = () => {
    soundAlarm.playScanTick();
    if (flashlightMode === 'off') {
      onSetFlashlightMode('steady');
    } else if (flashlightMode === 'steady') {
      onSetFlashlightMode('strobe');
    } else {
      onSetFlashlightMode('off');
    }
  };

  const switchCameraFacing = () => {
    onSetFlashlightMode('off');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Pointer event handlers for drawing ignore masks on camera
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingMask || !containerRef) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = containerRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingMask || !drawStart || !containerRef) return;

    const rect = containerRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setDrawCurrent({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingMask || !drawStart || !drawCurrent || !containerRef) {
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const xPercent = Math.min(drawStart.x, drawCurrent.x);
    const yPercent = Math.min(drawStart.y, drawCurrent.y);
    const widthPercent = Math.abs(drawCurrent.x - drawStart.x);
    const heightPercent = Math.abs(drawCurrent.y - drawStart.y);

    setDrawStart(null);
    setDrawCurrent(null);

    // Require min 3% width and height to prevent accidental micro-clicks
    if (widthPercent >= 3 && heightPercent >= 3) {
      const newMask: IgnoreMask = {
        id: `mask_${Date.now()}`,
        xPercent,
        yPercent,
        widthPercent,
        heightPercent,
        label: '🪞 Wall Mirror',
        enabled: true,
      };
      setPendingMask(newMask);
      setPendingLabel('🪞 Wall Mirror');
    }
  };

  const handlePointerCancel = () => {
    setDrawStart(null);
    setDrawCurrent(null);
  };

  // Save a manual snapshot without treating it as a camera alert.
  const captureEvidenceSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const offscreen = document.createElement('canvas');
    offscreen.width = video.videoWidth || 640;
    offscreen.height = video.videoHeight || 480;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // Draw raw camera frame
    ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
    // Draw detection overlays if present
    if (canvasRef.current) {
      ctx.drawImage(canvasRef.current, 0, 0, offscreen.width, offscreen.height);
    }

    const dataUrl = offscreen.toDataURL('image/jpeg', 0.9);

    const latestDetections = lastDetectionsRef.current;
    const highest = latestDetections.find(
      (d) =>
        d.isCameraTarget &&
        d.evidence === 'camera-model' &&
        d.threatLevel === 'DANGER'
    );

    const incident: ScanIncident = {
      id: `incident_${Date.now()}`,
      timestamp: Date.now(),
      threatClass: highest ? highest.class : 'SWEEP_SNAPSHOT',
      threatLabel: highest ? highest.label : 'Manual Snapshot (No Camera Candidate)',
      confidence: highest ? highest.score : 0,
      snapshotDataUrl: dataUrl,
      priority: highest ? 'HIGH' : 'LOW',
      isManualObservation: false,
      notes: highest
        ? `Manual snapshot with an unconfirmed camera-model candidate. Facing: ${facingMode}, Torch: ${flashlightMode}.`
        : `Manual snapshot only; no camera candidate detected. Facing: ${facingMode}, Torch: ${flashlightMode}.`,
    };

    onSaveIncident(incident);

    // Trigger visual toast feedback
    if (snapshotToastTimerRef.current) {
      clearTimeout(snapshotToastTimerRef.current);
    }
    setSnapshotFeedback({
      show: true,
      previewUrl: dataUrl,
      message: highest
        ? 'Snapshot saved with unconfirmed camera candidate'
        : 'Snapshot saved (no camera candidate detected)',
    });
    snapshotToastTimerRef.current = window.setTimeout(() => {
      setSnapshotFeedback(null);
    }, 3200);
  };

  const handleQuickSnapshot = () => {
    captureEvidenceSnapshot();
  };

  // Main detection loop: model inference with optional ignore-mask filtering.
  useEffect(() => {
    let isRunning = true;
    let idleStatusReported = false;
    let idleTimeout: number | null = null;

    const processFrame = async () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const container = containerRef;
      const activeStream = streamRef.current;

      if (
        video &&
        canvas &&
        activeStream &&
        video.readyState >= 2 &&
        isScanning &&
        !isPaused &&
        modelReady &&
        performance.now() - lastInferenceTime.current >= 1000 / Math.max(1, settings.fpsLimit)
      ) {
        idleStatusReported = false;
        lastInferenceTime.current = performance.now();
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          try {
            // Analyze the full frame and overlapping crops with the loaded object detector.
            const modelPredictions = await detectorService.detect(
              video,
              settings.sensitivity,
              settings.scanPerformance
            );
            if (!isRunning || streamRef.current !== activeStream) return;
            if (
              cameraModelStatus === 'ready' &&
              visibleCameraDetector.isLoaded() &&
              performance.now() - lastCameraInferenceTimeRef.current >= 1200
            ) {
              lastCameraInferenceTimeRef.current = performance.now();
              try {
                cameraPredictionsRef.current = await visibleCameraDetector.detect(
                  video,
                  settings.sensitivity
                );
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Camera model inference failed.';
                console.error('Visible camera model inference failed:', error);
                cameraPredictionsRef.current = [];
                setCameraModelError(message);
                setCameraModelStatus('error');
              }
              if (!isRunning || streamRef.current !== activeStream) return;
            }
            const opticalCues: DetectionResult[] = manualInspectionMode
              ? [
                  ...glintDetector
                    .analyzeFrame(video, 240, 3, hasTorch && flashlightMode !== 'off')
                    .map((cue): DetectionResult => ({
                      bbox: [
                        Math.max(0, cue.x - cue.radius),
                        Math.max(0, cue.y - cue.radius),
                        Math.min(cue.radius * 2, video.videoWidth - Math.max(0, cue.x - cue.radius)),
                        Math.min(cue.radius * 2, video.videoHeight - Math.max(0, cue.y - cue.radius)),
                      ],
                      class: 'bright reflection',
                      score: cue.intensity,
                      evidence: 'visible-optical-cue',
                      scoreMeaning: 'visual-signal-strength',
                      threatLevel: 'INFO',
                      label: 'BRIGHT REFLECTION — NOT IDENTIFIED AS A CAMERA',
                      isCameraTarget: false,
                      imageWidth: video.videoWidth,
                      imageHeight: video.videoHeight,
                      detectedAt: Date.now(),
                    })),
                  ...apertureDetector
                    .analyzeFrame(video)
                    .map((cue): DetectionResult => ({
                      bbox: [
                        Math.max(0, cue.x - cue.radius),
                        Math.max(0, cue.y - cue.radius),
                        Math.min(cue.radius * 2, video.videoWidth - Math.max(0, cue.x - cue.radius)),
                        Math.min(cue.radius * 2, video.videoHeight - Math.max(0, cue.y - cue.radius)),
                      ],
                      class: 'dark aperture-like feature',
                      score: cue.signalStrength,
                      evidence: 'visible-optical-cue',
                      scoreMeaning: 'visual-signal-strength',
                      threatLevel: 'INFO',
                      label: 'DARK APERTURE-LIKE FEATURE — NOT IDENTIFIED AS A CAMERA',
                      isCameraTarget: false,
                      imageWidth: video.videoWidth,
                      imageHeight: video.videoHeight,
                      detectedAt: Date.now(),
                    })),
                ]
              : [];
            const personDetections = modelPredictions.filter(
              (prediction) => prediction.class.toLowerCase() === 'person'
            );
            const visibleCameraCandidates = cameraPredictionsRef.current.filter((candidate) =>
              !personDetections.some((person) => {
                const [cameraX, cameraY, cameraWidth, cameraHeight] = candidate.bbox;
                const [personX, personY, personWidth, personHeight] = person.bbox;
                const intersectionWidth = Math.max(
                  0,
                  Math.min(cameraX + cameraWidth, personX + personWidth) - Math.max(cameraX, personX)
                );
                const intersectionHeight = Math.max(
                  0,
                  Math.min(cameraY + cameraHeight, personY + personHeight) - Math.max(cameraY, personY)
                );
                const cameraArea = cameraWidth * cameraHeight;
                return (
                  cameraArea > 0 &&
                  (intersectionWidth * intersectionHeight) / cameraArea >= 0.5
                );
              })
            );
            const predictions = [...modelPredictions, ...visibleCameraCandidates, ...opticalCues];

            frameCount.current++;
            const now = performance.now();
            if (now - lastFrameTime.current >= 1000) {
              fpsRef.current = frameCount.current;
              setFps(fpsRef.current);
              frameCount.current = 0;
              lastFrameTime.current = now;
            }

            lastDetectionsRef.current = predictions;

            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;
            const cw = container ? container.clientWidth : 640;
            const ch = container ? container.clientHeight : 480;
            const currentMasks = ignoreMasksRef.current;

            let skippedByMaskCount = 0;

            // Only explicitly classified camera targets are eligible for an alert.
            const cameraThreats = predictions.filter((p) => {
              if (
                !p.isCameraTarget ||
                p.evidence !== 'camera-model' ||
                p.threatLevel !== 'DANGER'
              ) {
                return false;
              }
              p.isIgnored = undefined;
              p.ignoredReason = undefined;

              // Convert detection video bounding box to container percentage coordinates
              const [bx, by, bw, bh] = p.bbox;
              const scale = Math.max(cw / vw, ch / vh);
              const renderedW = vw * scale;
              const renderedH = vh * scale;
              const offsetX = (cw - renderedW) / 2;
              const offsetY = (ch - renderedH) / 2;

              // Detection box in container percentage
              const detCenterX = (bx + bw / 2) * scale + offsetX;
              const detCenterY = (by + bh / 2) * scale + offsetY;
              const detCenterXPercent = (detCenterX / cw) * 100;
              const detCenterYPercent = (detCenterY / ch) * 100;

              const detXPercent = ((bx * scale + offsetX) / cw) * 100;
              const detYPercent = ((by * scale + offsetY) / ch) * 100;
              const detWPercent = ((bw * scale) / cw) * 100;
              const detHPercent = ((bh * scale) / ch) * 100;

              // Check if detection falls within any enabled ignore mask
              const isMasked = currentMasks.some((mask) => {
                if (mask.enabled === false) return false;

                // 1. Center inside mask
                const centerInside =
                  detCenterXPercent >= mask.xPercent &&
                  detCenterXPercent <= mask.xPercent + mask.widthPercent &&
                  detCenterYPercent >= mask.yPercent &&
                  detCenterYPercent <= mask.yPercent + mask.heightPercent;

                if (centerInside) return true;

                // 2. Significant overlap (> 30% of detection covered by mask)
                const interX1 = Math.max(detXPercent, mask.xPercent);
                const interY1 = Math.max(detYPercent, mask.yPercent);
                const interX2 = Math.min(detXPercent + detWPercent, mask.xPercent + mask.widthPercent);
                const interY2 = Math.min(detYPercent + detHPercent, mask.yPercent + mask.heightPercent);

                if (interX2 > interX1 && interY2 > interY1) {
                  const interArea = (interX2 - interX1) * (interY2 - interY1);
                  const detArea = detWPercent * detHPercent;
                  if (detArea > 0 && interArea / detArea > 0.3) {
                    return true;
                  }
                }

                return false;
              });

              if (isMasked) {
                p.isIgnored = true;
                p.ignoredReason = 'Shielded by Ignore Mask';
                skippedByMaskCount++;
                return false; // EXCLUDE from threat list! No alarm, no danger box!
              }

              return true;
            });

            // ========================================================
            // MULTI-CANDIDATE CENTER-MOST CALCULATION & AUTO-ZOOM LOCK
            // ========================================================
            let centerMostIndex = -1;
            let minCenterDistSq = Infinity;
            let lockData: CenterLockInfo | null = null;

            if (cameraThreats.length > 1) {
              const frameCenterX = canvas.width / 2;
              const frameCenterY = canvas.height / 2;
              const maxHypot = Math.hypot(frameCenterX, frameCenterY);

              cameraThreats.forEach((threat, idx) => {
                const [bx, by, bw, bh] = threat.bbox;
                const objCenterX = bx + bw / 2;
                const objCenterY = by + bh / 2;
                const dSq = (objCenterX - frameCenterX) ** 2 + (objCenterY - frameCenterY) ** 2;

                if (dSq < minCenterDistSq) {
                  minCenterDistSq = dSq;
                  centerMostIndex = idx;
                }
              });

              if (centerMostIndex >= 0) {
                const centerTarget = cameraThreats[centerMostIndex];
                const [bx, by, bw, bh] = centerTarget.bbox;
                const objCenterX = bx + bw / 2;
                const objCenterY = by + bh / 2;
                const distPixels = Math.sqrt(minCenterDistSq);
                const distPercent = Math.min(100, (distPixels / maxHypot) * 100);

                const originXPercent = Math.max(10, Math.min(90, (objCenterX / canvas.width) * 100));
                const originYPercent = Math.max(10, Math.min(90, (objCenterY / canvas.height) * 100));

                const willAutoZoom = autoZoomEnabledRef.current && !isDrawingMaskRef.current;

                lockData = {
                  index: centerMostIndex,
                  label: centerTarget.label,
                  score: centerTarget.score,
                  distPercent,
                  cxPercent: originXPercent,
                  cyPercent: originYPercent,
                  totalCandidates: cameraThreats.length,
                  isAutoZoomActive: willAutoZoom,
                };

                if (
                  Math.abs(originXPercent - zoomOriginRef.current.x) > 1 ||
                  Math.abs(originYPercent - zoomOriginRef.current.y) > 1
                ) {
                  zoomOriginRef.current = { x: originXPercent, y: originYPercent };
                  setZoomOrigin(zoomOriginRef.current);
                }
                if (willAutoZoom) {
                  setCurrentZoom(zoomLevelRef.current);
                } else {
                  setCurrentZoom(1.0);
                }
              }
            } else {
              // 0 or 1 threat - neutral framing
              setCurrentZoom(1.0);
              if (zoomOriginRef.current.x !== 50 || zoomOriginRef.current.y !== 50) {
                zoomOriginRef.current = { x: 50, y: 50 };
                setZoomOrigin(zoomOriginRef.current);
              }
            }

            setCenterLock((previous) => {
              if (!previous || !lockData) return previous === lockData ? previous : lockData;
              const changed =
                previous.index !== lockData.index ||
                previous.totalCandidates !== lockData.totalCandidates ||
                previous.label !== lockData.label ||
                previous.isAutoZoomActive !== lockData.isAutoZoomActive ||
                Math.abs(previous.score - lockData.score) > 0.03 ||
                Math.abs(previous.distPercent - lockData.distPercent) > 2 ||
                Math.abs(previous.cxPercent - lockData.cxPercent) > 2 ||
                Math.abs(previous.cyPercent - lockData.cyPercent) > 2;
              return changed ? lockData : previous;
            });

            const hasCamera = cameraThreats.length > 0;
            setThreatActive(hasCamera);
            const completedAt = performance.now();
            if (
              hasCamera !== lastPublishedThreat.current ||
              cameraThreats.length !== lastPublishedThreatCount.current ||
              completedAt - lastStatusPublishTime.current >= 500
            ) {
              onThreatDetected(predictions);
              onStatusChange({
                isScanning: true,
                isPaused: false,
                threatDetected: hasCamera,
                threatCount: cameraThreats.length,
                highestThreatLabel: (centerMostIndex >= 0 ? cameraThreats[centerMostIndex] : cameraThreats[0])?.label,
                fps: fpsRef.current,
                ignoredThreatsCount: skippedByMaskCount,
                cameraModelReady: cameraModelStatus === 'ready',
              });
              lastPublishedThreat.current = hasCamera;
              lastPublishedThreatCount.current = cameraThreats.length;
              lastStatusPublishTime.current = completedAt;
            }

            if (hasCamera) {
              soundAlarm.triggerAlarmSequence();

              // Auto-log incident throttled to avoid duplicates
              const now = Date.now();
              if (now - lastThreatLoggedTime.current > 6000) {
                lastThreatLoggedTime.current = now;
                const top = cameraThreats[centerMostIndex >= 0 ? centerMostIndex : 0];
                onSaveIncident({
                  id: `incident_${now}`,
                  timestamp: now,
                  threatClass: top.class,
                  threatLabel: top.label,
                  confidence: top.score,
                  priority: 'MEDIUM',
                  notes: top.evidence === 'visible-optical-cue'
                    ? `Manual visual sweep found a ${top.class} cue (signal strength ${(top.score * 100).toFixed(1)}%). Reflections and apertures are common in harmless objects; this is not a camera-probability score or confirmation.`
                    : top.evidence === 'camera-model'
                    ? `Grounding DINO matched the visible image to the "${top.class}" prompt with score ${(top.score * 100).toFixed(1)}%. This is an unconfirmed open-vocabulary match, not proof of a camera or recording.`
                    : `COCO-SSD ${top.class} observation, model score ${(top.score * 100).toFixed(1)}%. This does not confirm a camera or recording.`,
                });
              }
            } else {
              soundAlarm.stopAlarm();
            }

            // Draw Overlays: Highlights center-most candidate when multiple are identified
            drawOverlays(ctx, cameraThreats);

          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown inference error';
            console.error('Detection cycle error:', err);
            setModelError(`Object detection failed: ${message}`);
            setModelReady(false);
            setIsScanning(false);
            setIsPaused(false);
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            setThreatActive(false);
            lastDetectionsRef.current = [];
            cameraPredictionsRef.current = [];
            onThreatDetected([]);
            onStatusChange({
              isScanning: false,
              isPaused: false,
              threatDetected: false,
              threatCount: 0,
              fps: 0,
              cameraModelReady: cameraModelStatus === 'ready',
            });
            setFps(0);
            fpsRef.current = 0;
            frameCount.current = 0;
            soundAlarm.stopAlarm();
          }
        }

      } else if (!isScanning || isPaused) {
        soundAlarm.stopAlarm();
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        if (!idleStatusReported) {
          onStatusChange({
            isScanning: false,
            isPaused,
            threatDetected: false,
            threatCount: 0,
            fps: 0,
            cameraModelReady: cameraModelStatus === 'ready',
          });
          onThreatDetected([]);
          setCenterLock(null);
          setFps(0);
          fpsRef.current = 0;
          frameCount.current = 0;
          idleStatusReported = true;
          lastPublishedThreat.current = false;
          lastPublishedThreatCount.current = 0;
          lastStatusPublishTime.current = performance.now();
        }
      }

      if (isRunning) {
        if (isScanning && !isPaused && modelReady && streamRef.current) {
          const waitMs = Math.max(
            0,
            1000 / Math.max(1, settings.fpsLimit) - (performance.now() - lastInferenceTime.current)
          );
          if (waitMs > 0) {
            idleTimeout = window.setTimeout(() => {
              animFrameId.current = requestAnimationFrame(processFrame);
            }, waitMs);
          } else {
            animFrameId.current = requestAnimationFrame(processFrame);
          }
        } else {
          idleTimeout = window.setTimeout(() => {
            animFrameId.current = requestAnimationFrame(processFrame);
          }, 250);
        }
      }
    };

    animFrameId.current = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
      if (idleTimeout !== null) {
        window.clearTimeout(idleTimeout);
      }
      soundAlarm.stopAlarm();
    };
  }, [
    isScanning,
    modelReady,
    settings.sensitivity,
    settings.scanPerformance,
    settings.fpsLimit,
    cameraModelStatus,
    isPaused,
    flashlightMode,
    hasTorch,
    manualInspectionMode,
    screenIlluminator,
    containerRef,
  ]);

  // Keep the live camera view clear of non-camera detections.
  const drawOverlays = (ctx: CanvasRenderingContext2D, cameraCandidates: DetectionResult[]) => {
    cameraCandidates.forEach((d) => {
      if (
        d.isCameraTarget &&
        d.evidence === 'camera-model' &&
        d.threatLevel === 'DANGER'
      ) {
        const [x, y, w, h] = d.bbox;
        const tag = `CAMERA-LIKE OBJECT — VERIFY: ${d.label}`;
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.strokeRect(x, y, w, h);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        const tagWidth = ctx.measureText(tag).width + 12;
        const tagY = Math.max(0, y - 22);
        ctx.fillStyle = 'rgba(127, 29, 29, 0.95)';
        ctx.fillRect(x, tagY, tagWidth, 20);
        ctx.fillStyle = '#fecaca';
        ctx.fillText(tag, x + 6, tagY + 14);
        ctx.restore();
      }
    });
  };

  const toggleFullscreen = () => {
    if (!containerRef) return;
    if (!document.fullscreenElement) {
      containerRef.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={setContainerRef}
      className={`relative w-full overflow-hidden rounded-2xl bg-black border border-slate-800 shadow-2xl flex flex-col select-none ${
        isFullscreen
          ? 'h-[100dvh] w-screen rounded-none border-none'
          : 'aspect-video min-h-[min(380px,62vh)] max-h-[70dvh] sm:min-h-[380px]'
      }`}
    >
      {/* Zoomable Viewport Layer for Video & Detection Overlays */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{
          transform: currentZoom > 1 && !isDrawingMask ? `scale(${currentZoom})` : 'scale(1)',
          transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          transition:
            'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform-origin 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />
      </div>

      {/* Screen perimeter light ring for manual low-light inspection */}
      {screenIlluminator && (
        <div
          className={`absolute inset-0 pointer-events-none z-20 border-[24px] sm:border-[36px] border-white shadow-[inset_0_0_80px_rgba(255,255,255,0.95)] transition-opacity duration-150 ${
            flashlightMode === 'strobe' ? 'animate-pulse' : 'opacity-100'
          }`}
        />
      )}

      {/* Clean, smooth green Laser Scan line */}
      {isScanning && !threatActive && modelReady && (
        <div
          className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] pointer-events-none z-10 animate-scan-beam"
        />
      )}

      {/* Red screen flash marks an unconfirmed object or optical cue, not a confirmed camera. */}
      {threatActive && (
        <div className="absolute inset-0 border-4 border-red-600/90 pointer-events-none z-20 animate-pulse bg-red-950/20" />
      )}

      {/* Interactive Drawing Layer for Ignore Masks */}
      {isDrawingMask && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="absolute inset-0 z-30 cursor-crosshair touch-none bg-amber-500/5 select-none"
        >
          {/* Active selection box while dragging */}
          {drawStart && drawCurrent && (
            <div
              style={{
                left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
              }}
              className="absolute border-2 border-dashed border-amber-400 bg-amber-500/30 pointer-events-none shadow-2xl"
            >
              <div className="absolute -top-7 left-0 px-2.5 py-1 rounded-md bg-amber-950 border border-amber-500 text-amber-200 text-[10px] font-mono font-bold whitespace-nowrap shadow-lg">
                Drawing Ignore Zone ({Math.round(Math.abs(drawCurrent.x - drawStart.x))}% ×{' '}
                {Math.round(Math.abs(drawCurrent.y - drawStart.y))}%)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render Active Ignore Masks over Video Feed */}
      {showMaskOverlays &&
        ignoreMasks.map((mask, idx) => (
          <div
            key={mask.id}
            style={{
              left: `${mask.xPercent}%`,
              top: `${mask.yPercent}%`,
              width: `${mask.widthPercent}%`,
              height: `${mask.heightPercent}%`,
            }}
            className="absolute border-2 border-dashed border-amber-400/90 bg-amber-500/15 pointer-events-auto z-20 group transition-all"
          >
            {/* Reticle corner marks */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-300" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-300" />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-300" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-300" />

            {/* Label tag */}
            <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-black/80 border border-amber-500/60 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1 shadow-md pointer-events-none whitespace-nowrap">
              <span>🚫 IGNORED: {mask.label || `Zone #${idx + 1}`}</span>
            </div>

            {/* Direct delete button on hover/tap */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveIgnoreMask(mask.id);
                soundAlarm.playScanTick();
              }}
              className="absolute top-1 right-1 p-1 rounded bg-black/80 text-amber-300 border border-amber-500/50 hover:bg-red-600 hover:text-white hover:border-red-500 transition-all cursor-pointer opacity-85 group-hover:opacity-100"
              title="Delete this ignore mask"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

      {/* Top Banner when Drawing Mode is Active */}
      {isDrawingMask && (
        <div className="absolute top-14 inset-x-3 z-40 p-2.5 rounded-xl bg-amber-950/95 border border-amber-500/80 text-amber-200 text-xs font-mono flex items-center justify-between shadow-2xl backdrop-blur-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              <strong>DRAWING MODE:</strong> Drag across windows or mirrors to ignore them.
            </span>
          </div>
          <button
            onClick={() => onToggleDrawingMask(false)}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer shadow flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      )}

      {/* Top HUD Bar */}
      <div className="absolute top-0 inset-x-0 z-30 p-2 sm:p-4 flex items-start justify-between gap-1 pointer-events-none bg-gradient-to-b from-black/85 via-black/40 to-transparent">
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {threatActive ? (
            <div className="px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-red-600 text-white font-mono text-[10px] sm:text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-lg shadow-red-900/60 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span>CAMERA-LIKE OBJECT DETECTED — VERIFY</span>
            </div>
          ) : isScanning && !isPaused ? (
            <div className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-semibold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>SCANNING</span>
            </div>
          ) : isPaused ? (
            <div className="px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-xs">
              PAUSED
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-slate-400 font-mono text-xs">
              STANDBY
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 px-2.5 py-0.5 rounded bg-black/60 border border-slate-800">
            <span>FPS: {fps}</span>
            <span>·</span>
            <span className="uppercase">{facingMode}</span>
            <span>·</span>
            <span>{settings.scanPerformance.toUpperCase()}</span>
            {videoRef.current?.videoWidth ? (
              <>
                <span>·</span>
                <span>{videoRef.current.videoWidth}×{videoRef.current.videoHeight}</span>
              </>
            ) : null}
          </div>

          <div className="sm:hidden px-1.5 py-1 rounded bg-black/70 border border-slate-700 text-[9px] font-mono text-slate-300">
            {fps} FPS
          </div>

          <div className="flex flex-col items-start gap-0.5 text-[9px] sm:text-[10px] font-mono text-slate-300 px-1.5 sm:px-2 py-1 rounded bg-black/70 border border-slate-700 pointer-events-auto">
            <label className="flex items-center gap-1.5">
              <span className="hidden sm:inline">TEST DISTANCE</span>
              <span className="sm:hidden">TEST</span>
              <select
                value={testDistance}
                onChange={(event) => setTestDistance(event.target.value as typeof testDistance)}
                className="bg-slate-900 text-white rounded px-1 py-0.5 border border-slate-600"
                aria-label="Select test distance"
                title="Manual test setup only. The application cannot measure distance or guarantee detection at any range."
              >
                <option value="near">Near</option>
                <option value="10">10 m</option>
                <option value="15">15 m</option>
                <option value="20">20 m</option>
              </select>
            </label>
            <span className="text-[8px] sm:text-[10px] text-slate-500">
              <span className="sm:hidden">Range unmeasured</span>
              <span className="hidden sm:inline">Test setting only; range is not measured.</span>
            </span>
          </div>

          {ignoreMasks.length > 0 && (
            <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-amber-300 px-2.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/40">
              <ShieldOff className="w-3 h-3 text-amber-400" />
              <span>{ignoreMasks.length} Masks Active</span>
            </div>
          )}
        </div>

        {/* Quick HUD controls */}
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5 pointer-events-auto">
          {/* Auto-Center Focal Zoom Toggle */}
          <button
            onClick={() => {
              setAutoZoomEnabled((prev) => !prev);
              soundAlarm.playScanTick();
            }}
            className={`hidden sm:flex min-w-11 min-h-11 p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer items-center justify-center gap-1.5 ${
              autoZoomEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/50'
                : 'bg-black/60 text-slate-400 border-white/10 hover:bg-black/80'
            }`}
            title={`Auto-center digital zoom on multiple candidates: ${autoZoomEnabled ? 'ON' : 'OFF'}`}
          >
            <Focus className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-mono font-bold hidden md:inline">
              {autoZoomEnabled ? `AUTO DIGITAL ZOOM` : 'ZOOM OFF'}
            </span>
          </button>

          {/* Ignore Mask Drawing Toggle */}
          <button
            onClick={() => onToggleDrawingMask()}
            className={`hidden sm:flex min-w-11 min-h-11 p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer items-center justify-center gap-1.5 ${
              isDrawingMask
                ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/40 ring-2 ring-amber-300'
                : ignoreMasks.length > 0
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 hover:bg-amber-900/80'
                : 'bg-black/60 text-slate-300 border-white/10 hover:bg-black/80'
            }`}
            title={isDrawingMask ? 'Exit Drawing Mode' : `Ignore Masks (${ignoreMasks.length} active)`}
          >
            <ShieldOff className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold hidden md:inline">
              {isDrawingMask ? 'DRAWING' : `MASKS (${ignoreMasks.length})`}
            </span>
          </button>

          <button
            onClick={cycleFlashlightMode}
            className={`min-w-11 min-h-11 p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              flashlightMode === 'steady'
                ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
                : flashlightMode === 'strobe'
                ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/40 animate-pulse'
                : 'bg-black/60 text-slate-300 border-white/10 hover:bg-black/80'
            }`}
            title={`Flashlight: ${flashlightMode.toUpperCase()}`}
          >
            {flashlightMode === 'off' ? (
              <FlashlightOff className="w-4 h-4" />
            ) : flashlightMode === 'strobe' ? (
              <Zap className="w-4 h-4 animate-bounce" />
            ) : (
              <Flashlight className="w-4 h-4" />
            )}
            <span className="text-[10px] font-mono font-bold hidden md:inline">
              {flashlightMode.toUpperCase()}
            </span>
          </button>

          <button
            onClick={switchCameraFacing}
            className="min-w-11 min-h-11 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-slate-300 border border-white/10 backdrop-blur-md transition-all cursor-pointer"
            title="Switch Front/Back Camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          <button
            onClick={handleQuickSnapshot}
            className="min-w-11 min-h-11 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-slate-300 border border-white/10 backdrop-blur-md transition-all cursor-pointer"
            title="Quick Snapshot (Manual Observation)"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-black/60 hover:bg-black/80 text-slate-300 border border-white/10 backdrop-blur-md transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Multi-Target Tactical Center-Lock HUD Widget */}
      {centerLock && (
        <div className="absolute top-16 right-3 sm:right-4 z-30 pointer-events-auto bg-slate-950/90 border border-amber-500/80 rounded-xl p-3 shadow-2xl backdrop-blur-md font-mono animate-in fade-in slide-in-from-top-2 max-w-[290px] border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/30">
            <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold">
              <Target className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>MULTI-TARGET LOCK ({centerLock.totalCandidates})</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              PRIORITY #1
            </span>
          </div>

          <div className="mt-2 text-[11px] space-y-1.5">
            <div className="flex items-start justify-between gap-2 text-slate-300">
              <span className="text-slate-400 text-[10px]">Center-Most Target:</span>
              <span className="font-bold text-amber-200 text-right truncate max-w-[150px]">
                {centerLock.label}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 text-[10px]">Offset from Center:</span>
              <span className="font-mono text-cyan-300 font-bold">
                {centerLock.distPercent.toFixed(1)}% ({centerLock.cxPercent.toFixed(0)}%, {centerLock.cyPercent.toFixed(0)}%)
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 text-[10px]">Focal Auto-Zoom:</span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  centerLock.isAutoZoomActive ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {centerLock.isAutoZoomActive ? (
                  <>
                    <Focus className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>{zoomLevel}x ACTIVE</span>
                  </>
                ) : (
                  'DISABLED'
                )}
              </span>
            </div>
          </div>

          {/* Quick Zoom Multiplier Selector & Reset */}
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-1.5 text-[10px]">
            <span className="text-slate-400">Zoom Magnify:</span>
            <div className="flex items-center gap-1">
              {[1.25, 1.45, 1.75].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => {
                    setZoomLevel(lvl);
                    if (autoZoomEnabled) setCurrentZoom(lvl);
                  }}
                  className={`px-1.5 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                    zoomLevel === lvl
                      ? 'bg-amber-500 text-black shadow'
                      : 'bg-black/60 text-slate-300 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  {lvl}x
                </button>
              ))}
              <button
                onClick={() => {
                  setAutoZoomEnabled((prev) => !prev);
                  soundAlarm.playScanTick();
                }}
                className={`px-1.5 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                  autoZoomEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-800 text-slate-400'
                }`}
                title="Toggle Auto-Zoom"
              >
                {autoZoomEnabled ? 'Auto' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Zoom Reset Button if zoomed */}
      {currentZoom > 1 && !isDrawingMask && (
        <div className="absolute bottom-24 sm:bottom-28 left-3 sm:left-5 z-30 pointer-events-auto flex items-center gap-2 animate-in fade-in">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-500/50 text-cyan-300 font-mono text-xs flex items-center gap-2 backdrop-blur-md shadow-xl">
            <Focus className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>FOCAL ZOOM: {currentZoom.toFixed(2)}x</span>
            <button
              onClick={() => {
                setCurrentZoom(1.0);
                setAutoZoomEnabled(false);
              }}
              className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
              title="Reset to 1.0x"
            >
              1.0x Reset
            </button>
          </div>
        </div>
      )}

      {/* Model Loading State */}
      {modelLoading && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
          <h4 className="text-sm font-bold text-slate-100 font-mono">INITIALIZING CAMERA DETECTION MODEL</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Compiling on-device neural weights for camera optical detection...
          </p>
        </div>
      )}

      {/* Model Error */}
      {modelError && (
        <div className="absolute inset-0 z-40 bg-black/90 p-6 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
          <h4 className="text-base font-bold text-red-400">Object Detection Model Unavailable</h4>
          <p className="text-xs text-slate-300 mt-2 max-w-md bg-red-950/40 p-3 rounded-lg border border-red-800 font-mono text-left">
            {modelError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload & Retry</span>
          </button>
        </div>
      )}

      {/* Camera Error */}
      {cameraError && (
        <div className="absolute inset-0 z-40 bg-black/90 p-6 flex flex-col items-center justify-center text-center">
          <CameraOff className="w-10 h-10 text-amber-500 mb-3" />
          <h4 className="text-base font-bold text-amber-300">Camera Feed Not Available</h4>
          <p className="text-xs text-slate-300 mt-2 max-w-md bg-amber-950/40 p-3 rounded-lg border border-amber-800/50">
            {cameraError}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleStartScan}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Camera Permission</span>
            </button>
          </div>
        </div>
      )}

      {/* Save Drawn Ignore Mask Prompt Modal */}
      {pendingMask && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/70 rounded-2xl p-4 sm:p-5 max-w-sm w-full shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-sm font-bold text-amber-300 font-mono flex items-center gap-2">
                <ShieldOff className="w-4 h-4 text-amber-400" />
                <span>SAVE IGNORE MASK</span>
              </h4>
              <button
                onClick={() => setPendingMask(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select category or label for this region ({Math.round(pendingMask.widthPercent)}% ×{' '}
              {Math.round(pendingMask.heightPercent)}% of view):
            </p>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                '🪟 Window Glass',
                '🪞 Wall Mirror',
                '🖥️ TV / Screen',
                '🖼️ Picture Frame',
                '⏰ Wall Clock',
                '✨ Shiny Surface',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPendingLabel(preset)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                    pendingLabel === preset
                      ? 'bg-amber-500 text-black font-bold border border-amber-300'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={pendingLabel}
              onChange={(e) => setPendingLabel(e.target.value)}
              placeholder="Or enter custom label..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingMask(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddIgnoreMask({
                    ...pendingMask,
                    label: pendingLabel.trim() || `Zone #${ignoreMasks.length + 1}`,
                  });
                  setPendingMask(null);
                  soundAlarm.playScanTick();
                }}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Save Mask
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual snapshot control; distinct from camera alerts. */}
      <div className="hidden sm:flex absolute right-3 sm:right-5 bottom-24 sm:bottom-28 z-30 pointer-events-auto flex-col items-end gap-1.5 animate-in fade-in">
        <button
          onClick={handleQuickSnapshot}
          className="group relative flex items-center gap-2.5 px-4 py-2.5 sm:px-4.5 sm:py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-mono text-xs sm:text-sm font-bold border border-slate-700 hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
          title="Save a manual snapshot; this does not trigger a camera alert"
          aria-label="Save manual snapshot"
        >
          <div className="p-1 rounded-lg bg-black/30 border border-white/10">
            <Camera className="w-4 h-4 text-white group-hover:rotate-6 transition-transform" />
          </div>

          <div className="flex flex-col text-left leading-tight">
            <span className="tracking-wide">SAVE SNAPSHOT</span>
            <span className="text-[9px] font-sans font-normal text-slate-400 uppercase tracking-tighter opacity-90 hidden sm:inline">
              Manual image · no alert
            </span>
          </div>

          <Bookmark className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </button>
      </div>

      {/* Snapshot Saved Feedback Toast Overlay */}
      {snapshotFeedback?.show && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-emerald-500/60 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          {snapshotFeedback.previewUrl && (
            <img
              src={snapshotFeedback.previewUrl}
              alt="Snapshot frame preview"
              className="w-10 h-10 object-cover rounded-lg border border-emerald-500/40 bg-black shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Snapshot Captured</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {snapshotFeedback.message}
            </p>
          </div>
          <button
            onClick={() => setSnapshotFeedback(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 z-30 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-5 flex items-center justify-between gap-1 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => onSetAlarmEnabled(!settings.audioAlarmEnabled)}
            className={`p-2.5 rounded-xl border backdrop-blur-md transition-all cursor-pointer ${
              settings.audioAlarmEnabled
                ? 'bg-slate-900/80 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900/80 text-slate-500 border-slate-700'
            }`}
            title={settings.audioAlarmEnabled ? 'Mute alarm' : 'Unmute alarm'}
          >
            {settings.audioAlarmEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={cycleFlashlightMode}
            className={`hidden sm:flex min-h-[44px] px-3.5 py-2 rounded-xl border backdrop-blur-md font-mono text-xs font-bold tracking-wide items-center gap-2 transition-all cursor-pointer ${
              flashlightMode === 'steady'
                ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/40'
                : flashlightMode === 'strobe'
                ? 'bg-amber-400 text-black border-amber-300 shadow-lg shadow-amber-400/50 animate-pulse'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
            title="Toggle Flashlight (Off / Steady / 5Hz Strobe)"
          >
            {flashlightMode === 'off' ? (
              <FlashlightOff className="w-4 h-4 text-slate-400" />
            ) : flashlightMode === 'strobe' ? (
              <Zap className="w-4 h-4 text-black animate-bounce" />
            ) : (
              <Flashlight className="w-4 h-4 text-black" />
            )}
            <span className="hidden sm:inline">
              {flashlightMode === 'off' ? 'LIGHT: OFF' : flashlightMode === 'steady' ? 'STEADY' : 'STROBE'}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={manualInspectionMode}
            onClick={() => setManualInspectionMode((enabled) => !enabled)}
            className={`min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl border backdrop-blur-md font-mono text-[10px] sm:text-xs font-bold tracking-wide flex items-center gap-1.5 transition-all cursor-pointer ${
              manualInspectionMode
                ? 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/30'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
            title="Manual sweep checks visible frames for bright reflections and aperture-like spots. These cues are not camera identification."
          >
            <Eye className="w-4 h-4" />
            <span>MANUAL SWEEP{manualInspectionMode ? ' ON' : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleLoadCameraModel()}
            disabled={cameraModelStatus === 'loading' || cameraModelStatus === 'ready'}
            className={`min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl border font-mono text-[10px] sm:text-xs font-bold tracking-wide flex items-center gap-1.5 transition-all ${
              cameraModelStatus === 'ready'
                ? 'bg-emerald-700/90 text-white border-emerald-400/70 cursor-default'
                : cameraModelStatus === 'loading'
                ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-wait'
                : 'bg-sky-950/90 text-sky-200 border-sky-500/70 hover:bg-sky-900 cursor-pointer'
            }`}
            title="Downloads about 230 MB of open-vocabulary model weights for best-effort detection of visible camera-like objects. It cannot identify every hidden camera."
          >
            <Download className="w-4 h-4" />
            <span>
              {cameraModelStatus === 'ready'
                ? 'CAMERA MODEL ON'
                : cameraModelStatus === 'loading'
                ? cameraModelProgress >= 100
                  ? 'PREPARING MODEL…'
                  : `DOWNLOADING ${Math.round(cameraModelProgress)}%`
                : cameraModelStatus === 'error'
                ? 'RETRY CAMERA MODEL'
                : 'LOAD CAMERA MODEL'}
            </span>
          </button>
        </div>

        {/* Primary START / STOP SCAN Toggle Button */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => {
              if (isScanning) {
                setIsScanning(false);
                stopCamera();
              } else {
                void handleStartScan();
              }
              setIsPaused(false);
            }}
            disabled={isCameraStarting}
            className={`min-h-[48px] px-3 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-sm font-bold tracking-wide sm:tracking-wider flex items-center gap-1.5 sm:gap-2.5 shadow-xl transition-all cursor-pointer ${
              isScanning
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/60 active:scale-95'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 active:scale-95'
            }`}
          >
            {isScanning ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span className="sm:hidden">STOP</span>
                <span className="hidden sm:inline">STOP SCAN</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span className="sm:hidden">{isCameraStarting ? 'WAIT' : 'START'}</span>
                <span className="hidden sm:inline">
                  {isCameraStarting ? 'CONNECTING CAMERA…' : 'START SCAN'}
                </span>
              </>
            )}
          </button>
          {isScanning && (
          <button
            onClick={() => {
              const nextPaused = !isPaused;
              if (nextPaused) {
                setThreatActive(false);
                lastDetectionsRef.current = [];
                cameraPredictionsRef.current = [];
                lastCameraInferenceTimeRef.current = 0;
                setFps(0);
                fpsRef.current = 0;
                frameCount.current = 0;
                onThreatDetected([]);
              }
              setIsPaused(nextPaused);
              soundAlarm.playScanTick();
            }}
              className="min-h-[48px] px-2 sm:px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-2 cursor-pointer"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
              <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>
          )}
        </div>
        {cameraModelError && (
          <div role="alert" className="absolute bottom-16 left-3 z-40 max-w-[min(30rem,90%)] rounded-lg border border-red-500/60 bg-red-950/95 px-3 py-2 text-xs text-red-200 shadow-xl">
            Camera model unavailable: {cameraModelError}
          </div>
        )}

        <div className="hidden sm:flex pointer-events-auto items-center gap-2">
          {/* Draw Ignore Mask quick access in bottom bar */}
          <button
            onClick={() => onToggleDrawingMask()}
            className={`min-h-[44px] px-3 py-2 rounded-xl border backdrop-blur-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isDrawingMask
                ? 'bg-amber-500 text-black border-amber-400 shadow-md ring-2 ring-amber-300 animate-pulse'
                : 'bg-slate-900/80 text-amber-300 border-amber-500/40 hover:bg-slate-800'
            }`}
            title="Draw Ignore Mask to skip mirrors/windows"
          >
            <ShieldOff className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">{isDrawingMask ? 'DRAWING' : 'MASK'}</span>
          </button>

          <button
            onClick={handleQuickSnapshot}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 backdrop-blur-md transition-all cursor-pointer"
            title="Quick Snapshot (Manual Observation)"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
