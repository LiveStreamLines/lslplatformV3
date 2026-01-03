import { Injectable } from '@angular/core';

interface CachedLastPhoto {
  timestamp: string;
  cachedAt: number; // Unix timestamp in milliseconds
  expiresAt: number; // Unix timestamp in milliseconds
}

@Injectable({
  providedIn: 'root'
})
export class CameraPicsCacheService {
  private cache: Map<string, CachedLastPhoto> = new Map();
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key from camera identifiers
   */
  private getCacheKey(developerTag: string, projectTag: string, cameraTag: string): string {
    return `${developerTag}/${projectTag}/${cameraTag}`;
  }

  /**
   * Get cached last photo timestamp
   */
  getLastPhoto(developerTag: string, projectTag: string, cameraTag: string): string | null {
    const key = this.getCacheKey(developerTag, projectTag, cameraTag);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.timestamp;
  }

  /**
   * Cache last photo timestamp
   */
  setLastPhoto(developerTag: string, projectTag: string, cameraTag: string, timestamp: string): void {
    const key = this.getCacheKey(developerTag, projectTag, cameraTag);
    const now = Date.now();

    this.cache.set(key, {
      timestamp,
      cachedAt: now,
      expiresAt: now + this.CACHE_DURATION_MS
    });
  }

  /**
   * Clear cache for a specific camera
   */
  clearCache(developerTag: string, projectTag: string, cameraTag: string): void {
    const key = this.getCacheKey(developerTag, projectTag, cameraTag);
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache expiration time in milliseconds
   */
  getCacheDuration(): number {
    return this.CACHE_DURATION_MS;
  }
}

