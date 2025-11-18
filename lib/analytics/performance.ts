/**
 * Performance tracking module for monitoring actual operation latencies
 */

import { createClient } from "@/lib/supabase/server";

export interface PerformanceMetric {
  operation: OperationType;
  duration_ms: number;
  metadata?: Record<string, any>;
}

export enum OperationType {
  EMBEDDING_GENERATION = 'embedding_generation',
  VECTOR_SEARCH = 'vector_search',
  LLM_RESPONSE = 'llm_response',
  DATABASE_OPERATION = 'database_operation',
  RELEVANCE_SCORING = 'relevance_scoring',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  TOTAL_REQUEST = 'total_request',
}

export interface PerformanceStats {
  operation: OperationType;
  count: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  min_ms: number;
  max_ms: number;
}

class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private batchSize = 100;
  // Removed flushInterval property - we don't use timers anymore

  constructor() {
    // Don't start auto-flush to avoid cookie context errors
    // Metrics will be flushed when batch is full or on explicit calls
    // Clear any lingering timers from hot reloads
    this.cleanupTimers();
  }

  /**
   * Clean up any lingering timers (for hot reload safety)
   */
  cleanupTimers(): void {
    // Clean up any global timer references
    if (typeof global !== 'undefined') {
      const g = global as any;
      if (g.performanceTrackerTimer) {
        clearInterval(g.performanceTrackerTimer);
        g.performanceTrackerTimer = null;
      }
      if (g.performanceFlushTimeout) {
        clearTimeout(g.performanceFlushTimeout);
        g.performanceFlushTimeout = null;
      }
    }
  }

  /**
   * Track a performance metric
   */
  track(operation: OperationType, durationMs: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      operation,
      duration_ms: Math.round(durationMs),
      metadata,
    });

    // Flush if batch is full (will only work if in request context)
    if (this.metrics.length >= this.batchSize) {
      this.flush().catch(() => {
        // Silently ignore flush errors outside request context
      });
    }
  }

  /**
   * Measure the duration of an async operation
   */
  async measure<T>(
    operation: OperationType,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.track(operation, duration, metadata);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.track(operation, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Create a timer for manual tracking
   */
  startTimer(operation: OperationType, metadata?: Record<string, any>): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.track(operation, duration, metadata);
    };
  }

  /**
   * Manually flush metrics (safe to call from any context)
   * Will silently skip if not in request context
   */
  async flushMetrics(): Promise<void> {
    return this.flush();
  }

  /**
   * Flush metrics with explicit request context
   * Use this when you know you're in a request handler
   */
  async flushInRequestContext(): Promise<void> {
    // This version assumes we're in a request context
    // and will attempt to flush immediately
    return this.flush();
  }

  /**
   * Flush metrics to database
   */
  private async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metricsToFlush = [...this.metrics];
    this.metrics = [];

    try {
      // Try to create the Supabase client
      // This will fail if we're not in a request context
      let supabase;
      try {
        supabase = await createClient();
      } catch (cookieError: any) {
        // If we get a cookie error, we're not in a request context
        // Store metrics for later and return silently
        if (cookieError?.message?.includes('cookies') ||
          cookieError?.message?.includes('request scope') ||
          cookieError?.message?.includes('called outside')) {
          this.metrics.unshift(...metricsToFlush);
          return;
        }
        // Re-throw if it's a different error
        throw cookieError;
      }

      const records = metricsToFlush.map(metric => ({
        operation: metric.operation,
        duration_ms: metric.duration_ms,
        metadata: metric.metadata,
        recorded_at: new Date().toISOString(),
      }));

      await supabase
        .from('performance_metrics')
        .insert(records);

      console.log(`Flushed ${records.length} performance metrics`);
    } catch (error: any) {
      // Silently handle cookie context errors - these are expected outside of request context
      if (error?.message?.includes('cookies') ||
        error?.message?.includes('request scope') ||
        error?.message?.includes('called outside')) {
        // Store metrics for later without logging
        this.metrics.unshift(...metricsToFlush);
        return;
      }

      // Only log non-cookie errors
      console.error('Failed to flush performance metrics:', error);
      // Add back to queue for retry
      this.metrics.unshift(...metricsToFlush);
    }
  }

  /**
   * Start automatic flushing (only call from within request context)
   */
  private startAutoFlush(): void {
    // Disabled to prevent cookie context errors
    // Auto-flush should only be enabled if explicitly needed within request context
    return;
  }

  /**
   * Stop automatic flushing (deprecated - no timers used anymore)
   */
  stopAutoFlush(): void {
    // No timers to stop - this method is kept for compatibility
    // Clean up any potential lingering timers from old code
    this.cleanupTimers();
  }

  /**
   * Get performance statistics for a time range
   */
  async getStats(
    startTime: Date,
    endTime: Date,
    operations?: OperationType[]
  ): Promise<PerformanceStats[]> {
    const supabase = await createClient();

    let query = supabase
      .from('performance_metrics')
      .select('*')
      .gte('recorded_at', startTime.toISOString())
      .lte('recorded_at', endTime.toISOString());

    if (operations && operations.length > 0) {
      query = query.in('operation', operations);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get performance stats: ${error.message}`);
    }

    // Group by operation and calculate statistics
    const grouped = new Map<OperationType, number[]>();

    for (const metric of data || []) {
      const durations = grouped.get(metric.operation) || [];
      durations.push(metric.duration_ms);
      grouped.set(metric.operation, durations);
    }

    const stats: PerformanceStats[] = [];

    for (const [operation, durations] of grouped.entries()) {
      if (durations.length === 0) continue;

      // Sort for percentile calculations
      const sorted = durations.sort((a, b) => a - b);
      const count = sorted.length;

      stats.push({
        operation,
        count,
        avg_ms: Math.round(sorted.reduce((a, b) => a + b, 0) / count),
        p50_ms: sorted[Math.floor(count * 0.5)],
        p95_ms: sorted[Math.floor(count * 0.95)],
        p99_ms: sorted[Math.floor(count * 0.99)],
        min_ms: sorted[0],
        max_ms: sorted[count - 1],
      });
    }

    return stats;
  }

  /**
   * Get detailed breakdown for a specific operation
   */
  async getOperationBreakdown(
    operation: OperationType,
    startTime: Date,
    endTime: Date,
    groupBy?: string
  ): Promise<Record<string, PerformanceStats>> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('operation', operation)
      .gte('recorded_at', startTime.toISOString())
      .lte('recorded_at', endTime.toISOString());

    if (error) {
      throw new Error(`Failed to get operation breakdown: ${error.message}`);
    }

    if (!groupBy || !data) {
      // Return single group with all data
      const allDurations = (data || []).map(m => m.duration_ms).sort((a, b) => a - b);
      const count = allDurations.length;

      if (count === 0) {
        return {};
      }

      return {
        all: {
          operation,
          count,
          avg_ms: Math.round(allDurations.reduce((a, b) => a + b, 0) / count),
          p50_ms: allDurations[Math.floor(count * 0.5)],
          p95_ms: allDurations[Math.floor(count * 0.95)],
          p99_ms: allDurations[Math.floor(count * 0.99)],
          min_ms: allDurations[0],
          max_ms: allDurations[count - 1],
        },
      };
    }

    // Group by metadata field
    const grouped = new Map<string, number[]>();

    for (const metric of data) {
      const key = metric.metadata?.[groupBy] || 'unknown';
      const durations = grouped.get(key) || [];
      durations.push(metric.duration_ms);
      grouped.set(key, durations);
    }

    const breakdown: Record<string, PerformanceStats> = {};

    for (const [key, durations] of grouped.entries()) {
      const sorted = durations.sort((a, b) => a - b);
      const count = sorted.length;

      breakdown[key] = {
        operation,
        count,
        avg_ms: Math.round(sorted.reduce((a, b) => a + b, 0) / count),
        p50_ms: sorted[Math.floor(count * 0.5)],
        p95_ms: sorted[Math.floor(count * 0.95)],
        p99_ms: sorted[Math.floor(count * 0.99)],
        min_ms: sorted[0],
        max_ms: sorted[count - 1],
      };
    }

    return breakdown;
  }
}

// Clean up any existing timers from previous hot reloads before creating new instance
if (typeof global !== 'undefined') {
  const g = global as any;
  // Clean up any timers
  if (g.performanceTrackerTimer) {
    clearInterval(g.performanceTrackerTimer);
    g.performanceTrackerTimer = null;
  }
  if (g.performanceFlushTimeout) {
    clearTimeout(g.performanceFlushTimeout);
    g.performanceFlushTimeout = null;
  }
  // Call cleanup on old instance if it exists
  if (g.performanceTracker && typeof g.performanceTracker.cleanupTimers === 'function') {
    g.performanceTracker.cleanupTimers();
  }
}

// Singleton instance with hot-reload safety
let performanceTracker: PerformanceTracker;

if (typeof global !== 'undefined') {
  const g = global as any;

  // Reuse existing tracker or create new one
  if (!g.performanceTracker) {
    g.performanceTracker = new PerformanceTracker();
  } else {
    // Clean up any lingering timers from the existing tracker
    if (typeof g.performanceTracker.cleanupTimers === 'function') {
      g.performanceTracker.cleanupTimers();
    }
  }

  performanceTracker = g.performanceTracker;
} else {
  performanceTracker = new PerformanceTracker();
}

export { performanceTracker };

// Don't register exit handler to avoid cookie context errors
// Metrics will be flushed during normal request processing
