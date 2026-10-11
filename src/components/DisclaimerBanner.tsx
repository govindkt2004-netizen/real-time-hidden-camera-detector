import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Eye, Radio, Sparkles, ShieldAlert } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full rounded-xl bg-amber-950/30 border border-amber-600/40 p-4 text-amber-200/90 shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 text-xs md:text-sm leading-relaxed">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-amber-300 tracking-wide">
              MANDATORY SECURITY & DETECTION LIMITATION DISCLAIMER
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-200 font-medium underline cursor-pointer"
            >
              {expanded ? 'Hide Sweep Guide' : 'TSCM Sweep Guide & Tips'}
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="mt-1 text-amber-200/80">
            This application uses on-device visual machine learning and optical reflection analysis. 
            <strong className="text-amber-200 ml-1">
              It does not and cannot claim to detect every concealed camera.
            </strong>{' '}
            A standard device camera and visual object-detection model cannot reliably identify lenses hidden behind solid opaque objects, 
            micro-pinholes smaller than the camera’s resolving power, or fully obscured electronic circuitry.
          </p>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-amber-800/40 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-amber-100/90">
              <div className="p-2.5 rounded-lg bg-black/40 border border-amber-800/30">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>1. Optical Glint Sweep</span>
                </div>
                <p className="text-slate-300">
                  Turn off room lights and turn on the scanner torch. Scan across smoke detectors, electrical outlets, alarm clocks, and mirror frames at an angle to spot pinpoint lens reflections.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-amber-800/30">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>2. Infrared (IR) Check</span>
                </div>
                <p className="text-slate-300">
                  Night-vision spy cameras emit 850nm/940nm IR LEDs invisible to human eyes. Your front or back camera sensor can detect them as bright purple/white glowing dots in total darkness.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-amber-800/30">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <Radio className="w-4 h-4 text-amber-400" />
                  <span>3. Two-Way Mirror Test</span>
                </div>
                <p className="text-slate-300">
                  Place your fingernail flat against the mirror surface. In a true mirror, there is a distinct gap between your nail and its reflection. If your nail touches its reflection directly, it may be two-way glass.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
