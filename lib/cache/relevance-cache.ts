/**
 * Cache for relevance scores to avoid redundant LLM calls
 */

import { createHash } from 'crypto';

interface CachedScore {
  score: number;
  timestamp: number;
  queryHash: string;
  chunkHash: string;
}

class RelevanceScoreCache {
  private cache: Map<string, CachedScore>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 5000, ttlMinutes = 30) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate a cache key from query and chunk content
   */
  private generateKey(query: string, chunkContent: string): string {
    // Normalize query and chunk for better cache hits
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedChunk = chunkContent.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 200);
    
    const queryHash = createHash('sha256')
      .update(normalizedQuery, 'utf8')
      .digest('hex')
      .substring(0, 8);
    
    const chunkHash = createHash('sha256')
      .update(normalizedChunk, 'utf8')
      .digest('hex')
      .substring(0, 8);
    
    return `${queryHash}_${chunkHash}`;
  }

  /**
   * Get relevance score from cache if available and not expired
   */
  get(query: string, chunkContent: string): number | null {
    const key = this.generateKey(query, chunkContent);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.score;
  }

  /**
   * Store relevance score in cache
   */
  set(query: string, chunkContent: string, score: number): void {
    const key = this.generateKey(query, chunkContent);

    // If cache is full, remove least recently used items
    if (this.cache.size >= this.maxSize) {
      // Remove first 10% of entries (oldest/least recently used)
      const toRemove = Math.ceil(this.maxSize * 0.1);
      const keys = Array.from(this.cache.keys()).slice(0, toRemove);
      keys.forEach(k => this.cache.delete(k));
    }

    const queryHash = createHash('sha256')
      .update(query.toLowerCase().trim(), 'utf8')
      .digest('hex')
      .substring(0, 16);
    
    const chunkHash = createHash('sha256')
      .update(chunkContent.toLowerCase().trim().substring(0, 200), 'utf8')
      .digest('hex')
      .substring(0, 16);

    this.cache.set(key, {
      score,
      timestamp: Date.now(),
      queryHash,
      chunkHash,
    });
  }

  /**
   * Get similar query scores (for fuzzy matching)
   * Returns scores for chunks that had similar queries
   */
  getSimilarQueryScores(query: string): Map<string, number> {
    const queryHash = createHash('sha256')
      .update(query.toLowerCase().trim(), 'utf8')
      .digest('hex')
      .substring(0, 16);

    const similarScores = new Map<string, number>();
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      // Skip expired entries
      if (now - entry.timestamp > this.ttl) continue;

      // Check if query hash matches (same query, different chunks)
      if (entry.queryHash === queryHash) {
        similarScores.set(entry.chunkHash, entry.score);
      }
    }

    return similarScores;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > this.ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      validEntries,
      expiredEntries,
      fillPercentage: Math.round((this.cache.size / this.maxSize) * 100),
    };
  }
}

// Singleton instance
export const relevanceScoreCache = new RelevanceScoreCache();
