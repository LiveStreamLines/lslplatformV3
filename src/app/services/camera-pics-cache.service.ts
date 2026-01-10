import { Injectable } from '@angular/core';

interface CachedLastPhoto {
  timestamp: string;
  cachedAt: number; // Unix timestamp in milliseconds
  expiresAt: number; // Unix timestamp in milliseconds
}

interface CachedDateImages {
  timestamps: string[];
  imageUrls: string[];
  cachedAt: number;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class CameraPicsCacheService {
  private cache: Map<string, CachedLastPhoto> = new Map();
  private dateImagesCache: Map<string, CachedDateImages> = new Map();
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private readonly DATE_IMAGES_CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes for date images

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

  /**
   * Generate cache key for date images
   */
  private getDateImagesCacheKey(developerTag: string, projectTag: string, cameraTag: string, date: string): string {
    return `date-images:${developerTag}/${projectTag}/${cameraTag}/${date}`;
  }

  /**
   * Get cached images for a date
   */
  getDateImages(developerTag: string, projectTag: string, cameraTag: string, date: string): CachedDateImages | null {
    const key = this.getDateImagesCacheKey(developerTag, projectTag, cameraTag, date);
    const cached = this.dateImagesCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    const now = Date.now();
    if (now > cached.expiresAt) {
      this.dateImagesCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Cache images for a date
   */
  setDateImages(
    developerTag: string,
    projectTag: string,
    cameraTag: string,
    date: string,
    timestamps: string[],
    imageUrls: string[]
  ): void {
    const key = this.getDateImagesCacheKey(developerTag, projectTag, cameraTag, date);
    const now = Date.now();

    this.dateImagesCache.set(key, {
      timestamps,
      imageUrls,
      cachedAt: now,
      expiresAt: now + this.DATE_IMAGES_CACHE_DURATION_MS
    });
  }

  /**
   * Check if date images are cached
   */
  hasDateImages(developerTag: string, projectTag: string, cameraTag: string, date: string): boolean {
    return this.getDateImages(developerTag, projectTag, cameraTag, date) !== null;
  }

  /**
   * Clear cache for a specific date
   */
  clearDateImages(developerTag: string, projectTag: string, cameraTag: string, date: string): void {
    const key = this.getDateImagesCacheKey(developerTag, projectTag, cameraTag, date);
    this.dateImagesCache.delete(key);
  }

  /**
   * Clear all date images cache
   */
  clearAllDateImages(): void {
    this.dateImagesCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { lastPhotoCache: number; dateImagesCache: number } {
    return {
      lastPhotoCache: this.cache.size,
      dateImagesCache: this.dateImagesCache.size
    };
  }
}

