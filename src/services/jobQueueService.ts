/**
 * Asynchronous Background Job Queue Service for Truck-Trip-Tracker
 * Manages long-running tasks: PDF report generation, Bulk CSV imports, and Notification broadcasts.
 */
import { createSignal, createMemo } from 'solid-js';
import { monitoringService } from '../lib/monitoringService';

export type JobType = 'GENERATE_PDF_REPORT' | 'PROCESS_BULK_CSV' | 'SEND_WHATSAPP_NOTIFICATION' | 'RECONCILE_FLEET_DATA';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface BackgroundJob {
  id: string;
  type: JobType;
  title: string;
  payload: Record<string, any>;
  status: JobStatus;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: any;
}

const [jobs, setJobs] = createSignal<BackgroundJob[]>([]);
let isProcessingQueue = false;

export function useBackgroundJobQueue() {
  const activeJobs = createMemo(() => jobs().filter(j => j.status === 'processing' || j.status === 'queued'));
  const completedJobs = createMemo(() => jobs().filter(j => j.status === 'completed'));
  const failedJobs = createMemo(() => jobs().filter(j => j.status === 'failed'));

  /**
   * Enqueue a new background job
   */
  const enqueueJob = (type: JobType, title: string, payload: Record<string, any>): string => {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newJob: BackgroundJob = {
      id: jobId,
      type,
      title,
      payload,
      status: 'queued',
      progressPercent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setJobs(prev => [newJob, ...prev]);
    monitoringService.logInfo(`Enqueued background job: ${title} (${jobId})`, { type, payload });
    
    // Trigger queue processor asynchronously
    setTimeout(processQueue, 50);
    return jobId;
  };

  /**
   * Internal queue processor loop
   */
  const processQueue = async () => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    try {
      while (true) {
        const nextJob = jobs().find(j => j.status === 'queued');
        if (!nextJob) break;

        // Mark as processing
        updateJobState(nextJob.id, { status: 'processing', progressPercent: 10 });

        try {
          const startTime = performance.now();
          const result = await executeJobTask(nextJob, (progress) => {
            updateJobState(nextJob.id, { progressPercent: progress });
          });

          const duration = performance.now() - startTime;
          monitoringService.tracePerformanceMetric(`Job:${nextJob.type}`, duration, { jobId: nextJob.id });
          updateJobState(nextJob.id, { status: 'completed', progressPercent: 100, result });
        } catch (err: any) {
          monitoringService.captureException(err, { jobId: nextJob.id, jobType: nextJob.type });
          updateJobState(nextJob.id, { status: 'failed', error: err.message || 'Job execution failed' });
        }
      }
    } finally {
      isProcessingQueue = false;
    }
  };

  /**
   * Execute single task worker logic based on job type
   */
  const executeJobTask = async (job: BackgroundJob, onProgress: (progress: number) => void): Promise<any> => {
    switch (job.type) {
      case 'GENERATE_PDF_REPORT':
        onProgress(30);
        await new Promise(res => setTimeout(res, 500));
        onProgress(80);
        await new Promise(res => setTimeout(res, 200));
        return { reportUrl: `data:application/pdf;base64,mock_pdf_${job.id}` };

      case 'PROCESS_BULK_CSV':
        onProgress(40);
        await new Promise(res => setTimeout(res, 400));
        onProgress(90);
        return { processedCount: job.payload?.items?.length || 0 };

      case 'SEND_WHATSAPP_NOTIFICATION':
        onProgress(50);
        await new Promise(res => setTimeout(res, 300));
        return { sent: true, recipient: job.payload?.phone };

      case 'RECONCILE_FLEET_DATA':
        onProgress(50);
        await new Promise(res => setTimeout(res, 350));
        return { reconciled: true };

      default:
        return { success: true };
    }
  };

  /**
   * Update state helper for a given job
   */
  const updateJobState = (jobId: string, updates: Partial<BackgroundJob>) => {
    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j)));
  };

  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    enqueueJob,
  };
}

export const jobQueueService = {
  useBackgroundJobQueue,
};
