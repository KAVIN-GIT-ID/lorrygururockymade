import React from 'react';
import { Download, Sparkles, X, ChevronRight, Info } from 'lucide-react';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
}

export default function AppUpdateModal({
  isOpen,
  onClose,
  currentVersion,
  latestVersion,
  releaseNotes,
  downloadUrl
}: AppUpdateModalProps) {
  if (!isOpen) return null;

  const handleDownload = () => {
    if (!downloadUrl) {
      alert("Download link is not configured.");
      return;
    }
    window.open(downloadUrl, '_system');
  };

  const isDowngrade = () => {
    if (!currentVersion || !latestVersion) return false;
    const currParts = currentVersion.split('.').map(Number);
    const lateParts = latestVersion.split('.').map(Number);
    for (let i = 0; i < Math.max(currParts.length, lateParts.length); i++) {
      const curr = currParts[i] || 0;
      const late = lateParts[i] || 0;
      if (curr > late) return true;
      if (late > curr) return false;
    }
    return false;
  };

  const downgrade = isDowngrade();

  return (
    <div className="fixed inset-0 z-250 flex items-center justify-center p-4 bg-slate-955/65 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5 text-left font-sans animate-scale-up">
        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-150/15 dark:bg-blue-955/30 text-blue-600 dark:text-blue-400 rounded-2xl shadow-inner border border-blue-100 dark:border-blue-900/30">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className={`font-extrabold text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
              downgrade
                ? 'bg-amber-100 dark:bg-amber-955/80 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-900/40'
                : 'bg-blue-100 dark:bg-blue-955/80 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-900/40'
            }`}>
              {downgrade ? 'System Revert Required' : 'New Update Available'}
            </span>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base mt-1.5">
              Lorry Guru v{latestVersion}
            </h3>
          </div>
        </div>

        {/* Version Compare Banner */}
        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs font-semibold">
          <div className="text-center flex-1">
            <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">Current</p>
            <p className="text-slate-700 dark:text-slate-300 font-mono text-sm mt-0.5">v{currentVersion}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-350" />
          <div className="text-center flex-1">
            <p className={`${downgrade ? 'text-amber-500 dark:text-amber-400' : 'text-blue-500 dark:text-blue-400'} text-[10px] uppercase font-bold tracking-wider`}>
              {downgrade ? 'Target (Rollback)' : 'Latest'}
            </p>
            <p className={`${downgrade ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'} font-mono text-sm font-black mt-0.5`}>v{latestVersion}</p>
          </div>
        </div>

        {/* Release Notes */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {downgrade ? 'Rollback Reason & Details' : "What's New in this Version"}
          </span>
          <div className="max-h-36 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {releaseNotes ? (
              <p className="whitespace-pre-line">{releaseNotes}</p>
            ) : (
              <p className="italic text-slate-400">No details provided.</p>
            )}
          </div>
        </div>

        {/* Footer info/warning */}
        <div className="flex gap-2 items-start text-[10px] text-slate-500 leading-relaxed">
          <Info className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${downgrade ? 'text-amber-500' : 'text-blue-500'}`} />
          <p>
            {downgrade
              ? 'The downgrade package will download directly in the background. Tap the downloaded notification to revert the app installation.'
              : 'The update package will download directly in the background. Tap the downloaded file notification to complete the installation.'}
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleDownload}
          className={`w-full h-12 text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition shadow-lg cursor-pointer active:scale-98 ${
            downgrade
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/10'
              : 'bg-gradient-to-r from-blue-650 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/10'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>{downgrade ? 'Downgrade & Revert Now' : 'Download & Install Now'}</span>
        </button>
      </div>
    </div>
  );
}
