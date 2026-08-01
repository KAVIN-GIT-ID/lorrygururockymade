/**
 * Centralized Monitoring & Telemetry Service for Truck-Trip-Tracker
 * Supports Error Boundaries, Performance Tracing, and Offline Log Buffering.
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'metric';
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

class MonitoringService {
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;
  private isProduction = import.meta.env.PROD;

  /**
   * Log informational message
   */
  logInfo(message: string, context?: Record<string, any>): void {
    this.recordLog('info', message, context);
  }

  /**
   * Log warning
   */
  logWarning(message: string, context?: Record<string, any>): void {
    this.recordLog('warn', message, context);
  }

  /**
   * Capture and record uncaught exception or runtime error
   */
  captureException(error: Error | unknown, context?: Record<string, any>): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.recordLog('error', err.message, context, err.stack);

    // If Sentry or external monitoring SDK is attached globally on window
    if (typeof (window as any).Sentry?.captureException === 'function') {
      (window as any).Sentry.captureException(err, { extra: context });
    }
  }

  /**
   * Trace client performance metric (e.g. sync duration, query execution time)
   */
  tracePerformanceMetric(name: string, durationMs: number, context?: Record<string, any>): void {
    this.recordLog('metric', `Performance Metric [${name}]: ${durationMs.toFixed(2)}ms`, {
      metricName: name,
      durationMs,
      ...context,
    });
  }

  /**
   * Internal buffer recorder
   */
  private recordLog(level: LogEntry['level'], message: string, context?: Record<string, any>, stack?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack,
    };

    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    if (!this.isProduction || level === 'error' || level === 'warn') {
      const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      consoleFn(`[Telemetry:${level.toUpperCase()}] ${message}`, context || '', stack || '');
    }
  }

  /**
   * Get recent in-memory log buffer for diagnostic submission
   */
  getRecentLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear in-memory log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }
}

export const monitoringService = new MonitoringService();
