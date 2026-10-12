import React from 'react';
import { DetectionResult } from '../services/detector';
import { ShieldAlert, Crosshair, Activity, Camera, ShieldOff, Focus, Target } from 'lucide-react';

interface Props {
  isScanning: boolean;
  threatDetected: boolean;
  detections: DetectionResult[];
  fps: number;
  sensitivity: string;
  ignoreMasksCount?: number;
  ignoredCount?: number;
}

export const TelemetryPanel: React.FC<Props> = ({
  isScanning,
  threatDetected,
  detections,
  fps,
  sensitivity,
  ignoreMasksCount = 0,
  ignoredCount = 0,
}) => {
  const cameraDetections = detections.filter(
    (d) => d.isCameraTarget && d.threatLevel === 'DANGER' && !d.isIgnored
  );
  const ignoredDetections = detections.filter((d) => d.isIgnored);

  // Compute center-most candidate if multiple object candidates exist
  let centerMostIndex = -1;
  if (cameraDetections.length > 1) {
    let minCenterDistSq = Infinity;
    cameraDetections.forEach((d, idx) => {
      const [bx, by, bw, bh] = d.bbox;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const dSq = (cx - d.imageWidth / 2) ** 2 + (cy - d.imageHeight / 2) ** 2;
      if (dSq < minCenterDistSq) {
        minCenterDistSq = dSq;
        centerMostIndex = idx;
      }
    });
  }

  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-4 md:p-5 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
            LIVE OBJECT-DETECTION TELEMETRY
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>
            FPS: <strong className="text-slate-200 tabular-nums">{fps}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            SENSITIVITY: <strong className="text-slate-200 uppercase">{sensitivity}</strong>
          </span>
          {ignoreMasksCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400">
                MASKS: <strong className="tabular-nums">{ignoreMasksCount}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model-supported camera-capable object candidates */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-red-400 flex items-center gap-1.5 font-mono">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              CAMERA-LIKE DEVICE CANDIDATES ({cameraDetections.length})
            </span>
            {threatDetected && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white font-mono font-bold animate-pulse">
                DANGER DETECTED
              </span>
            )}
          </div>

          {cameraDetections.length === 0 ? (
            <div className="py-4 text-center font-mono text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
              <Activity className="w-5 h-5 text-slate-500" />
              <span>{isScanning ? 'No supported object candidates in this frame' : 'Scanner paused'}</span>
              {ignoredDetections.length > 0 && (
                <span className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                  <ShieldOff className="w-3.5 h-3.5" />
                  <span>{ignoredDetections.length} candidate(s) safely ignored in masked zone</span>
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {cameraDetections.map((d, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/50 text-xs font-mono"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-red-400" />
                      <span className="font-bold text-red-200">{d.label}</span>
                    </span>
                    <span className="text-red-400 font-bold tabular-nums bg-red-950/80 px-2 py-0.5 rounded border border-red-800/40">
                      {(d.score * 100).toFixed(1)}% MODEL SCORE
                    </span>
                  </div>
                  <div className="mt-1.5 pl-6 text-[10px] leading-relaxed text-slate-300">
                    {(() => {
                      const [x, y, width, height] = d.bbox;
                      const centerX = ((x + width / 2) / d.imageWidth) * 100;
                      const centerY = ((y + height / 2) / d.imageHeight) * 100;
                      const smallSide = Math.round(Math.min(width, height));
                      return (
                        <>
                          <div>
                            Approx. image center: {centerX.toFixed(0)}%, {centerY.toFixed(0)}%
                            {' · '}
                            {new Date(d.detectedAt).toLocaleTimeString()}
                          </div>
                          {smallSide < 24 && (
                            <div className="mt-1 text-amber-300">
                              Very small in frame ({smallSide}px); not reliably identifiable at this image size. Move closer or use optical zoom.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Optical Sensor Status */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-300 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>ON-DEVICE OBJECT DETECTOR</span>
            </span>
            <span className="text-emerald-400 text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-800/40">
              ACTIVE
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
            <span>Model Architecture:</span>
            <span className="text-slate-200">COCO-SSD MobileNetV2 Lite · tiled inference</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
            <span>Target Filter:</span>
            <span className="text-red-300 font-semibold">Phones and laptops</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
            <span>Ignore Masks (False-Positives):</span>
            <span className="text-amber-300 font-semibold flex items-center gap-1">
              <ShieldOff className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {ignoreMasksCount > 0 ? `${ignoreMasksCount} Active Zone(s)` : 'None (Click Draw Mask)'}
              </span>
            </span>
          </div>

          <div className="flex justify-between py-1 text-slate-400">
            <span>Shielded Detections:</span>
            <span className={ignoredCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
              {ignoredCount > 0 ? `${ignoredCount} False-Alarm(s) Blocked` : '0 Blocked'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
