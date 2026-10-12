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
            The live scan uses Grounding DINO Tiny with a generic “a camera” text prompt. This is an open-vocabulary text match, not a dedicated camera-trained class; this repository does not include a camera-labeled training dataset or fine-tuned camera-specific weights. A matching box is an unconfirmed candidate, and its score is not a calibrated probability. False positives and missed cameras are possible. Manual sweep reflections and aperture-like patterns are not camera evidence. Hidden cameras outside the frame or behind opaque material cannot be detected. An inactive camera may produce no visible cue, and range depends on target size, lighting, focus, and optics.
          </p>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-amber-800/40 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-amber-100/90">
              <div className="p-2.5 rounded-lg bg-black/40 border border-amber-800/30">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>1. Manual Visual Sweep</span>
                </div>
                <p className="text-slate-300">
                  The camera model loads when scanning begins and searches with one generic camera prompt. Manual sweep only marks bright points and dark aperture-like patterns as neutral cues; ordinary lights, screws, and shiny surfaces can produce them.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-amber-800/30">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>2. Infrared Limitations</span>
                </div>
                <p className="text-slate-300">
                  This browser app cannot determine whether its camera sensor is IR-sensitive or access raw infrared measurements. IR analysis is not enabled. It requires separate IR-sensitive hardware and compatible software; IR illumination, when present, indicates neither a camera nor recording by itself.
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
