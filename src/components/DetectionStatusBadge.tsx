import React from 'react';
import { AlertTriangle, PauseCircle, Activity } from 'lucide-react';

interface Props {
  isScanning: boolean;
  isPaused?: boolean;
  threatDetected: boolean;
  threatCount: number;
  highestThreatLabel?: string;
  cameraModelReady?: boolean;
}

export const DetectionStatusBadge: React.FC<Props> = ({
  isScanning,
  isPaused = false,
  threatDetected,
  threatCount,
  highestThreatLabel,
  cameraModelReady = false,
}) => {
  if (isPaused) {
    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-mono font-medium shadow-sm">
        <PauseCircle className="w-4 h-4 text-amber-400" />
        <span>SCANNER PAUSED</span>
      </div>
    );
  }

  if (!isScanning) {
    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/60 text-slate-400 text-xs font-mono font-medium shadow-sm">
        <PauseCircle className="w-4 h-4 text-slate-500" />
        <span>STANDBY · SCAN STOPPED</span>
      </div>
    );
  }

  if (threatDetected) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-950/90 border-2 border-red-500 text-red-100 text-xs md:text-sm font-mono font-bold tracking-wider shadow-lg shadow-red-950/50 animate-pulse">
        <AlertTriangle className="w-5 h-5 text-red-400 animate-bounce" />
        <span className="text-red-300">CAMERA DETECTED — VERIFY CANDIDATE</span>
        {highestThreatLabel && (
          <span className="text-red-200/90 hidden sm:inline">[{highestThreatLabel}]</span>
        )}
        <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[11px] font-bold">
          {threatCount} ALERT{threatCount > 1 ? 'S' : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold shadow-sm">
      <Activity className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
      <span className="tracking-wider">SCANNING</span>
      <span className="text-emerald-500/70 text-[11px]">
        · {cameraModelReady ? 'NO CAMERA CANDIDATE' : 'CAMERA MODEL LOADING'}
      </span>
    </div>
  );
};
