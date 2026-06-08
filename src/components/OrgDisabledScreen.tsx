import React from 'react';
import { AlertCircle } from 'lucide-react';

interface OrgDisabledScreenProps {
  currentUserOrgId: string;
  onLogout: () => void;
}

export const OrgDisabledScreen: React.FC<OrgDisabledScreenProps> = ({
  currentUserOrgId,
  onLogout
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans p-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-red-550/15 rounded-xl shadow-lg border border-red-500/30 mb-2">
          <AlertCircle className="w-6 h-6 text-red-500 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white font-sans">
          Organization Disabled
        </h2>
        <p className="text-xs text-slate-350 leading-relaxed font-sans">
          Your organization account has been disabled by the system administrator.
          Please contact support or pay your invoices to restore access to your fleet.
        </p>
        <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl text-xs font-mono text-slate-400 select-all">
          Org ID: {currentUserOrgId}
        </div>

        <div className="border-t border-slate-800 pt-4">
          <button
            onClick={onLogout}
            className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
          >
            Sign Out / Log In to another account
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrgDisabledScreen;
