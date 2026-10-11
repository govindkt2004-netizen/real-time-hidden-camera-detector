import React from 'react';
import { Shield, Lock, Settings } from 'lucide-react';

interface Props {
  isBiometricLocked: boolean;
  onOpenSettings: () => void;
  onOpenAuditLogs: () => void;
  onOpenSweepGuide: () => void;
}

export const Navbar: React.FC<Props> = ({
  isBiometricLocked,
  onOpenSettings,
  onOpenAuditLogs,
  onOpenSweepGuide,
}) => {
  return (
    <header className="w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single line) */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-950">
            <Shield className="w-4 h-4" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
            CAM·DETECTOR
          </span>
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a
            href="#scanner"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Scanner
          </a>
          <button
            onClick={onOpenAuditLogs}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            {isBiometricLocked && <Lock className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Evidence Vault</span>
          </button>
          <button
            onClick={onOpenSweepGuide}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sweep Guide
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenSettings}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-red-400" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
