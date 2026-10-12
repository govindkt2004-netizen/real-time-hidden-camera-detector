/**
 * Hidden camera detection & Optical Sweep
 * On-device ML visual detection & optical retroreflection scanner with biometric security.
 * Features regional ignore masks to exclude selected areas from candidate reporting.
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CameraScanner } from './components/CameraScanner';
import { DetectionStatusBadge } from './components/DetectionStatusBadge';
import { TelemetryPanel } from './components/TelemetryPanel';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { QuickFlashlightBar, FlashlightMode } from './components/QuickFlashlightBar';
import { IgnoreMaskBar } from './components/IgnoreMaskBar';
import { SettingsModal } from './components/SettingsModal';
import { BiometricModal } from './components/BiometricModal';
import { IncidentLogsModal } from './components/IncidentLogsModal';
import { DetectionResult } from './services/detector';
import { AppSettings, ScanIncident, ThemeMode, IgnoreMask } from './types';
import { Camera, Lock, Sparkles, ShieldOff } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  audioAlarmEnabled: true,
  sensitivity: 'balanced',
  glintDetectionEnabled: true,
  biometricLockEnabled: false,
  cameraFacing: 'environment',
  cameraResolution: 'standard',
  fpsLimit: 15,
  scanPerformance: 'fast',
};

const MOBILE_DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  fpsLimit: 5,
};

export default function App() {
  // App Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const isMobileViewport =
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches;
    const deviceDefaults = isMobileViewport
      ? MOBILE_DEFAULT_SETTINGS
      : DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem('cam_detector_settings');
      if (saved) {
        const stored = JSON.parse(saved) as Partial<AppSettings>;
        const storedFpsLimit = stored.fpsLimit;
        const fpsLimit: AppSettings['fpsLimit'] =
          storedFpsLimit === 5 || storedFpsLimit === 10 || storedFpsLimit === 15
            ? storedFpsLimit
            : deviceDefaults.fpsLimit;
        const scanPerformance =
          stored.scanPerformance === 'detail' ? 'detail' : deviceDefaults.scanPerformance;
        return { ...deviceDefaults, ...stored, fpsLimit, scanPerformance };
      }
    } catch {}
    return deviceDefaults;
  });

  // Recorded Incidents
  const [incidents, setIncidents] = useState<ScanIncident[]>(() => {
    try {
      const saved = localStorage.getItem('cam_detector_incidents');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Ignore Masks (Exclusion zones for windows, mirrors, televisions)
  const [ignoreMasks, setIgnoreMasks] = useState<IgnoreMask[]>(() => {
    try {
      const saved = localStorage.getItem('cam_detector_ignore_masks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [isDrawingMask, setIsDrawingMask] = useState<boolean>(false);
  const [showMaskOverlays, setShowMaskOverlays] = useState<boolean>(true);

  // Scanner status
  const [scanStatus, setScanStatus] = useState<{
    isScanning: boolean;
    threatDetected: boolean;
    threatCount: number;
    highestThreatLabel?: string;
    fps: number;
    ignoredThreatsCount?: number;
  }>({
    isScanning: false,
    threatDetected: false,
    threatCount: 0,
    highestThreatLabel: undefined,
    fps: 0,
    ignoredThreatsCount: 0,
  });

  const [activeDetections, setActiveDetections] = useState<DetectionResult[]>([]);

  // Flashlight & Optical Glint Illuminator State
  const [flashlightMode, setFlashlightMode] = useState<FlashlightMode>('off');
  const [screenIlluminator, setScreenIlluminator] = useState<boolean>(false);
  const [hasHardwareTorch, setHasHardwareTorch] = useState<boolean>(false);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isBiometricPromptOpen, setIsBiometricPromptOpen] = useState(false);
  const [biometricMode, setBiometricMode] = useState<'unlock' | 'enroll'>('unlock');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem('cam_detector_settings', JSON.stringify(settings));
  }, [settings]);

  // Sync incidents to localStorage
  useEffect(() => {
    localStorage.setItem('cam_detector_incidents', JSON.stringify(incidents));
  }, [incidents]);

  // Sync ignore masks to localStorage
  useEffect(() => {
    localStorage.setItem('cam_detector_ignore_masks', JSON.stringify(ignoreMasks));
  }, [ignoreMasks]);

  // Ignore Mask management handlers
  const handleAddIgnoreMask = (mask: IgnoreMask) => {
    setIgnoreMasks((prev) => [...prev, mask]);
  };

  const handleRemoveIgnoreMask = (id: string) => {
    setIgnoreMasks((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClearAllMasks = () => {
    setIgnoreMasks([]);
    localStorage.removeItem('cam_detector_ignore_masks');
  };

  const handleAddQuickPreset = (label: string, position: 'left' | 'right' | 'center') => {
    const newMask: IgnoreMask = {
      id: `mask_${Date.now()}`,
      xPercent: position === 'left' ? 5 : position === 'center' ? 25 : 65,
      yPercent: position === 'center' ? 20 : 15,
      widthPercent: position === 'center' ? 50 : 30,
      heightPercent: position === 'center' ? 60 : 70,
      label,
      enabled: true,
    };
    setIgnoreMasks((prev) => [...prev, newMask]);
  };

  // Handle saving new threat incident
  const handleSaveIncident = (incident: ScanIncident) => {
    setIncidents((prev) => [incident, ...prev.slice(0, 49)]); // Keep latest 50
  };

  // Clear all incidents
  const handleClearIncidents = () => {
    setIncidents([]);
    localStorage.removeItem('cam_detector_incidents');
  };

  // Secure action wrapper requiring biometrics if enabled
  const executeWithAuth = (action: () => void) => {
    if (settings.biometricLockEnabled) {
      setPendingAction(() => action);
      setBiometricMode('unlock');
      setIsBiometricPromptOpen(true);
    } else {
      action();
    }
  };

  const handleBiometricSuccess = () => {
    setIsBiometricPromptOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  // Dynamic Theme Styling
  const themeClasses: Record<ThemeMode, { bg: string; text: string; cardBg: string }> = {
    dark: {
      bg: 'bg-slate-950',
      text: 'text-slate-100',
      cardBg: 'bg-slate-900/90',
    },
    'tactical-red': {
      bg: 'bg-black font-mono',
      text: 'text-red-500',
      cardBg: 'bg-black border border-red-900/60',
    },
    midnight: {
      bg: 'bg-[#050609]',
      text: 'text-slate-100',
      cardBg: 'bg-[#0a0d14]/90',
    },
  };

  const currentTheme = themeClasses[settings.theme] || themeClasses.dark;

  return (
    <div
      className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} flex flex-col selection:bg-red-500 selection:text-white`}
    >
      {/* Navigation Bar */}
      <Navbar
        isBiometricLocked={settings.biometricLockEnabled}
        onOpenSettings={() => executeWithAuth(() => setIsSettingsOpen(true))}
        onOpenAuditLogs={() => executeWithAuth(() => setIsLogsOpen(true))}
        onOpenSweepGuide={() => {
          const banner = document.getElementById('disclaimer-section');
          if (banner) banner.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header Hero Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>Live camera inspection</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              On-device detection for visible phones and laptops that may contain cameras. A device candidate does not confirm its camera or prove a hidden camera.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <DetectionStatusBadge
              isScanning={scanStatus.isScanning}
              threatDetected={scanStatus.threatDetected}
              threatCount={scanStatus.threatCount}
              highestThreatLabel={scanStatus.highestThreatLabel}
            />
          </div>
        </div>

        {/* Live Camera Scanner Viewport */}
        <section id="scanner" className="w-full space-y-3">
          <CameraScanner
            settings={settings}
            onSetAlarmEnabled={(enabled) =>
              setSettings((previous) => ({ ...previous, audioAlarmEnabled: enabled }))
            }
            onThreatDetected={(threats) => {
              setActiveDetections(threats);
            }}
            onStatusChange={(status) => {
              setScanStatus(status);
            }}
            onSaveIncident={handleSaveIncident}
            flashlightMode={flashlightMode}
            onSetFlashlightMode={setFlashlightMode}
            screenIlluminator={screenIlluminator}
            onToggleScreenIlluminator={() => setScreenIlluminator((prev) => !prev)}
            onHardwareTorchStatusChange={setHasHardwareTorch}
            ignoreMasks={ignoreMasks}
            onAddIgnoreMask={handleAddIgnoreMask}
            onRemoveIgnoreMask={handleRemoveIgnoreMask}
            isDrawingMask={isDrawingMask}
            onToggleDrawingMask={(active) =>
              setIsDrawingMask((prev) => (active !== undefined ? active : !prev))
            }
            showMaskOverlays={showMaskOverlays}
            onToggleShowMaskOverlays={() => setShowMaskOverlays((prev) => !prev)}
          />

          {/* Ignore Mask Drawing & Exclusion Toolbar */}
          <IgnoreMaskBar
            isDrawing={isDrawingMask}
            onToggleDrawing={() => setIsDrawingMask((prev) => !prev)}
            masks={ignoreMasks}
            onRemoveMask={handleRemoveIgnoreMask}
            onClearAll={handleClearAllMasks}
            showMaskOverlays={showMaskOverlays}
            onToggleShowMaskOverlays={() => setShowMaskOverlays((prev) => !prev)}
            ignoredCount={scanStatus.ignoredThreatsCount}
            onAddQuickPreset={handleAddQuickPreset}
          />

          {/* Quick-Access Flashlight Control Bar */}
          <QuickFlashlightBar
            mode={flashlightMode}
            hasHardwareTorch={hasHardwareTorch}
            screenIlluminator={screenIlluminator}
            onSetMode={setFlashlightMode}
            onToggleScreenIlluminator={() => setScreenIlluminator((prev) => !prev)}
          />
        </section>

        {/* Real-time Detection Telemetry Radar */}
        <section>
          <TelemetryPanel
            isScanning={scanStatus.isScanning}
            threatDetected={scanStatus.threatDetected}
            detections={activeDetections}
            fps={scanStatus.fps}
            sensitivity={settings.sensitivity}
            ignoreMasksCount={ignoreMasks.length}
            ignoredCount={scanStatus.ignoredThreatsCount}
          />
        </section>

        {/* Mandatory Disclaimer & TSCM Sweep Guide */}
        <section id="disclaimer-section">
          <DisclaimerBanner />
        </section>

        {/* Quick Features & Operational Guide Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 mb-1">
              <Camera className="w-4 h-4 text-red-400" />
              <span>On-Device Object Detection</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              TensorFlow.js COCO-SSD inference runs in your browser. Video stays on this device; its trained labels do not include hidden, pinhole, or miniature cameras.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 mb-1">
              <ShieldOff className="w-4 h-4 text-amber-400" />
              <span>Ignore Mask Regions</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Draw exclusion zones over areas such as windows, mirrors, and screens. Detections in these regions are ignored, which can reduce false alerts but may also hide real candidates there.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2 font-semibold text-sm text-slate-200 mb-1">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Local Detection History</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Detection events are stored in this browser on this device. A saved snapshot is created only when you explicitly request one.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-12 py-6 bg-slate-950/80 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono">
            <span>LOCAL CAMERA INSPECTION</span>
            <span aria-hidden="true">·</span>
            <span>ON-DEVICE OBJECT DETECTION</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => executeWithAuth(() => setIsSettingsOpen(true))}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Settings
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
        onOpenBiometricEnroll={() => {
          setIsSettingsOpen(false);
          setBiometricMode('enroll');
          setIsBiometricPromptOpen(true);
        }}
        onClose={() => setIsSettingsOpen(false)}
      />

      <BiometricModal
        isOpen={isBiometricPromptOpen}
        mode={biometricMode}
        onSuccess={() => {
          if (biometricMode === 'enroll') {
            setSettings((prev) => ({ ...prev, biometricLockEnabled: true }));
          }
          handleBiometricSuccess();
        }}
        onClose={() => {
          setIsBiometricPromptOpen(false);
          setPendingAction(null);
        }}
      />

      <IncidentLogsModal
        isOpen={isLogsOpen}
        incidents={incidents}
        onClear={handleClearIncidents}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
}
