import { createSignal, Component } from 'solid-js';

import { Clock, LogOut } from 'lucide-solid';
import { UserPermission } from '../types';

interface PendingApprovalScreenProps {
  currentUserRights: UserPermission;
  onLogout: () => void;
  onRequestToJoinOrganization: (orgId: string) => Promise<{ success: boolean; error?: string }>;
  showNotification: (msg: string) => void;
}

export const PendingApprovalScreen: Component<PendingApprovalScreenProps> = ({
  currentUserRights,
  onLogout,
  onRequestToJoinOrganization,
  showNotification
}) => {
  const [showChangeOrgForm, setShowChangeOrgForm] = createSignal(false);
  const [changeOrgIdInput, setChangeOrgIdInput] = createSignal('');
  const [changeOrgLoading, setChangeOrgLoading] = createSignal(false);
  const [changeOrgError, setChangeOrgError] = createSignal<string | null>(null);

  const hasOrgId = !!currentUserRights.organizationId;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans p-4">
      <div class="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 bg-amber-500/15 rounded-xl shadow-lg border border-amber-500/30 mb-2">
          <Clock class="w-6 h-6 text-amber-500 animate-pulse" />
        </div>
        <h2 class="text-xl font-bold tracking-tight text-white font-sans">
          {hasOrgId ? 'Pending Admin Approval' : 'Access Revoked / No Org Mapped'}
        </h2>
        <p class="text-xs text-slate-350 leading-relaxed font-sans">
          {hasOrgId
            ? 'Your account has been successfully registered! However, access is pending approval by the Administrator of your organization:'
            : 'Your account is not currently associated with any active organization. Your access may have been revoked, or you may need to join an organization:'}
        </p>
        <div class="bg-slate-950/80 border border-slate-850 p-3 rounded-xl text-xs font-mono text-blue-400 select-all">
          {currentUserRights.organizationId || 'No Organization Mapped'}
        </div>
        <p class="text-[11px] text-slate-400 font-sans">
          {hasOrgId
            ? 'Please share your email and Organization ID with your administrator. Once approved, refresh the page to access your dashboards.'
            : 'Please enter a valid Organization ID below to request to join a new organization. Once the Administrator approves you, you will gain access.'}
        </p>

        <div class="border-t border-slate-800 my-4 pt-4">
          {!showChangeOrgForm() ? (
            <button
              onClick={() => {
                setChangeOrgIdInput('');
                setChangeOrgError(null);
                setShowChangeOrgForm(true);
              }}
              class="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
            >
              Join a different organization?
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setChangeOrgLoading(true);
                setChangeOrgError(null);
                try {
                  const res = await onRequestToJoinOrganization(changeOrgIdInput());
                  if (res.success) {
                    setShowChangeOrgForm(false);
                    showNotification("Organization change request submitted!");
                  } else if (res.error) {
                    setChangeOrgError(res.error);
                  }
                } catch (err: any) {
                  setChangeOrgError(err.message || 'Failed to submit request.');
                } finally {
                  setChangeOrgLoading(false);
                }
              }}
              class="space-y-3 text-left"
            >
              <div>
                <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">New Organization ID</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Organization ID to join"
                  value={changeOrgIdInput()}
                  onChange={(e) => setChangeOrgIdInput(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              {changeOrgError() && (
                <p class="text-[11px] text-rose-400 bg-rose-950/20 border border-rose-900/50 p-2 rounded-lg leading-relaxed">
                  {changeOrgError()}
                </p>
              )}
              <div class="flex justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangeOrgForm(false)}
                  class="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changeOrgLoading()}
                  class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {changeOrgLoading() ? 'Submitting...' : 'Request to Join'}
                </button>
              </div>
            </form>
          )}
        </div>

        <button
          onClick={onLogout}
          class="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white rounded-xl border border-slate-800 transition cursor-pointer text-xs font-bold font-sans mt-4"
        >
          <LogOut class="w-4 h-4 text-slate-400" />
          <span>Back to Login / Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default PendingApprovalScreen;
