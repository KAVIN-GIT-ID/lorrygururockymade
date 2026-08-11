import { createSignal, onMount, onCleanup, JSX, Suspense, lazy } from 'solid-js';
import { appwrite } from '../lib/appwrite';

const AppUpdateModal = lazy(() => import('../components/AppUpdateModal'));

export function useAppUpdate(appVersion: string) {
  const [appUpdateConfig, setAppUpdateConfig] = createSignal<{
    version: string;
    releaseNotes: string;
    downloadUrl: string;
    updatedAt?: string;
  } | null>(
    (() => {
      try {
        const stored = localStorage.getItem('ttt_app_update_config');
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    })()
  );

  const [dismissedVersion, setDismissedVersion] = createSignal<string | null>(
    (() => {
      try {
        return localStorage.getItem('ttt_dismissed_version');
      } catch {
        return null;
      }
    })()
  );

  const handleDismissVersion = (ver: string | null) => {
    setDismissedVersion(ver);
    try {
      if (ver) {
        localStorage.setItem('ttt_dismissed_version', ver);
      } else {
        localStorage.removeItem('ttt_dismissed_version');
      }
    } catch (e) {
      console.warn("Failed to save dismissed version:", e);
    }
  };

  const isVersionNewer = (current: string, latest: string) => {
    if (!current || !latest) return false;
    const currParts = current.split('.').map(Number);
    const lateParts = latest.split('.').map(Number);
    for (let i = 0; i < Math.max(currParts.length, lateParts.length); i++) {
      const curr = currParts[i] || 0;
      const late = lateParts[i] || 0;
      if (late > curr) return true;
      if (curr > late) return false;
    }
    return false;
  };

  const handleSaveAppUpdateConfig = async (config: any) => {
    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const payload = {
        key: 'cfg_app_version',
        ...config
      };
      await appwrite.saveGlobalConfig(databaseId, 'cfg_app_version', payload);
      setAppUpdateConfig(payload);
      localStorage.setItem('ttt_app_update_config', JSON.stringify(payload));
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('ttt_app_update_event', { detail: payload }));
      }
    } catch (err: any) {
      console.error("Failed to save app update config:", err);
      throw err;
    }
  };

  onMount(() => {
    const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

    const fetchAppVersion = async () => {
      try {
        const config = await appwrite.loadGlobalConfig(databaseId, 'cfg_app_version');
        if (config) {
          localStorage.setItem('ttt_app_update_config', JSON.stringify(config));
          setAppUpdateConfig(config);
        }
      } catch (err) {
        console.warn("Failed to fetch app version config:", err);
      }
    };

    const handleUpdateEvent = (e: any) => {
      if (e.detail) {
        setAppUpdateConfig(e.detail);
      }
    };

    const isMobileEnv = typeof window !== 'undefined' && 
      (window.location.protocol === 'capacitor:' || !!(window as any).Capacitor || window.innerWidth < 768);

    if (isMobileEnv) {
      fetchAppVersion();
    }

    window.addEventListener('ttt_app_update_event', handleUpdateEvent);

    onCleanup(() => {
      window.removeEventListener('ttt_app_update_event', handleUpdateEvent);
    });
  });

  const renderAppUpdateModal = () => {
    const config = appUpdateConfig();
    const dismissed = dismissedVersion();
    const show = typeof window !== 'undefined' &&
      (window.location.protocol === 'capacitor:' || !!(window as any).Capacitor || window.innerWidth < 768) &&
      !import.meta.env.DEV &&
      !!config &&
      isVersionNewer(appVersion, config.version) &&
      dismissed !== config.version;

    return (
      <Suspense fallback={null}>
        <AppUpdateModal
          isOpen={show}
          onClose={() => handleDismissVersion(config?.version || null)}
          currentVersion={appVersion}
          latestVersion={config?.version || ''}
          releaseNotes={config?.releaseNotes || ''}
          downloadUrl={config?.downloadUrl || ''}
        />
      </Suspense>
    );
  };

  return {
    appUpdateConfig,
    handleSaveAppUpdateConfig,
    renderAppUpdateModal
  };
}
