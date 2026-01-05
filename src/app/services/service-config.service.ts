import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { API_CONFIG, getApiUrl } from '../config/api.config';

export interface ServiceConfig {
  allowedTags: string[]; // For live camera
  allowedSite: string[]; // For photography
  allowedDrone: string[]; // For drone
}

@Injectable({
  providedIn: 'root'
})
export class ServiceConfigService {
  private apiUrl = getApiUrl('/api/service-config');
  private cachedConfig: ServiceConfig | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Get service configuration from the backend
   */
  getServiceConfig(): Observable<ServiceConfig> {
    // Return cached config if available
    if (this.cachedConfig) {
      return of(this.cachedConfig);
    }

    return this.http.get<ServiceConfig>(this.apiUrl).pipe(
      map(config => {
        // Cache the config
        this.cachedConfig = config;
        return config;
      }),
      catchError(error => {
        console.error('Error fetching service config:', error);
        // Return default config on error
        return of({
          allowedTags: [],
          allowedSite: [],
          allowedDrone: []
        });
      })
    );
  }

  /**
   * Check if a service is active for a project based on its project tag
   */
  isServiceActive(projectTag: string, serviceType: 'live' | 'photography' | 'drone', config: ServiceConfig): boolean {
    if (!projectTag) return false;

    switch (serviceType) {
      case 'live':
        return config.allowedTags.includes(projectTag);
      case 'photography':
        return config.allowedSite.includes(projectTag);
      case 'drone':
        return config.allowedDrone.includes(projectTag);
      default:
        return false;
    }
  }

  /**
   * Clear cached config (useful for refreshing)
   */
  clearCache(): void {
    this.cachedConfig = null;
  }
}

