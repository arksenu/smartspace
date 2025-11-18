/**
 * Simple in-memory job queue with persistence fallback for non-critical operations
 */

import { createClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/utils/retry";

export interface Job<T = any> {
  id: string;
  type: JobType;
  data: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  nextRetryAt?: Date;
  lastError?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export enum JobType {
  SAVE_MESSAGE = 'save_message',
  LOG_EVAL = 'log_eval',
  UPDATE_SUMMARY = 'update_summary',
}

interface QueueOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  processIntervalMs?: number;
  maxQueueSize?: number;
}

class JobQueue {
  private queue: Map<string, Job>;
  private processing: Set<string>;
  private processors: Map<JobType, (job: Job) => Promise<void>>;
  private processInterval: NodeJS.Timeout | null;
  private options: Required<QueueOptions>;
  private initialized: boolean = false;

  constructor(options: QueueOptions = {}) {
    this.queue = new Map();
    this.processing = new Set();
    this.processors = new Map();
    this.processInterval = null;

    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 5000,
      processIntervalMs: options.processIntervalMs ?? 1000,
      maxQueueSize: options.maxQueueSize ?? 1000,
    };
  }

  /**
   * Initialize the queue (recover jobs) on first use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    this.initialized = true;
    try {
      await this.recoverJobs();
    } catch (error) {
      // If we can't recover jobs due to context issues, that's ok
      // Jobs will be recovered on next successful request
      console.warn('Could not recover jobs on first use:', error);
    }
  }

  /**
   * Register a job processor for a specific job type
   */
  registerProcessor(type: JobType, processor: (job: Job) => Promise<void>): void {
    this.processors.set(type, processor);
  }

  /**
   * Add a job to the queue
   */
  async addJob<T>(type: JobType, data: T): Promise<string> {
    // Ensure we've recovered any persisted jobs
    await this.ensureInitialized();

    // Check queue size limit
    if (this.queue.size >= this.options.maxQueueSize) {
      console.warn(`Job queue is full (${this.queue.size} jobs), dropping oldest jobs`);
      // Remove oldest jobs
      const toRemove = Array.from(this.queue.entries())
        .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, Math.ceil(this.options.maxQueueSize * 0.1))
        .map(([id]) => id);

      toRemove.forEach(id => this.queue.delete(id));
    }

    const job: Job<T> = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      attempts: 0,
      maxAttempts: this.options.maxRetries,
      createdAt: new Date(),
      status: 'pending',
    };

    this.queue.set(job.id, job);

    // Try to persist to database for recovery
    try {
      await this.persistJob(job);
    } catch (error) {
      console.error('Failed to persist job to database:', error);
      // Continue anyway - in-memory queue is primary
    }

    // Start processing if not already running
    if (!this.processInterval) {
      this.startProcessing();
    }

    return job.id;
  }

  /**
   * Start processing jobs
   */
  startProcessing(): void {
    if (this.processInterval) return;

    this.processInterval = setInterval(() => {
      this.processNextJob();
    }, this.options.processIntervalMs);

    // Process immediately
    this.processNextJob();
  }

  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Process the next available job
   */
  private async processNextJob(): Promise<void> {
    // Find next job to process
    const now = new Date();
    const nextJob = Array.from(this.queue.values())
      .filter(job =>
        job.status === 'pending' &&
        !this.processing.has(job.id) &&
        (!job.nextRetryAt || job.nextRetryAt <= now)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    if (!nextJob) return;

    // Mark as processing
    this.processing.add(nextJob.id);
    nextJob.status = 'processing';

    try {
      // Get processor for job type
      const processor = this.processors.get(nextJob.type);
      if (!processor) {
        throw new Error(`No processor registered for job type: ${nextJob.type}`);
      }

      // Process the job
      await processor(nextJob);

      // Mark as completed
      nextJob.status = 'completed';
      this.queue.delete(nextJob.id);

      // Remove from database
      await this.removePersistedJob(nextJob.id);

    } catch (error) {
      nextJob.attempts++;
      nextJob.lastError = error instanceof Error ? error.message : String(error);

      if (nextJob.attempts >= nextJob.maxAttempts) {
        // Max attempts reached, mark as failed
        nextJob.status = 'failed';
        console.error(`Job ${nextJob.id} failed after ${nextJob.attempts} attempts:`, error);

        // Log to database for manual investigation
        await this.logFailedJob(nextJob);

        // Remove from queue
        this.queue.delete(nextJob.id);
      } else {
        // Schedule retry
        nextJob.status = 'pending';
        nextJob.nextRetryAt = new Date(Date.now() + this.options.retryDelayMs * Math.pow(2, nextJob.attempts - 1));
        console.warn(`Job ${nextJob.id} failed (attempt ${nextJob.attempts}/${nextJob.maxAttempts}), retrying at ${nextJob.nextRetryAt}`);

        // Update persisted job
        await this.persistJob(nextJob);
      }
    } finally {
      this.processing.delete(nextJob.id);
    }

    // Stop processing if queue is empty
    if (this.queue.size === 0 && this.processInterval) {
      this.stopProcessing();
    }
  }

  /**
   * Persist job to database for recovery
   */
  private async persistJob(job: Job): Promise<void> {
    try {
      const supabase = await createClient();

      await supabase
        .from('job_queue')
        .upsert({
          id: job.id,
          type: job.type,
          data: job.data,
          attempts: job.attempts,
          max_attempts: job.maxAttempts,
          created_at: job.createdAt.toISOString(),
          next_retry_at: job.nextRetryAt?.toISOString(),
          last_error: job.lastError,
          status: job.status,
        })
        .select();
    } catch (error: any) {
      // Silently ignore cookie context errors - job is already in memory queue
      if (!error?.message?.includes('cookies') || !error?.message?.includes('request scope')) {
        throw error;
      }
    }
  }

  /**
   * Remove persisted job from database
   */
  private async removePersistedJob(jobId: string): Promise<void> {
    try {
      const supabase = await createClient();

      await supabase
        .from('job_queue')
        .delete()
        .eq('id', jobId);
    } catch (error: any) {
      // Silently ignore cookie context errors
      if (!error?.message?.includes('cookies') || !error?.message?.includes('request scope')) {
        throw error;
      }
    }
  }

  /**
   * Log failed job for manual investigation
   */
  private async logFailedJob(job: Job): Promise<void> {
    try {
      const supabase = await createClient();

      await supabase
        .from('failed_jobs')
        .insert({
          job_id: job.id,
          type: job.type,
          data: job.data,
          attempts: job.attempts,
          last_error: job.lastError,
          failed_at: new Date().toISOString(),
        });
    } catch (error: any) {
      // Silently ignore cookie context errors - we'll try again on next request
      if (!error?.message?.includes('cookies') || !error?.message?.includes('request scope')) {
        console.error('Failed to log failed job:', error);
      }
    }
  }

  /**
   * Recover jobs from database on startup
   */
  async recoverJobs(): Promise<void> {
    try {
      // Try to create client - will throw if outside request context
      const supabase = await createClient();

      const { data: jobs } = await supabase
        .from('job_queue')
        .select('*')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true })
        .limit(100);

      if (jobs) {
        for (const dbJob of jobs) {
          const job: Job = {
            id: dbJob.id,
            type: dbJob.type as JobType,
            data: dbJob.data,
            attempts: dbJob.attempts,
            maxAttempts: dbJob.max_attempts,
            createdAt: new Date(dbJob.created_at),
            nextRetryAt: dbJob.next_retry_at ? new Date(dbJob.next_retry_at) : undefined,
            lastError: dbJob.last_error,
            status: 'pending', // Reset to pending
          };

          this.queue.set(job.id, job);
        }

        if (this.queue.size > 0) {
          console.log(`Recovered ${this.queue.size} jobs from database`);
          this.startProcessing();
        }
      }
    } catch (error) {
      console.error('Failed to recover jobs from database:', error);
      // Continue anyway - new jobs will work
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): { size: number; processing: number; processors: number } {
    return {
      size: this.queue.size,
      processing: this.processing.size,
      processors: this.processors.size,
    };
  }
}

// Singleton instance
export const jobQueue = new JobQueue();

// Don't auto-recover on module load to avoid cookie context issues
// Recovery will happen on first use within request context
