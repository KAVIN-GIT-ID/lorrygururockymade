/**
 * Frontend Sentry Monitoring & Error Reporting Service
 */

interface ErrorContext {
  user?: { id?: string; email?: string; organizationId?: string };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

class SentryLogger {
  private isInitialized = false;

  init() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) {
      console.log('[Monitoring] Sentry DSN not provided. Global console error tracking active.');
      return;
    }

    try {
      this.isInitialized = true;
      console.log('[Monitoring] Sentry monitoring initialized successfully.');

      window.addEventListener('unhandledrejection', (event) => {
        this.captureException(event.reason, { tags: { type: 'unhandled_rejection' } });
      });

      window.addEventListener('error', (event) => {
        this.captureException(event.error || event.message, { tags: { type: 'window_error' } });
      });
    } catch (err) {
      console.warn('[Monitoring] Failed to initialize Sentry:', err);
    }
  }

  captureException(error: any, context: ErrorContext = {}) {
    console.error('[Monitoring] Captured Exception:', error, context);
    // When Sentry SDK is linked in production, Sentry.captureException is dispatched
    if (typeof (window as any).Sentry !== 'undefined') {
      (window as any).Sentry.captureException(error, context);
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    console.log(`[Monitoring] [${level.toUpperCase()}] ${message}`);
    if (typeof (window as any).Sentry !== 'undefined') {
      (window as any).Sentry.captureMessage(message, level);
    }
  }
}

export const sentryService = new SentryLogger();
