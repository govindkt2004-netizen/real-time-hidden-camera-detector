import React, { useState, useEffect } from 'react';
import {
  Compass,
  Radio,
  Eye,
  Zap,
  Sparkles,
  Sliders,
  Volume2,
  VolumeX,
  Gauge,
  AlertTriangle,
  Shield,
  Layers,
} from 'lucide-react';
import { emfSensor, EMFReading } from '../services/emfSensor';

interface Props {
  sensorGain: number;
  onSetSensorGain: (gain: number) => void;
  irDetectionEnabled: boolean;
  onToggleIR: () => void;
  pinholeDetectionEnabled: boolean;
  onTogglePinhole: () => void;
}

export const MultiSensorHub: React.FC<Props> = ({
  sensorGain,
  onSetSensorGain,
  irDetectionEnabled,
  onToggleIR,
  pinholeDetectionEnabled,
  onTogglePinhole,
}) => {
  const [emfData, setEmfData] = useState<EMFReading>(emfSensor.getReading());
  const [geigerAudio, setGeigerAudio] = useState<boolean>(false);
  const [calibrating, setCalibrating] = useState<boolean>(false);

  useEffect(() => {
    emfSensor.setSensitivity(sensorGain);
  }, [sensorGain]);

  useEffect(() => {
    const unsub = emfSensor.subscribe(setEmfData);
    return () => unsub();
  }, []);

  const toggleGeiger = () => {
    const next = !geigerAudio;
    setGeigerAudio(next);
    emfSensor.setAudioGeiger(next);
  };

  const handleRequestPermissions = async () => {
    setCalibrating(true);
    await emfSensor.requestPermissions();
    setTimeout(() => setCalibrating(false), 800);
  };

  // EMF Radiation bar percentage (0 to 200 µT scale)
  const emfPercent = Math.min(100, Math.max(5, (emfData.magnitude / 180) * 100));

  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 text-slate-200 shadow-xl space-y-4">
      {/* Header with High-Gain Sensor Mode Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
              High-Capacity Multi-Sensor Array
            </h3>
            <p className="text-xs text-slate-400">
              Sensor fusion combining Optical ML, Magnetometer (EMF), and Infrared (IR) spectrum analyzers.
            </p>
          </div>
        </div>

        {/* Sensor Gain Boost Selector (1x, 2x, 5x Ultra-Sensor) */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase hidden md:inline">
            Sensor Capacity Gain:
          </span>
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs">
            {[
              { val: 1.0, label: '1x Normal' },
              { val: 2.5, label: '2.5x High' },
              { val: 5.0, label: '5x Ultra Boost' },
            ].map((g) => (
              <button
                key={g.val}
                onClick={() => onSetSensorGain(g.val)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  sensorGain === g.val
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: EMF Circuit Radiation Prober + Optical Spectrum Detectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Electromagnetic Field (EMF / Magnetometer) Meter */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold text-slate-200 font-mono">
                EMF Circuit Prober (Magnetometer)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleGeiger}
                className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                  geigerAudio
                    ? 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
                title="Geiger counter acoustic click ticker"
              >
                {geigerAudio ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Geiger Tick</span>
              </button>

              <button
                onClick={handleRequestPermissions}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 border border-slate-700 cursor-pointer"
              >
                {calibrating ? 'Calibrating...' : 'Calibrate'}
              </button>
            </div>
          </div>

          {/* Real-time Value in microteslas */}
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                {emfData.magnitude}
              </span>
              <span className="text-sm font-mono text-slate-400 ml-1.5">µT (microteslas)</span>
            </div>

            <span
              className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                emfData.threatLevel === 'HIGH_CIRCUIT_DANGER'
                  ? 'bg-red-950/80 border-red-500 text-red-400 animate-pulse'
                  : emfData.threatLevel === 'ELEVATED'
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                  : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {emfData.threatLevel === 'HIGH_CIRCUIT_DANGER'
                ? 'CIRCUIT RADIATION DETECTED'
                : emfData.threatLevel === 'ELEVATED'
                ? 'ELEVATED MAGNETIC FLUX'
                : 'AMBIENT BASELINE'}
            </span>
          </div>

          {/* EMF Gradient Gauge Bar */}
          <div className="space-y-1">
            <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  emfData.threatLevel === 'HIGH_CIRCUIT_DANGER'
                    ? 'bg-gradient-to-r from-amber-500 to-red-500 shadow-[0_0_12px_#ef4444]'
                    : emfData.threatLevel === 'ELEVATED'
                    ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${emfPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0 µT (Clean)</span>
              <span>45 µT (Earth Field)</span>
              <span>120+ µT (Powered CMOS/Spy Camera)</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Hold phone within 2–5cm of suspicious wall sockets, clocks, or smoke detectors. Energized hidden camera circuitry emits high magnetic spikes.
          </p>
        </div>

        {/* 2. Infrared (IR) & Pinhole Micro-Aperture Sensor Toggles */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200 font-mono">
                Optical Spectrum Filters
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
              REAL-TIME VISION
            </span>
          </div>

          {/* IR Emitter Sensor Card */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                <span>850nm / 940nm IR Sensor</span>
                {irDetectionEnabled && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-950 text-amber-400 rounded">ON</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Detects night-vision infrared surveillance LEDs in dark rooms.
              </p>
            </div>

            <button
              onClick={onToggleIR}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                irDetectionEnabled ? 'bg-amber-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  irDetectionEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Micro-Aperture Pinhole Sensor Card */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                <span>Micro-Aperture Pinhole Sensor</span>
                {pinholeDetectionEnabled && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-red-950 text-red-400 rounded">ON</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Isolates deep optical cavities hidden in screws and grilles.
              </p>
            </div>

            <button
              onClick={onTogglePinhole}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                pinholeDetectionEnabled ? 'bg-red-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  pinholeDetectionEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Hardware Capacity: Full Optical Multi-Sensor</span>
            <span>Boost: {sensorGain}x</span>
          </div>
        </div>
      </div>
    </div>
  );
};
