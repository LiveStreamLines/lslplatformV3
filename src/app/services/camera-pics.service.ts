import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { API_CONFIG, getApiUrl } from '../config/api.config';

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
  constructor(private http: HttpClient) {}

  /**
   * Get camera pictures from S3
   * Returns the last photo filename and path
   * @param developerTag - Developer tag (not ID)
   * @param projectTag - Project tag (not ID)
   * @param cameraTag - Camera tag (camera name, not ID)
   */
  getCameraPictures(developerTag: string, projectTag: string, cameraTag: string): Observable<CameraPicturesResponse> {
    const url = `${getApiUrl('/api/camerapics-s3-test')}/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
    
    // POST request with empty body (date filters are optional)
    return this.http.post<CameraPicturesResponse>(url, {}).pipe(
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
   * Get the last image URL for a camera
   * Uses the proxy endpoint to avoid CORS issues
   * @param developerTag - Developer tag (not ID)
   * @param projectTag - Project tag (not ID)
   * @param cameraTag - Camera tag (camera name, not ID)
   */
  getLastImageUrl(developerTag: string, projectTag: string, cameraTag: string): Observable<string> {
    return this.getCameraPictures(developerTag, projectTag, cameraTag).pipe(
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
}

