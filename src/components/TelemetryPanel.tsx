import React from 'react';
import { DetectionResult } from '../services/detector';
import { Crosshair, Activity, Camera, ShieldOff, Focus, Target } from 'lucide-react';

interface Props {
  isScanning: boolean;
  cameraModelReady: boolean;
  detections: DetectionResult[];
  fps: number;
  sensitivity: string;
  ignoreMasksCount?: number;
  ignoredCount?: number;
}

export const TelemetryPanel: React.FC<Props> = ({
  isScanning,
  cameraModelReady,
  detections,
  fps,
  sensitivity,
  ignoreMasksCount = 0,
  ignoredCount = 0,
}) => {
  const results = detections.filter((d) => !d.isIgnored);
  const cameraCandidates = results.filter((d) => d.isCameraTarget && d.threatLevel === 'DANGER');
  const observations = results.filter((d) => !d.isCameraTarget);
  const ignoredDetections = detections.filter((d) => d.isIgnored);

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
        {/* Camera-model matches are highlighted; all others remain neutral observations. */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-slate-200 flex items-center gap-1.5 font-mono">
              <Activity className="w-4 h-4 text-sky-400" />
              CAMERA-LIKE CANDIDATES: {cameraCandidates.length} · OTHER OBSERVATIONS: {observations.length}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="py-4 text-center font-mono text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
              <Activity className="w-5 h-5 text-slate-500" />
              <span>{isScanning ? 'No objects or camera-like candidates identified in this frame' : 'Scanner paused'}</span>
              {ignoredDetections.length > 0 && (
                <span className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                  <ShieldOff className="w-3.5 h-3.5" />
                  <span>{ignoredDetections.length} candidate(s) safely ignored in masked zone</span>
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {results.map((d, i) => (
                <div
                  key={`${d.class}-${d.detectedAt}-${i}`}
                  className={`p-2.5 rounded-lg text-xs font-mono ${
                    d.isCameraTarget
                      ? 'bg-red-950/40 border border-red-500/60'
                      : 'bg-slate-900/70 border border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Crosshair className={`w-4 h-4 ${d.isCameraTarget ? 'text-red-400' : 'text-sky-400'}`} />
                      <span className={`font-bold ${d.isCameraTarget ? 'text-red-200' : 'text-slate-200'}`}>
                        {d.label}
                      </span>
                    </span>
                    <span className={`font-bold tabular-nums bg-slate-950/80 px-2 py-0.5 rounded border ${
                      d.isCameraTarget
                        ? 'text-red-300 border-red-800/60'
                        : 'text-sky-300 border-slate-700'
                    }`}>
                      {d.scoreMeaning === 'visual-signal-strength'
                        ? `${(d.score * 100).toFixed(0)}% VISUAL SIGNAL · NOT CAMERA CONFIDENCE`
                        : d.scoreMeaning === 'open-vocabulary-model-score'
                        ? `${(d.score * 100).toFixed(1)}% OPEN-VOCAB SCORE · UNCONFIRMED`
                        : `${(d.score * 100).toFixed(1)}% MODEL SCORE · UNCONFIRMED`}
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
            <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
              cameraModelReady
                ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800/40'
                : 'text-amber-300 bg-amber-950/80 border-amber-800/40'
            }`}>
              {cameraModelReady ? 'CAMERA MODEL READY' : 'CAMERA MODEL NOT LOADED'}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
            <span>Model Architecture:</span>
            <span className="text-slate-200">COCO-SSD + optional Grounding DINO</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
            <span>Target Filter:</span>
            <span className="text-sky-300 font-semibold">COCO: phones · laptops (informational)</span>
          </div>

          <div className="py-1 border-b border-slate-900 text-slate-400">
            {cameraModelReady
              ? 'Grounding DINO uses a general camera text prompt for visible objects; it is not camera-specialist or validated for hidden-device detection. Scores can be wrong.'
              : 'Load the optional camera model in the scanner controls to check for visible camera-like objects. Phone, laptop, reflection, and aperture detections are not camera alerts.'}
          </div>

          <div className="py-1 text-amber-300/90">
            IR analysis unavailable: standard browser video does not expose infrared sensor capability or raw IR data. External IR-sensitive hardware is required.
          </div>

          <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
            <span>Ignore Masks (Exclusion Zones):</span>
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
              {ignoredCount > 0 ? `${ignoredCount} Candidate(s) Ignored` : '0 Ignored'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
