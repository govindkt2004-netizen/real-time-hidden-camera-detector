import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Flashlight,
  FlashlightOff,
  Volume2,
  VolumeX,
  Play,
  Square,
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
import { detectorService, DetectionResult } from '../services/detector';
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
    threatDetected: boolean;
    threatCount: number;
    highestThreatLabel?: string;
    fps: number;
    ignoredThreatsCount?: number;
  }) => void;
  onSaveIncident: (incident: ScanIncident) => void;
  flashlightMode: FlashlightMode;
  onSetFlashlightMode: (mode: FlashlightMode) => void;
  screenIlluminator: boolean;
  onToggleScreenIlluminator: () => void;
  onHardwareTorchStatusChange?: (hasTorch: boolean) => void;
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

  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const [modelLoading, setModelLoading] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const [lastDetections, setLastDetections] = useState<DetectionResult[]>([]);
  const [fps, setFps] = useState<number>(0);
  const [threatActive, setThreatActive] = useState<boolean>(false);

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
  const [simulatedMultiThreats, setSimulatedMultiThreats] = useState<boolean>(false);

  // Mutable refs for frame loop
  const autoZoomEnabledRef = useRef<boolean>(true);
  const zoomLevelRef = useRef<number>(1.45);
  const simulatedMultiThreatsRef = useRef<boolean>(false);
  const isDrawingMaskRef = useRef<boolean>(isDrawingMask);

  useEffect(() => {
    autoZoomEnabledRef.current = autoZoomEnabled;
  }, [autoZoomEnabled]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    simulatedMultiThreatsRef.current = simulatedMultiThreats;
  }, [simulatedMultiThreats]);

  useEffect(() => {
    isDrawingMaskRef.current = isDrawingMask;
  }, [isDrawingMask]);

  // Keep a ref of ignoreMasks so main processing loop always reads latest masks without tearing down RAF
  const ignoreMasksRef = useRef<IgnoreMask[]>(ignoreMasks);
  useEffect(() => {
    ignoreMasksRef.current = ignoreMasks;
  }, [ignoreMasks]);

  const streamRef = useRef<MediaStream | null>(null);
  const animFrameId = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(performance.now());
  const frameCount = useRef<number>(0);
  const lastThreatLoggedTime = useRef<number>(0);

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
    setCameraError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) is not supported in this browser environment. Ensure HTTPS is used.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check torch capability on camera track
      const track = stream.getVideoTracks()[0];
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
    } catch (err: unknown) {
      console.error('Camera stream error:', err);
      let message = 'Unable to access camera.';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Camera permission denied. Please allow camera permissions in your browser address bar.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No video camera detected on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Camera is already in use by another application or tab.';
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setCameraError(message);
    }
  }, [facingMode, onHardwareTorchStatusChange]);

  // Launch camera when facing mode changes
  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      soundAlarm.stopAlarm();
    };
  }, [startCamera]);

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

  // Capture Snapshot Frame for Evidence / Quick Snapshot Manual Observation
  const captureEvidenceSnapshot = (isHighPriorityManual: boolean = false) => {
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

    const highest = lastDetections.find((d) => d.threatLevel === 'DANGER') || lastDetections[0];

    const incident: ScanIncident = {
      id: `incident_${Date.now()}`,
      timestamp: Date.now(),
      threatClass: isHighPriorityManual ? 'MANUAL_OBSERVATION' : (highest ? highest.class : 'SWEEP_SNAPSHOT'),
      threatLabel: isHighPriorityManual
        ? (highest ? `Manual Observation: ${highest.label}` : 'Manual Observation (High Priority)')
        : (highest ? highest.label : 'Camera Evidence Snapshot'),
      confidence: highest ? highest.score : 1.0,
      snapshotDataUrl: dataUrl,
      priority: isHighPriorityManual ? 'HIGH' : (highest?.threatLevel === 'DANGER' ? 'HIGH' : 'MEDIUM'),
      isManualObservation: isHighPriorityManual,
      notes: isHighPriorityManual
        ? `High-priority manual snapshot logged by operator during active optical sweep. Facing: ${facingMode}, Torch: ${flashlightMode}.`
        : `Captured via ${facingMode} camera with flashlight: ${flashlightMode}`,
    };

    onSaveIncident(incident);
    soundAlarm.playScanTick();

    // Trigger visual toast feedback
    if (snapshotToastTimerRef.current) {
      clearTimeout(snapshotToastTimerRef.current);
    }
    setSnapshotFeedback({
      show: true,
      previewUrl: dataUrl,
      message: isHighPriorityManual
        ? 'Quick Snapshot saved to Incident History (HIGH PRIORITY)'
        : 'Snapshot saved to Security History',
    });
    snapshotToastTimerRef.current = window.setTimeout(() => {
      setSnapshotFeedback(null);
    }, 3200);
  };

  const handleQuickSnapshot = () => {
    captureEvidenceSnapshot(true);
  };

  // Main Detection Loop: Camera-Only Processing with Ignore Mask Exclusion
  useEffect(() => {
    let isRunning = true;

    const processFrame = async () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const container = containerRef;

      if (video && canvas && video.readyState >= 2 && isScanning && modelReady) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          try {
            // Run genuine multi-scale camera detection model
            const predictions = await detectorService.detect(video, settings.sensitivity);

            // Inject simulated multi-candidate test targets if operator test mode is active
            if (simulatedMultiThreatsRef.current) {
              const testCandidates: DetectionResult[] = [
                {
                  bbox: [
                    canvas.width * 0.44,
                    canvas.height * 0.40,
                    canvas.width * 0.16,
                    canvas.height * 0.20,
                  ],
                  class: 'camera',
                  score: 0.96,
                  threatLevel: 'DANGER',
                  label: 'CONCEALED PINHOLE LENS',
                  isCameraTarget: true,
                },
                {
                  bbox: [
                    canvas.width * 0.12,
                    canvas.height * 0.62,
                    canvas.width * 0.18,
                    canvas.height * 0.22,
                  ],
                  class: 'cell phone',
                  score: 0.88,
                  threatLevel: 'DANGER',
                  label: 'MOBILE RECORDING SENSOR',
                  isCameraTarget: true,
                },
              ];
              predictions.push(...testCandidates);
            }

            setLastDetections(predictions);

            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;
            const cw = container ? container.clientWidth : 640;
            const ch = container ? container.clientHeight : 480;
            const currentMasks = ignoreMasksRef.current;

            let skippedByMaskCount = 0;

            // Filter ONLY genuine camera threats AND SKIP anything inside ignore masks
            const cameraThreats = predictions.filter((p) => {
              if (!p.isCameraTarget || p.threatLevel !== 'DANGER') return false;

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

                setZoomOrigin({ x: originXPercent, y: originYPercent });
                if (willAutoZoom) {
                  setCurrentZoom(zoomLevelRef.current);
                } else {
                  setCurrentZoom(1.0);
                }
              }
            } else {
              // 0 or 1 threat - neutral framing
              setCurrentZoom(1.0);
              setZoomOrigin({ x: 50, y: 50 });
            }

            setCenterLock(lockData);

            const hasCamera = cameraThreats.length > 0;
            setThreatActive(hasCamera);

            if (hasCamera) {
              soundAlarm.triggerAlarmSequence();
              onThreatDetected(cameraThreats);

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
                  notes: cameraThreats.length > 1
                    ? `Multi-target scene (${cameraThreats.length} detected). Center Priority: ${top.label} at ${(top.score * 100).toFixed(1)}%`
                    : `Camera Identified: ${top.label} at ${(top.score * 100).toFixed(1)}% confidence`,
                });
              }
            } else {
              soundAlarm.stopAlarm();
            }

            // Draw Overlays: Highlights center-most candidate when multiple are identified
            drawOverlays(ctx, canvas.width, canvas.height, cameraThreats, predictions, centerMostIndex, lockData);

            // Notify parent
            onStatusChange({
              isScanning: true,
              threatDetected: hasCamera,
              threatCount: cameraThreats.length,
              highestThreatLabel: (centerMostIndex >= 0 ? cameraThreats[centerMostIndex] : cameraThreats[0])?.label,
              fps: fps,
              ignoredThreatsCount: skippedByMaskCount,
            });
          } catch (err) {
            console.warn('Detection cycle error:', err);
          }
        }

        // Real FPS
        frameCount.current++;
        const now = performance.now();
        if (now - lastFrameTime.current >= 1000) {
          setFps(frameCount.current);
          frameCount.current = 0;
          lastFrameTime.current = now;
        }
      } else if (!isScanning) {
        soundAlarm.stopAlarm();
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        onStatusChange({
          isScanning: false,
          threatDetected: false,
          threatCount: 0,
          fps: 0,
        });
      }

      if (isRunning) {
        animFrameId.current = requestAnimationFrame(processFrame);
      }
    };

    animFrameId.current = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
      soundAlarm.stopAlarm();
    };
  }, [
    isScanning,
    modelReady,
    settings.sensitivity,
    flashlightMode,
    screenIlluminator,
    containerRef,
    fps,
  ]);

  // Render Overlays: Exclusively Red/Gold Bounding Boxes on genuine camera targets
  // Prominently highlights center-most candidate when multiple suspicious objects are identified simultaneously
  const drawOverlays = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    unmaskedThreats: DetectionResult[],
    allPredictions: DetectionResult[],
    centerMostIdx: number = -1,
    lockData: CenterLockInfo | null = null
  ) => {
    const isMultiCandidate = unmaskedThreats.length > 1;
    // 1. Draw Active Threats
    unmaskedThreats.forEach((d, idx) => {
      if (d.isCameraTarget && d.threatLevel === 'DANGER') {
        const [x, y, w, h] = d.bbox;
        const isCenterMost = isMultiCandidate && idx === centerMostIdx;

        ctx.save();

        if (isCenterMost) {
          // Vibrant Gold / Amber Tactical Bounding Box with Cyan accents for Center-Most candidate
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 22;
          ctx.strokeRect(x, y, w, h);
        } else if (isMultiCandidate) {
          // Secondary candidate dashed styling
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([]);
        } else {
          // Single candidate standard danger box
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 16;
          ctx.strokeRect(x, y, w, h);
        }

        // Reticle Corner Brackets & Optical Crosshairs
        const cornerSize = isCenterMost ? Math.min(32, w / 3, h / 3) : Math.min(24, w / 4, h / 4);
        ctx.lineWidth = isCenterMost ? 6 : isMultiCandidate ? 3.5 : 5.5;
        ctx.strokeStyle = isCenterMost ? '#38bdf8' : '#ef4444';
        if (isCenterMost) ctx.shadowColor = '#38bdf8';

        // Top-left
        ctx.beginPath();
        ctx.moveTo(x, y + cornerSize);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerSize, y);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(x + w - cornerSize, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + cornerSize);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x, y + h - cornerSize);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + cornerSize, y + h);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x + w - cornerSize, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - cornerSize);
        ctx.stroke();

        // Center Optical Crosshairs (+) for Center-Most candidate
        if (isCenterMost) {
          const cx = x + w / 2;
          const cy = y + h / 2;
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#38bdf8';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(cx - 22, cy);
          ctx.lineTo(cx - 7, cy);
          ctx.moveTo(cx + 7, cy);
          ctx.lineTo(cx + 22, cy);
          ctx.moveTo(cx, cy - 22);
          ctx.lineTo(cx, cy - 7);
          ctx.moveTo(cx, cy + 7);
          ctx.lineTo(cx, cy + 22);
          ctx.stroke();

          // Concentric Reticle Lock Ring
          const radius = Math.min(24, Math.min(w, h) * 0.28);
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Center Bullseye Dot
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
        }

        // Tactical HUD Tag above object
        if (isCenterMost) {
          const mainTag = `🎯 PRIORITY // CENTER LOCK: ${d.label} ${(d.score * 100).toFixed(0)}%`;
          const subTag = `ΔCENTER: ${lockData?.distPercent.toFixed(1)}% · ${
            lockData?.isAutoZoomActive ? `AUTO-ZOOM ${zoomLevelRef.current}x` : 'FOCAL TARGET'
          }`;

          ctx.font = 'bold 12px JetBrains Mono, monospace';
          const tm1 = ctx.measureText(mainTag);
          ctx.font = '10px JetBrains Mono, monospace';
          const tm2 = ctx.measureText(subTag);
          const tagWidth = Math.max(tm1.width, tm2.width) + 20;
          const tagHeight = 36;
          const tagY = Math.max(0, y - tagHeight - 6);

          ctx.fillStyle = '#b45309';
          ctx.fillRect(x, tagY, tagWidth, tagHeight);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, tagY, tagWidth, tagHeight);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.fillText(mainTag, x + 8, tagY + 15);

          ctx.fillStyle = '#fef08a';
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.fillText(subTag, x + 8, tagY + 29);
        } else if (isMultiCandidate) {
          const tagText = `⚠️ SECONDARY #${idx + 1}: ${d.label} ${(d.score * 100).toFixed(0)}%`;
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          const textMetrics = ctx.measureText(tagText);
          const tagHeight = 22;
          const tagWidth = textMetrics.width + 16;
          const tagY = Math.max(0, y - tagHeight - 4);

          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(x, tagY, tagWidth, tagHeight);
          ctx.fillStyle = '#fca5a5';
          ctx.fillText(tagText, x + 8, tagY + 15);
        } else {
          const tagText = `⚠️ DANGER: ${d.label} ${(d.score * 100).toFixed(0)}%`;
          ctx.font = 'bold 12px JetBrains Mono, monospace';
          const textMetrics = ctx.measureText(tagText);
          const tagHeight = 24;
          const tagWidth = textMetrics.width + 18;
          const tagY = Math.max(0, y - tagHeight - 5);

          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(x, tagY, tagWidth, tagHeight);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tagText, x + 9, tagY + 16);
        }

        ctx.restore();
      }
    });

    // 2. Subtle visual feedback for detections shielded by Ignore Masks (informative, non-alarming)
    allPredictions.forEach((d) => {
      if (d.isIgnored) {
        const [x, y, w, h] = d.bbox;
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        const tag = '🛡️ SKIPPED BY MASK';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(x, Math.max(0, y - 18), 130, 18);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(tag, x + 5, Math.max(0, y - 5));
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
        isFullscreen ? 'h-screen w-screen rounded-none border-none' : 'aspect-video min-h-[380px] max-h-[70vh]'
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

      {/* Screen perimeter light ring for low-light retroreflection */}
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

      {/* Red screen flash only when an actual unmasked camera is detected */}
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
      <div className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/85 via-black/40 to-transparent">
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {threatActive ? (
            <div className="px-3.5 py-1.5 rounded-full bg-red-600 text-white font-mono text-xs font-bold tracking-wider flex items-center gap-1.5 shadow-lg shadow-red-900/60 animate-bounce">
              <AlertTriangle className="w-4 h-4" />
              <span>DANGER: POTENTIAL CAMERA DETECTED</span>
            </div>
          ) : isScanning ? (
            <div className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-semibold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>SCANNING</span>
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
          </div>

          {ignoreMasks.length > 0 && (
            <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-amber-300 px-2.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/40">
              <ShieldOff className="w-3 h-3 text-amber-400" />
              <span>{ignoreMasks.length} Masks Active</span>
            </div>
          )}
        </div>

        {/* Quick HUD controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Auto-Center Focal Zoom Toggle */}
          <button
            onClick={() => {
              setAutoZoomEnabled((prev) => !prev);
              soundAlarm.playScanTick();
            }}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer flex items-center gap-1.5 ${
              autoZoomEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/50'
                : 'bg-black/60 text-slate-400 border-white/10 hover:bg-black/80'
            }`}
            title={`Auto-Center Zoom on Multi-Candidate: ${autoZoomEnabled ? 'ON' : 'OFF'}`}
          >
            <Focus className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-mono font-bold hidden md:inline">
              {autoZoomEnabled ? `AUTO-ZOOM` : 'ZOOM OFF'}
            </span>
          </button>

          {/* Test Multi-Candidate Toggle (Simulate 2 suspicious cameras to test center-lock & auto-zoom) */}
          <button
            onClick={() => {
              setSimulatedMultiThreats((prev) => !prev);
              soundAlarm.playScanTick();
            }}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer flex items-center gap-1.5 ${
              simulatedMultiThreats
                ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/40 animate-pulse font-bold'
                : 'bg-black/60 text-slate-300 border-white/10 hover:bg-black/80'
            }`}
            title={
              simulatedMultiThreats
                ? 'Stop Multi-Candidate Test'
                : 'Simulate Dual Suspicious Objects (Test Center-Lock & Auto-Zoom)'
            }
          >
            <Target className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold hidden lg:inline">
              {simulatedMultiThreats ? 'DUAL-TEST ON' : 'TEST DUAL CAM'}
            </span>
          </button>

          {/* Ignore Mask Drawing Toggle */}
          <button
            onClick={() => onToggleDrawingMask()}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer flex items-center gap-1.5 ${
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
            className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer flex items-center gap-1.5 ${
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
            className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-slate-300 border border-white/10 backdrop-blur-md transition-all cursor-pointer"
            title="Switch Front/Back Camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          <button
            onClick={handleQuickSnapshot}
            className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-slate-300 border border-white/10 backdrop-blur-md transition-all cursor-pointer"
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
              onClick={startCamera}
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

      {/* Floating 'Quick Snapshot' Button (High-Priority Manual Observation) */}
      <div className="absolute right-3 sm:right-5 bottom-24 sm:bottom-28 z-30 pointer-events-auto flex flex-col items-end gap-1.5 animate-in fade-in">
        <button
          onClick={handleQuickSnapshot}
          className="group relative flex items-center gap-2.5 px-4 py-2.5 sm:px-4.5 sm:py-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono text-xs sm:text-sm font-extrabold shadow-2xl shadow-red-950/80 border border-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
          title="Quick Snapshot: Manually save frame as High-Priority Manual Observation"
          aria-label="Quick Snapshot manual observation"
        >
          {/* Subtle pulse ring around button */}
          <span className="absolute -inset-1 rounded-2xl bg-red-500/30 blur-sm group-hover:bg-red-500/50 transition-opacity -z-10 animate-pulse" />
          
          <div className="p-1 rounded-lg bg-black/30 border border-white/20">
            <Camera className="w-4 h-4 text-white group-hover:rotate-6 transition-transform" />
          </div>

          <div className="flex flex-col text-left leading-tight">
            <span className="tracking-wide">QUICK SNAPSHOT</span>
            <span className="text-[9px] font-sans font-normal text-amber-200 uppercase tracking-tighter opacity-90 hidden sm:inline">
              High-Priority Observation
            </span>
          </div>

          <Bookmark className="w-3.5 h-3.5 text-amber-300 ml-0.5 fill-current" />
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
      <div className="absolute bottom-0 inset-x-0 z-30 p-3 sm:p-5 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => soundAlarm.setMuted(!soundAlarm.getMuted())}
            className={`p-2.5 rounded-xl border backdrop-blur-md transition-all cursor-pointer ${
              !soundAlarm.getMuted()
                ? 'bg-slate-900/80 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900/80 text-slate-500 border-slate-700'
            }`}
            title={soundAlarm.getMuted() ? 'Audio Alarm Muted' : 'Audio Alarm Active'}
          >
            {!soundAlarm.getMuted() ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={cycleFlashlightMode}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border backdrop-blur-md font-mono text-xs font-bold tracking-wide flex items-center gap-2 transition-all cursor-pointer ${
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
        </div>

        {/* Primary START / STOP SCAN Toggle Button */}
        <div className="pointer-events-auto">
          <button
            onClick={() => {
              soundAlarm.init();
              setIsScanning(!isScanning);
            }}
            className={`min-h-[48px] px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wider flex items-center gap-2.5 shadow-xl transition-all cursor-pointer ${
              isScanning
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/60 active:scale-95'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 active:scale-95'
            }`}
          >
            {isScanning ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>STOP SCAN</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>START SCAN</span>
              </>
            )}
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
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
