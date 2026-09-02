export interface VisitorStatsResponse {
  success: boolean;
  today: string;
  selectedMonth: string;
  availableMonths: string[];
  stats: {
    todayUniqueVisitors: number;
    monthUniqueVisitors: number;
    dailyBreakdown: Record<string, number>;
    countries: Record<string, number>;
  };
  kvConfigured: boolean;
  error?: string;
}

let hasTrackedThisSession = false;

/**
 * Sends a tracking ping to Cloudflare Edge API on app initialization.
 * Ensures tracking is only invoked once per browser session.
 */
export async function trackUniqueVisitor(): Promise<void> {
  if (hasTrackedThisSession) return;
  hasTrackedThisSession = true;

  try {
    const response = await fetch('/api/track-visitor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.debug('Visitor tracking edge response not OK:', response.status);
    }
  } catch (err) {
    // Graceful fallback for offline mode or dev environment where /api route isn't served by Wrangler
    console.debug('Visitor tracking edge ping skipped (local dev/offline mode):', err);
  }
}

/**
 * Fetches unique visitor statistics from Cloudflare Edge API for a target month (YYYY-MM).
 */
export async function fetchVisitorStats(month?: string): Promise<VisitorStatsResponse | null> {
  try {
    const queryParam = month ? `?month=${encodeURIComponent(month)}` : '';
    const response = await fetch(`/api/visitor-stats${queryParam}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }

    const data = await response.json();
    return data as VisitorStatsResponse;
  } catch (err) {
    console.debug('Unable to fetch Cloudflare visitor stats:', err);
    return null;
  }
}
