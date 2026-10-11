import React from 'react';
import {
  Flashlight,
  FlashlightOff,
  Zap,
  SunMedium,
  Monitor,
  Sparkles,
  Info,
} from 'lucide-react';

export type FlashlightMode = 'off' | 'steady' | 'strobe';

interface Props {
  mode: FlashlightMode;
  hasHardwareTorch: boolean;
  screenIlluminator: boolean;
  onSetMode: (mode: FlashlightMode) => void;
  onToggleScreenIlluminator: () => void;
}

export const QuickFlashlightBar: React.FC<Props> = ({
  mode,
  hasHardwareTorch,
  screenIlluminator,
  onSetMode,
  onToggleScreenIlluminator,
}) => {
  const isLightActive = mode !== 'off' || screenIlluminator;

  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 text-slate-200 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Quick-Access Primary Flashlight Button & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSetMode(mode === 'off' ? 'steady' : mode === 'steady' ? 'strobe' : 'off')}
            className={`min-h-[46px] px-4 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-bold tracking-wider flex items-center gap-2.5 transition-all shadow-md cursor-pointer ${
              mode === 'steady'
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30'
                : mode === 'strobe'
                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {mode === 'off' ? (
              <FlashlightOff className="w-4 h-4 text-slate-400" />
            ) : mode === 'strobe' ? (
              <Zap className="w-4 h-4 text-black animate-bounce" />
            ) : (
              <Flashlight className="w-4 h-4 text-black" />
            )}
            <span>
              {mode === 'off'
                ? 'FLASHLIGHT: OFF'
                : mode === 'steady'
                ? 'FLASHLIGHT: STEADY'
                : 'FLASHLIGHT: 5HZ STROBE'}
            </span>
          </button>

          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Optical Glint Illuminator</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {mode === 'strobe'
                ? 'Pulsing light triggers blinking retroreflections from concealed glass lenses'
                : mode === 'steady'
                ? 'Steady beam highlights pinhole aperture recesses in dark rooms'
                : 'Click to illuminate surroundings and catch lens retroreflections'}
            </span>
          </div>
        </div>

        {/* Right: Quick Mode Switchers & Screen Ring Option */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Steady Mode Pill */}
          <button
            onClick={() => onSetMode(mode === 'steady' ? 'off' : 'steady')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              mode === 'steady'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="Continuous steady beam"
          >
            <SunMedium className="w-3.5 h-3.5" />
            <span>Steady</span>
          </button>

          {/* Strobe Mode Pill */}
          <button
            onClick={() => onSetMode(mode === 'strobe' ? 'off' : 'strobe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              mode === 'strobe'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-400 font-bold'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="5Hz strobe pulse for finding optical retroreflections"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>5Hz Strobe</span>
          </button>

          {/* Screen Illuminator Ring for laptops/devices without LED flash */}
          <button
            onClick={onToggleScreenIlluminator}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              screenIlluminator
                ? 'bg-white text-slate-950 font-bold border border-white'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title="Casts high-intensity white light from screen perimeter (works on all devices and front cameras)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Screen Light Ring {screenIlluminator ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Retroreflection status tip */}
      {isLightActive && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-300/90 font-mono">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>OPTICAL RETROREFLECTION ENHANCED: Lenses produce specular glints under illumination</span>
          </span>
          <span className="text-slate-400 hidden sm:inline">
            Source: {hasHardwareTorch ? 'Hardware LED Torch' : 'Screen High-Luminance Ring'}
          </span>
        </div>
      )}
    </div>
  );
};
