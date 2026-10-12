import React from 'react';
import {
  ShieldOff,
  Trash2,
  Edit3,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  X,
  Plus,
} from 'lucide-react';
import { IgnoreMask } from '../types';

interface Props {
  isDrawing: boolean;
  onToggleDrawing: () => void;
  masks: IgnoreMask[];
  onRemoveMask: (id: string) => void;
  onClearAll: () => void;
  showMaskOverlays: boolean;
  onToggleShowMaskOverlays: () => void;
  ignoredCount?: number;
  onAddQuickPreset?: (label: string, position: 'left' | 'right' | 'center') => void;
}

export const IgnoreMaskBar: React.FC<Props> = ({
  isDrawing,
  onToggleDrawing,
  masks,
  onRemoveMask,
  onClearAll,
  showMaskOverlays,
  onToggleShowMaskOverlays,
  ignoredCount = 0,
  onAddQuickPreset,
}) => {
  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 text-slate-200 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Draw Mask Toggle Button & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDrawing}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-bold tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              isDrawing
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30 animate-pulse ring-2 ring-amber-300'
                : 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/40'
            }`}
          >
            {isDrawing ? <Check className="w-4 h-4 text-black stroke-[3]" /> : <Edit3 className="w-4 h-4 text-white" />}
            <span>{isDrawing ? 'DONE DRAWING' : 'DRAW IGNORE MASK'}</span>
          </button>

          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
              <ShieldOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Ignore Mask Filter ({masks.length} active)</span>
              {ignoredCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-600/60 text-amber-300 font-bold">
                  {ignoredCount} Skipped
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-400">
              {isDrawing
                ? 'Click & drag across camera feed to mask known mirrors, windows, or TV screens'
                : 'Ignores detections in selected regions to reduce reflection-related false alerts'}
            </span>
          </div>
        </div>

        {/* Right: Actions (Visibility toggle, Quick Presets, Clear All) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle mask box overlay visibility on camera */}
          <button
            onClick={onToggleShowMaskOverlays}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              showMaskOverlays
                ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
            title={showMaskOverlays ? 'Mask overlays visible on video feed' : 'Mask overlays hidden on video feed'}
          >
            {showMaskOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showMaskOverlays ? 'Overlays: Visible' : 'Overlays: Hidden'}</span>
          </button>

          {masks.length > 0 && (
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium font-mono text-slate-400 hover:text-red-300 bg-slate-950 border border-slate-800 hover:border-red-900/40 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Clear all drawn ignore masks"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}

          <div className="px-2.5 py-1 rounded-lg bg-black/60 border border-slate-800 text-[11px] font-mono text-slate-400">
            {masks.length === 0
              ? '0 masks active'
              : `${masks.length} region${masks.length > 1 ? 's' : ''} shielded`}
          </div>
        </div>
      </div>

      {/* Quick preset recommendations when 0 masks or user wants one-click presets */}
      {masks.length === 0 && onAddQuickPreset && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Quick Presets:</span>
          </span>
          <button
            onClick={() => onAddQuickPreset('🪟 Window Glass', 'left')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-slate-300 hover:text-amber-200 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>+ Left Window</span>
          </button>
          <button
            onClick={() => onAddQuickPreset('🪞 Wall Mirror', 'center')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-slate-300 hover:text-amber-200 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>+ Center Mirror</span>
          </button>
          <button
            onClick={() => onAddQuickPreset('🖥️ Screen / TV', 'right')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-slate-300 hover:text-amber-200 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>+ Right TV/Screen</span>
          </button>
        </div>
      )}

      {/* Active Mask Chips List */}
      {masks.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-slate-400">Active Shielded Zones:</span>
          {masks.map((m, idx) => (
            <div
              key={m.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-600/40 text-[11px] font-mono text-amber-200 shadow-sm"
            >
              <span className="font-semibold">{m.label || `Zone #${idx + 1}`}</span>
              <span className="text-slate-500 text-[10px]">
                ({Math.round(m.widthPercent)}%×{Math.round(m.heightPercent)}%)
              </span>
              <button
                onClick={() => onRemoveMask(m.id)}
                className="hover:text-red-400 ml-1 p-0.5 rounded hover:bg-red-950/60 transition-colors cursor-pointer"
                title={`Remove ${m.label || 'this mask'}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
