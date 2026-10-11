import React, { useState } from 'react';
import { ScanIncident } from '../types';
import {
  Shield,
  Trash2,
  Download,
  X,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  FileText,
  FileCode,
  CheckCircle2,
  Lock,
  ChevronDown,
  Camera,
  Bookmark,
} from 'lucide-react';
import {
  downloadSignedPdfReport,
  downloadSignedJsonReport,
  computeIntegritySignature,
} from '../services/reportGenerator';

interface Props {
  isOpen: boolean;
  incidents: ScanIncident[];
  onClear: () => void;
  onClose: () => void;
}

export const IncidentLogsModal: React.FC<Props> = ({
  isOpen,
  incidents,
  onClear,
  onClose,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportPdf = async () => {
    setIsExporting(true);
    setExportSuccessMsg(null);
    try {
      await downloadSignedPdfReport(incidents);
      setExportSuccessMsg('Signed PDF Report downloaded successfully');
      setShowExportMenu(false);
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      console.error('PDF Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    setExportSuccessMsg(null);
    try {
      await downloadSignedJsonReport(incidents);
      setExportSuccessMsg('Signed JSON Report downloaded successfully');
      setShowExportMenu(false);
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      console.error('JSON Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                Security Audit Vault & Sweep Logs
              </h3>
              <p className="text-xs text-slate-400">
                {incidents.length} recorded threat incident{incidents.length === 1 ? '' : 's'} and optical detections
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {incidents.length > 0 && (
              <>
                {/* Export Report Dropdown / Trigger Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-950 transition-all cursor-pointer"
                    title="Export Audit Report (Signed PDF or JSON)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExporting ? 'Exporting...' : 'Export Report'}</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                  </button>

                  {/* Dropdown Menu */}
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-950 border border-slate-700 p-2 shadow-2xl z-30 animate-fade-in">
                      <div className="px-2 py-1.5 border-b border-slate-800 mb-1">
                        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                          Signed Export Formats
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Includes SHA-256 cryptographic integrity hash
                        </div>
                      </div>

                      {/* PDF Option */}
                      <button
                        onClick={handleExportPdf}
                        className="w-full p-2.5 rounded-lg hover:bg-slate-800/80 text-left flex items-start gap-2.5 transition-colors cursor-pointer group"
                      >
                        <FileText className="w-4 h-4 text-red-400 mt-0.5 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="text-xs font-semibold text-slate-100 flex items-center gap-1">
                            <span>Signed PDF Report</span>
                            <span className="text-[10px] px-1 py-0.2 bg-red-950 text-red-300 rounded font-mono">.pdf</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Formal TSCM audit document with evidence images & seal
                          </div>
                        </div>
                      </button>

                      {/* JSON Option */}
                      <button
                        onClick={handleExportJson}
                        className="w-full p-2.5 rounded-lg hover:bg-slate-800/80 text-left flex items-start gap-2.5 transition-colors cursor-pointer group"
                      >
                        <FileCode className="w-4 h-4 text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="text-xs font-semibold text-slate-100 flex items-center gap-1">
                            <span>Signed JSON File</span>
                            <span className="text-[10px] px-1 py-0.2 bg-emerald-950 text-emerald-300 rounded font-mono">.json</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Forensic structured dataset with integrity checksum
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Clear Incidents Button */}
                <button
                  onClick={onClear}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  title="Clear All Incidents"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {exportSuccessMsg && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/30 px-5 py-2.5 flex items-center gap-2 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccessMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {incidents.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
              <Shield className="w-12 h-12 text-slate-600 mb-2 stroke-1" />
              <p className="text-sm font-medium text-slate-300">No Incidents Recorded</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                When the camera detects potential hidden recording devices or when you capture evidence snapshots, they will be archived here.
              </p>
            </div>
          ) : (
            incidents.map((incident) => (
              <div
                key={incident.id}
                className={`p-3.5 rounded-xl border transition-colors flex flex-col sm:flex-row gap-3 items-start ${
                  incident.isManualObservation || incident.priority === 'HIGH'
                    ? 'bg-red-950/20 border-red-800/60 hover:border-red-700'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {incident.snapshotDataUrl ? (
                  <img
                    src={incident.snapshotDataUrl}
                    alt="Detected threat evidence snapshot"
                    referrerPolicy="no-referrer"
                    className={`w-full sm:w-28 h-24 object-cover rounded-lg border bg-black shrink-0 ${
                      incident.isManualObservation ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-red-500/40'
                    }`}
                  />
                ) : (
                  <div className="w-full sm:w-28 h-24 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {incident.isManualObservation ? (
                        <Bookmark className="w-4 h-4 text-amber-400 fill-current shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span className={`text-sm font-semibold ${
                        incident.isManualObservation ? 'text-amber-200' : 'text-red-200'
                      }`}>
                        {incident.threatLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {incident.isManualObservation && (
                        <span className="text-[10px] font-mono font-bold tracking-wider text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600/50 uppercase">
                          MANUAL SNAPSHOT
                        </span>
                      )}
                      {incident.priority === 'HIGH' && (
                        <span className="text-[10px] font-mono font-bold tracking-wider text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-600/50 uppercase">
                          HIGH PRIORITY
                        </span>
                      )}
                      {!incident.isManualObservation && (
                        <span className="text-xs font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40">
                          {(incident.confidence * 100).toFixed(1)}% CONFIDENCE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(incident.timestamp).toLocaleString()}</span>
                    <span>·</span>
                    <span>Class: {incident.threatClass}</span>
                  </div>

                  {incident.notes && (
                    <p className="mt-2 text-xs text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800">
                      {incident.notes}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
