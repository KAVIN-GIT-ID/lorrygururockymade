import { onMount, onCleanup, Component } from 'solid-js';
import { AlertCircle } from 'lucide-solid';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { OrganizationProfile } from '../types';

interface OrgDisabledScreenProps {
  currentUserOrgId: () => string;
  setOrganizationProfiles?: (profiles: OrganizationProfile[]) => void;
  onLogout: () => void;
}

export const OrgDisabledScreen: Component<OrgDisabledScreenProps> = (props) => {
  onMount(async () => {
    if (!isAppwriteConfigured() || !props.setOrganizationProfiles) return;
    let socket: WebSocket | null = null;
    let destroyed = false;

    try {
      await appwrite.initSession();
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const jwt = await appwrite.createSessionJwt();
      const gatewayUrl = `${wsProtocol}//${window.location.host}/realtime`;
      socket = new WebSocket(gatewayUrl);

      socket.onopen = () => {
        if (!destroyed && socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'authenticate', jwt }));
        }
      };

      socket.onmessage = (msg) => {
        try {
          const response = JSON.parse(msg.data);
          const doc = response.payload;
          if (!doc) return;
          const keyVal = doc.$id || doc.key || '';
          if (keyVal.startsWith('prf_')) {
            let parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc;
            if (parsed && typeof parsed.data === 'string') {
              try { parsed = JSON.parse(parsed.data); } catch {}
            }
            const targetOrgId = props.currentUserOrgId();
            if (parsed && parsed.organizationId === targetOrgId && parsed.status === 'Active') {
              const stored = localStorage.getItem('ttt_organization_profiles');
              let profiles: OrganizationProfile[] = stored ? JSON.parse(stored) : [];
              const idx = profiles.findIndex(p => p.organizationId === parsed.organizationId);
              if (idx > -1) profiles[idx] = parsed; else profiles.push(parsed);
              localStorage.setItem('ttt_organization_profiles', JSON.stringify(profiles));
              if (props.setOrganizationProfiles) {
                props.setOrganizationProfiles(profiles);
              }
            }
          }
        } catch (_) {}
      };
    } catch (_) {}

    onCleanup(() => {
      destroyed = true;
      if (socket) {
        try { socket.close(); } catch (_) {}
      }
    });
  });

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans p-4">
      <div class="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 bg-red-550/15 rounded-xl shadow-lg border border-red-500/30 mb-2">
          <AlertCircle class="w-6 h-6 text-red-500 animate-pulse" />
        </div>
        <h2 class="text-xl font-bold tracking-tight text-white font-sans">
          Organization Disabled
        </h2>
        <p class="text-xs text-slate-350 leading-relaxed font-sans">
          Your organization account has been disabled by the system administrator.
          Please contact support or pay your invoices to restore access to your fleet.
        </p>
        <div class="bg-slate-950/80 border border-slate-850 p-3 rounded-xl text-xs font-mono text-slate-400 select-all">
          Org ID: {props.currentUserOrgId()}
        </div>

        <div class="border-t border-slate-800 pt-4">
          <button
            onClick={() => props.onLogout()}
            class="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
          >
            Sign Out / Log In to another account
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrgDisabledScreen;
