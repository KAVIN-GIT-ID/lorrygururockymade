import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

export interface PushTokenPayload {
  token: string;
  platform: 'web' | 'android' | 'ios';
  userEmail?: string;
  organizationId?: string;
}

class PushNotificationService {
  private hasPermission = false;
  private isCapacitor = typeof (window as any)?.Capacitor !== 'undefined';

  /**
   * Request push notification permissions and initialize Web/Capacitor push
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // 1. Mobile Native via Capacitor PushNotifications plugin
      if (this.isCapacitor && (window as any).Capacitor?.Plugins?.PushNotifications) {
        const PushNotifications = (window as any).Capacitor.Plugins.PushNotifications;
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive === 'granted') {
          await PushNotifications.register();
          this.hasPermission = true;
          return true;
        }
      }

      // 2. Standard Web Push API
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        this.hasPermission = permission === 'granted';

        if (this.hasPermission && 'serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/sw.js');
          } catch (swErr) {
            console.warn('[PushNotificationService] Service Worker registration info:', swErr);
          }
        }
        return this.hasPermission;
      }
    } catch (err) {
      console.warn('[PushNotificationService] Permission request warning:', err);
    }

    return false;
  }

  /**
   * Check if notifications are currently permitted
   */
  public isPermissionGranted(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.hasPermission) return true;
    if ('Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  }

  /**
   * Send a system notification when app is running or in background
   */
  public sendNotification(title: string, body: string, options?: { icon?: string; url?: string; tag?: string }): void {
    if (typeof window === 'undefined' || !this.isPermissionGranted()) return;

    try {
      // If Service Worker is active, use showNotification for background durability
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: options?.icon || '/og-banner.png',
            tag: options?.tag || 'lorry-guru-alert',
            data: { url: options?.url || '/console/dashboard' }
          } as any);
        });
        return;
      }

      // Standard Desktop Browser Notification fallback
      const n = new Notification(title, {
        body,
        icon: options?.icon || '/og-banner.png',
        tag: options?.tag || 'lorry-guru-alert'
      });

      n.onclick = () => {
        window.focus();
        if (options?.url) {
          window.location.hash = options.url;
        }
        n.close();
      };
    } catch (err) {
      console.warn('[PushNotificationService] Display notification error:', err);
    }
  }

  /**
   * Register push device token with Appwrite Backend
   */
  public async registerDeviceToken(payload: PushTokenPayload): Promise<void> {
    if (!isAppwriteConfigured() || !payload.token) return;

    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const docId = `token_${payload.platform}_${payload.userEmail ? appwrite.getEmailDocId(payload.userEmail) : 'anon'}`;
      await appwrite.saveGlobalConfig(databaseId, docId, {
        token: payload.token,
        platform: payload.platform,
        userEmail: payload.userEmail || '',
        organizationId: payload.organizationId || '',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[PushNotificationService] Token sync warning:', err);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
