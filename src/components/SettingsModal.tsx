import React from 'react';
import { AppSettings, ThemeMode } from '../types';
import { soundAlarm } from '../services/audio';
import { BiometricService } from '../services/biometric';
import {
  X,
  Moon,
  Volume2,
  VolumeX,
  Fingerprint,
  Camera,
  Sliders,
  Shield,
  Sun,
  Eye,
  Check,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenBiometricEnroll: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onOpenBiometricEnroll,
  onClose,
}) => {
  if (!isOpen) return null;

  const testAudio = () => {
    soundAlarm.init();
    soundAlarm.playDangerPulse();
  };

  const themes: { id: ThemeMode; label: string; desc: string; previewClass: string }[] = [
    {
      id: 'dark',
      label: 'Standard Dark Security',
      desc: 'Optimized dark interface with high-contrast warning elements',
      previewClass: 'bg-slate-900 border-slate-700 text-slate-200',
    },
    {
      id: 'tactical-red',
      label: 'Tactical Red (0-Lux Night Mode)',
      desc: 'Pure monochrome red on OLED black for low-light viewing',
      previewClass: 'bg-black border-red-800 text-red-500',
    },
    {
      id: 'midnight',
      label: 'Midnight OLED',
      desc: 'Deep black background with muted cobalt accents for low-light battery conservation',
      previewClass: 'bg-[#08090d] border-indigo-950 text-indigo-200',
    },
  ];

  const handleToggleBiometrics = () => {
    if (!settings.biometricLockEnabled) {
      onOpenBiometricEnroll();
    } else {
      BiometricService.removeAuth();
      onUpdateSettings({ biometricLockEnabled: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-red-400" />
            <h3 className="text-base font-bold text-slate-100">Scanner Configuration & Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Low-Light Dark Mode Theme */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Moon className="w-4 h-4 text-red-400" />
              <label className="text-sm font-semibold text-slate-200">
                Low-Light Display Theme
              </label>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Switch themes for low-light room inspection or preserving night vision during darkness sweeps.
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onUpdateSettings({ theme: t.id })}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    settings.theme === t.id
                      ? 'border-red-500 bg-red-950/30'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <div className="pr-3">
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <span>{t.label}</span>
                      {settings.theme === t.id && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-red-600 text-white rounded font-mono">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t.desc}</p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${t.previewClass}`}
                  >
                    {settings.theme === t.id && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Camera Image Quality */}
          {/* Biometric Security */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <label className="text-sm font-semibold text-slate-200">Camera Image Quality</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'standard', label: 'Standard · 1280×720' },
                { value: 'high', label: 'High · 1920×1080' },
              ] as const).map((quality) => (
                <button
                  key={quality.value}
                  onClick={() => onUpdateSettings({ cameraResolution: quality.value })}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    settings.cameraResolution === quality.value
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {quality.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Requests this size from your camera. The browser may provide a different resolution; check the live preview readout.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-slate-200">
                    Biometric Authentication & PIN
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Require Touch ID, Face ID, Windows Hello, or PIN before accessing saved incident logs, snapshots, or settings.
                </p>
              </div>

              <button
                onClick={handleToggleBiometrics}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors shrink-0 cursor-pointer ${
                  settings.biometricLockEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {settings.biometricLockEnabled ? 'PROTECTION ON' : 'ENABLE'}
              </button>
            </div>
          </div>

          {/* Sound Warning Settings */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {settings.audioAlarmEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-200">
                    Danger Warning Sound
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  The alarm only follows camera-prompt matches from Grounding DINO. Manual reflection and aperture observations do not trigger it.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={testAudio}
                  disabled={!settings.audioAlarmEnabled}
                  title={settings.audioAlarmEnabled ? 'Play a test alarm tone' : 'Enable alarm audio to test it'}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] text-slate-300 border border-slate-700 cursor-pointer"
                >
                  Test Alarm
                </button>
                <button
                  onClick={() => onUpdateSettings({ audioAlarmEnabled: !settings.audioAlarmEnabled })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    settings.audioAlarmEnabled ? 'bg-red-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.audioAlarmEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Detection Sensitivity */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-red-400" />
              <label className="text-sm font-semibold text-slate-200">
                AI Detection Sensitivity
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['balanced', 'high', 'strict'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => onUpdateSettings({ sensitivity: lvl })}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize border transition-all cursor-pointer ${
                    settings.sensitivity === lvl
                      ? 'border-red-500 bg-red-950/40 text-red-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {settings.sensitivity === 'balanced' &&
                'Balanced open-vocabulary score threshold (75%). The score is not a calibrated probability or confirmation.'}
              {settings.sensitivity === 'high' &&
                'Lower open-vocabulary score threshold (65%) may find more candidates but can increase false positives. Scores are not calibrated probabilities.'}
              {settings.sensitivity === 'strict' &&
                'Higher open-vocabulary score threshold (85%) returns fewer candidates. A model score is not proof that a device is recording.'}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <label className="text-sm font-semibold text-slate-200">Scan Performance</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'fast', label: 'Fast', detail: 'One full-frame pass' },
                { value: 'detail', label: 'Detail', detail: 'Full frame + 4 camera crops' },
              ] as const).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onUpdateSettings({ scanPerformance: mode.value })}
                  className={`py-2 px-3 rounded-lg text-left border transition-all cursor-pointer ${
                    settings.scanPerformance === mode.value
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs font-semibold">{mode.label}</span>
                  <span className="block mt-0.5 text-[10px] opacity-75">{mode.detail}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Fast mode prioritizes responsiveness. Detail mode runs the camera detector over four overlapping high-resolution crops as well as the full frame; it takes longer and cannot recover detail missing from the camera image.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <label className="text-sm font-semibold text-slate-200">Maximum Inference Rate</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([5, 10, 15] as const).map((fps) => (
                <button
                  key={fps}
                  onClick={() => onUpdateSettings({ fpsLimit: fps })}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    settings.fpsLimit === fps
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              This is a maximum, not a guaranteed rate. Mobile devices start at 5 FPS to reduce heat and battery use; actual speed depends on device performance and scan mode.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
