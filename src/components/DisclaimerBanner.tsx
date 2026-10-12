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
            This application uses on-device visual object detection; it is not a dedicated hidden-camera detector.{' '}
            <strong className="text-amber-200 ml-1">
              It does not and cannot claim to detect every concealed camera.
            </strong>{' '}
            The bundled COCO-SSD model can identify its trained “person”, “cell phone”, and “laptop” object classes, but is not trained to recognize camera lenses, dedicated cameras, pinhole lenses, or camera modules. Person boxes and counts are estimates, not unique-person tracking. A laptop detection identifies the laptop body; it does not verify that a built-in camera is present, visible, or active. Detected devices are not proof of recording. Objects hidden behind opaque materials, powered-off devices, and details below the image resolution cannot be identified. Low light, distance, camera optics, and motion further reduce reliability.
          </p>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-amber-800/40 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-amber-100/90">
              <div className="p-2.5 rounded-lg bg-black/40 border border-amber-800/30">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>1. Manual Visual Sweep</span>
                </div>
                <p className="text-slate-300">
                  You can inspect suspicious objects with a separate light at different angles. Reflections are common and do not identify a camera; this app does not automatically detect or classify lens reflections.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-amber-800/30">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>2. Infrared Limitations</span>
                </div>
                <p className="text-slate-300">
                  Phone cameras vary and may filter infrared light. This app cannot detect infrared emissions. A suitable IR-sensitive camera or dedicated inspection tool is required; visible bright points alone are not proof of a camera.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-amber-800/30">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <Radio className="w-4 h-4 text-amber-400" />
                  <span>3. Mirror Test Limitations</span>
                </div>
                <p className="text-slate-300">
                  The fingernail-gap test is not a reliable way to determine whether a mirror is two-way glass. Do not treat this test or this app as confirmation; seek a qualified inspection if you have a specific concern.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
