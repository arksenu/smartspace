/**
 * In-memory cache for embeddings to avoid redundant API calls
 * Uses LRU (Least Recently Used) eviction policy
 */

import { createHash } from 'crypto';

interface CacheEntry {
  embedding: number[];
  timestamp: number;
  hits: number;
}

class EmbeddingCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds
  private collisionDetection: Map<string, string>; // For detecting hash collisions
  private version: number = 1; // Cache version for migrations

  constructor(maxSize = 1000, ttlMinutes = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
    this.collisionDetection = new Map();
  }

  /**
   * Generate a cache key from text content
   * Uses SHA-256 hash for collision resistance
   */
  private generateKey(text: string): string {
    // Use SHA-256 for strong collision resistance
    const hash = createHash('sha256')
      .update(text, 'utf8')
      .digest('hex');

    // Use first 16 characters of hash (64 bits) for reasonable uniqueness
    // This gives us 2^64 possible values, making collisions extremely unlikely
    return hash.substring(0, 16);
  }

  /**
   * Get embedding from cache if available and not expired
   */
  get(text: string): number[] | null {
    const key = this.generateKey(text);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Validate against collision (sanity check)
    const storedText = this.collisionDetection.get(key);
    if (storedText && storedText !== text) {
      console.error(`Cache collision detected! Key ${key} maps to different texts`);
      console.error(`Requested: ${text.substring(0, 50)}...`);
      console.error(`Stored: ${storedText.substring(0, 50)}...`);
      // Remove the corrupted entry
      this.cache.delete(key);
      this.collisionDetection.delete(key);
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.collisionDetection.delete(key);
      return null;
    }

    // Update hit count and move to end (most recently used)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.embedding;
  }

  /**
   * Store embedding in cache
   */
  set(text: string, embedding: number[]): void {
    const key = this.generateKey(text);

    // Check for collision before storing
    const existingText = this.collisionDetection.get(key);
    if (existingText && existingText !== text) {
      console.error(`Cache collision prevented! Key ${key} already maps to a different text`);
      console.error(`Existing: ${existingText.substring(0, 50)}...`);
      console.error(`New: ${text.substring(0, 50)}...`);
      // Don't store - this would corrupt the cache
      return;
    }

    // If cache is full, remove least recently used items
    if (this.cache.size >= this.maxSize) {
      // Remove first 10% of entries (oldest/least recently used)
      const toRemove = Math.ceil(this.maxSize * 0.1);
      const keys = Array.from(this.cache.keys()).slice(0, toRemove);
      keys.forEach(k => {
        this.cache.delete(k);
        this.collisionDetection.delete(k);
      });
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      hits: 0,
    });

    // Store text for collision detection
    this.collisionDetection.set(key, text);
  }

  /**
   * Get multiple embeddings, returning cached ones and indices of missing ones
   */
  getMultiple(texts: string[]): {
    cached: Map<number, number[]>;
    missing: number[];
  } {
    const cached = new Map<number, number[]>();
    const missing: number[] = [];

    texts.forEach((text, index) => {
      const embedding = this.get(text);
      if (embedding) {
        cached.set(index, embedding);
      } else {
        missing.push(index);
      }
    });

    return { cached, missing };
  }

  /**
   * Store multiple embeddings
   */
  setMultiple(texts: string[], embeddings: number[][]): void {
    texts.forEach((text, index) => {
      if (embeddings[index]) {
        this.set(text, embeddings[index]);
      }
    });
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.collisionDetection.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits: entries.reduce((sum, entry) => sum + entry.hits, 0),
      averageAge: entries.length > 0
        ? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length / 1000
        : 0,
      version: this.version,
      collisionsDetected: this.collisionDetection.size !== this.cache.size,
    };
  }
}

// Singleton instance
export const embeddingCache = new EmbeddingCache();
