/**
 * Persistent cache for embeddings that survives app restarts
 * Uses local file storage in Electron, falls back to in-memory in browser
 */

import { embeddingCache } from './cache';
import { getLocalItem, setLocalItem, isElectron } from '../cache/local-storage';
import { createHash } from 'crypto';

const CACHE_KEY_PREFIX = 'embedding_cache_';
const CACHE_VERSION = 1;

interface PersistentCacheEntry {
  embedding: number[];
  timestamp: number;
  version: number;
}

/**
 * Load cached embeddings from persistent storage
 */
export async function loadPersistentCache(): Promise<void> {
  if (!isElectron()) {
    return; // Only persist in Electron
  }

  try {
    // Load all cache entries
    // Note: This is a simplified version - in production, you might want
    // to load entries on-demand rather than all at once
    const cacheData = await getLocalItem('embeddings_cache_data');
    
    if (cacheData && Array.isArray(cacheData)) {
      // Restore to in-memory cache
      for (const entry of cacheData) {
        if (entry.text && entry.embedding && entry.timestamp) {
          embeddingCache.set(entry.text, entry.embedding);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load persistent cache:', error);
  }
}

/**
 * Save embeddings to persistent storage
 */
export async function savePersistentCache(): Promise<void> {
  if (!isElectron()) {
    return; // Only persist in Electron
  }

  try {
    // Get all cache entries (this is simplified - you might want to
    // implement a more efficient serialization method)
    const stats = embeddingCache.getStats();
    
    // In a real implementation, you'd serialize the cache properly
    // For now, we'll just mark that we need to implement this
    // when we have access to the cache internals
    
    // This would require exposing cache internals or implementing
    // a proper serialization method in the EmbeddingCache class
  } catch (error) {
    console.error('Failed to save persistent cache:', error);
  }
}

/**
 * Get embedding with persistent cache fallback
 */
export async function getEmbeddingWithCache(text: string): Promise<number[] | null> {
  // First check in-memory cache
  const cached = embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  // If in Electron, check persistent storage
  if (isElectron()) {
    try {
      const key = createHash('sha256').update(text).digest('hex').substring(0, 16);
      const stored = await getLocalItem(`${CACHE_KEY_PREFIX}${key}`) as PersistentCacheEntry | null;
      
      if (stored && stored.version === CACHE_VERSION) {
        // Check if not expired (7 days TTL for persistent cache)
        const age = Date.now() - stored.timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (age < maxAge) {
          // Restore to in-memory cache
          embeddingCache.set(text, stored.embedding);
          return stored.embedding;
        } else {
          // Expired, remove it
          await removeLocalItem(`${CACHE_KEY_PREFIX}${key}`);
        }
      }
    } catch (error) {
      console.error('Failed to get from persistent cache:', error);
    }
  }

  return null;
}

/**
 * Store embedding in both in-memory and persistent cache
 */
export async function setEmbeddingWithCache(text: string, embedding: number[]): Promise<void> {
  // Store in in-memory cache
  embeddingCache.set(text, embedding);

  // If in Electron, also store persistently
  if (isElectron()) {
    try {
      const key = createHash('sha256').update(text).digest('hex').substring(0, 16);
      const entry: PersistentCacheEntry = {
        embedding,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      
      await setLocalItem(`${CACHE_KEY_PREFIX}${key}`, entry);
    } catch (error) {
      console.error('Failed to save to persistent cache:', error);
    }
  }
}

// Helper to remove from persistent cache
async function removeLocalItem(key: string): Promise<void> {
  const { removeLocalItem: removeItem } = await import('../cache/local-storage');
  await removeItem(key);
}
