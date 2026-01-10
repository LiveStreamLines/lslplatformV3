import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { API_CONFIG, getApiUrl } from '../config/api.config';
import { CameraPicsCacheService } from './camera-pics-cache.service';

export interface CameraPicturesResponse {
  firstPhoto: string;
  lastPhoto: string;
  firstPhotoUrl?: string;
  lastPhotoUrl?: string;
  date1Photos: string[];
  date2Photos: string[];
  path: string;
}

@Injectable({
  providedIn: 'root'
})
export class CameraPicsService {
  constructor(
    private http: HttpClient,
    private cacheService: CameraPicsCacheService
  ) {}

  /**
   * Get camera pictures from S3
   * Returns the last photo filename and path
   * @param developerTag - Developer tag (not ID)
   * @param projectTag - Project tag (not ID)
   * @param cameraTag - Camera tag (camera name, not ID)
   * @param date1 - Optional start date filter in YYYYMMDD format
   * @param date2 - Optional end date filter in YYYYMMDD format
   */
  getCameraPictures(developerTag: string, projectTag: string, cameraTag: string, date1?: string, date2?: string): Observable<CameraPicturesResponse> {
    const url = `${getApiUrl('/api/camerapics-s3-test')}/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
    
    // POST request with optional date filters
    const body: any = {};
    if (date1) body.date1 = date1;
    if (date2) body.date2 = date2;
    
    return this.http.post<CameraPicturesResponse>(url, body).pipe(
      catchError(error => {
        console.error('Error fetching camera pictures:', error);
        // Return empty response on error
        return of({
          firstPhoto: '',
          lastPhoto: '',
          date1Photos: [],
          date2Photos: [],
          path: ''
        });
      })
    );
  }

  /**
   * Get presigned URL for a specific image using the get-image-e2 endpoint
   * @param developerTag - Developer tag (not ID)
   * @param projectTag - Project tag (not ID)
   * @param cameraTag - Camera tag (camera name, not ID)
   * @param imageTimestamp - Image timestamp (YYYYMMDDHHMMSS format, e.g., "20251230021102")
   */
  getImagePresignedUrl(developerTag: string, projectTag: string, cameraTag: string, imageTimestamp: string): Observable<string> {
    const url = `${getApiUrl('/api/camerapics-s3-test')}/image/${developerTag}/${projectTag}/${cameraTag}/${imageTimestamp}`;
    
    return this.http.get<{ url: string; key: string; expiresIn: number }>(url).pipe(
      map(response => response.url),
      catchError(error => {
        console.error('Error fetching presigned URL from get-image-e2:', error);
        return of('');
      })
    );
  }

  /**
   * Get proxied image URL (uses backend proxy to avoid CORS issues)
   * @param developerTag - Developer tag (not ID)
   * @param projectTag - Project tag (not ID)
   * @param cameraTag - Camera tag (camera name, not ID)
   * @param imageTimestamp - Image timestamp (YYYYMMDDHHMMSS format, e.g., "20251230021102")
   */
  getProxiedImageUrl(developerTag: string, projectTag: string, cameraTag: string, imageTimestamp: string): string {
    // Return the proxy endpoint URL directly - the backend will handle fetching from S3 with CORS headers
    return `${getApiUrl('/api/camerapics-s3-test')}/proxy/${developerTag}/${projectTag}/${cameraTag}/${imageTimestamp}`;
  }

  /**
   * Get direct S3 image URL from path and timestamp
   * Constructs the URL directly from the S3 path structure: upload/{developer-tag}/{project-tag}/camera/{timestamp}
   * @param path - Base path from API response (e.g., "http://lsl-platform.com/media/upload/butech/waste/camera1/")
   * @param timestamp - Image timestamp (YYYYMMDDHHMMSS format, e.g., "20260104003549")
   * @param extension - File extension (default: ".jpg", will try multiple if first fails)
   * @returns Direct S3 URL
   */
  getDirectS3ImageUrl(path: string, timestamp: string, extension: string = '.jpg'): string {
    if (!path || !timestamp) {
      return '';
    }
    
    // Ensure path ends with '/'
    const cleanPath = path.endsWith('/') ? path : path + '/';
    
    // Construct direct URL: path + timestamp + extension
    // Example: http://lsl-platform.com/media/upload/butech/waste/camera1/20260104003549.jpg
    return `${cleanPath}${timestamp}${extension}`;
  }

  /**
   * Get direct S3 image URLs with multiple extensions (for fallback)
   * Tries common extensions: .jpg, .jpeg, .png
   * @param path - Base path from API response
   * @param timestamp - Image timestamp
   * @returns Array of possible URLs to try
   */
  getDirectS3ImageUrlsWithExtensions(path: string, timestamp: string): string[] {
    if (!path || !timestamp) {
      return [];
    }
    
    const extensions = ['.jpg', '.jpeg', '.png'];
    return extensions.map(ext => this.getDirectS3ImageUrl(path, timestamp, ext));
  }

  /**
   * Alternative: Construct direct S3 URL from tags and timestamp
   * Uses the S3 bucket structure: upload/{developer-tag}/{project-tag}/{camera-tag}/{timestamp}
   * @param s3BaseUrl - Base S3 URL (e.g., "http://lsl-platform.com/media" or S3 bucket URL)
   * @param developerTag - Developer tag
   * @param projectTag - Project tag
   * @param cameraTag - Camera tag
   * @param timestamp - Image timestamp (YYYYMMDDHHMMSS format)
   * @param extension - File extension (default: ".jpg")
   * @returns Direct S3 URL
   */
  getDirectS3ImageUrlFromTags(
    s3BaseUrl: string, 
    developerTag: string, 
    projectTag: string, 
    cameraTag: string, 
    timestamp: string, 
    extension: string = '.jpg'
  ): string {
    if (!s3BaseUrl || !developerTag || !projectTag || !cameraTag || !timestamp) {
      return '';
    }
    
    // Ensure base URL doesn't end with '/'
    const cleanBaseUrl = s3BaseUrl.endsWith('/') ? s3BaseUrl.slice(0, -1) : s3BaseUrl;
    
    // Construct URL: baseUrl/upload/developerTag/projectTag/cameraTag/timestamp.ext
    return `${cleanBaseUrl}/upload/${developerTag}/${projectTag}/${cameraTag}/${timestamp}${extension}`;
  }

  /**
   * Get the last image URL for a camera
   * Uses the proxy endpoint to avoid CORS issues
   * Checks cache first to avoid unnecessary API calls
   * @param developerTag - Developer tag (not ID)
   * @param projectTag - Project tag (not ID)
   * @param cameraTag - Camera tag (camera name, not ID)
   */
  getLastImageUrl(developerTag: string, projectTag: string, cameraTag: string): Observable<string> {
    // Check cache first
    const cachedTimestamp = this.cacheService.getLastPhoto(developerTag, projectTag, cameraTag);
    if (cachedTimestamp) {
      // Return cached image URL immediately
      return of(this.getProxiedImageUrl(developerTag, projectTag, cameraTag, cachedTimestamp));
    }

    // Cache miss - fetch from API
    return this.getCameraPictures(developerTag, projectTag, cameraTag).pipe(
      tap(response => {
        // Cache the last photo timestamp
        if (response.lastPhoto) {
          this.cacheService.setLastPhoto(developerTag, projectTag, cameraTag, response.lastPhoto);
        }
      }),
      map(response => {
        // If we have the last photo filename, use proxy endpoint to avoid CORS
        if (response.lastPhoto) {
          return this.getProxiedImageUrl(developerTag, projectTag, cameraTag, response.lastPhoto);
        }
        return '';
      })
    );
  }

  /**
   * Get all images for today
   * @param developerTag - Developer tag (not ID)
   * @param projectTag - Project tag (not ID)
   * @param cameraTag - Camera tag (camera name, not ID)
   * @returns Observable of image URLs array
   */
  getTodayImages(developerTag: string, projectTag: string, cameraTag: string): Observable<string[]> {
    // Get today's date in YYYYMMDD format
    const today = new Date();
    const todayStr = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    const url = `${getApiUrl('/api/camerapics-s3-test')}/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
    
    // POST request with today's date for both date1 and date2
    return this.http.post<CameraPicturesResponse>(url, { date1: todayStr, date2: todayStr }).pipe(
      map(response => {
        // Combine date1Photos and date2Photos (they should be the same for today)
        const allTodayPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        
        if (allTodayPhotos.length === 0) {
          return [];
        }

        // Use proxy URLs to avoid CORS issues
        return allTodayPhotos.map(timestamp => 
          this.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
        );
      }),
      catchError(error => {
        console.error('Error fetching today\'s images:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all available dates for a camera (optimized endpoint)
   * Returns unique dates (YYYY-MM-DD format) that have images
   * @param developerTag - Developer tag (not ID)
   * @param projectTag - Project tag (not ID)
   * @param cameraTag - Camera tag (camera name, not ID)
   * @returns Observable of available dates array and metadata
   */
  getAvailableDates(developerTag: string, projectTag: string, cameraTag: string): Observable<{
    availableDates: string[];
    count: number;
    firstDate: string | null;
    lastDate: string | null;
    source?: string;
  }> {
    const url = `${getApiUrl('/api/camerapics-s3-test')}/${developerTag}/${projectTag}/${cameraTag}/available-dates`;
    
    return this.http.get<{
      availableDates: string[];
      count: number;
      firstDate: string | null;
      lastDate: string | null;
      source?: string;
    }>(url).pipe(
      catchError(error => {
        console.error('Error fetching available dates:', error);
        return of({
          availableDates: [],
          count: 0,
          firstDate: null,
          lastDate: null
        });
      })
    );
  }
}

