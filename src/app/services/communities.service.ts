import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Community, DeveloperApiResponse } from '../models/community.model';
import { API_CONFIG, getApiUrl } from '../config/api.config';
import { ProjectApiResponse } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class CommunitiesService {
  private apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.developers}`;
  private projectsUrl = getApiUrl(API_CONFIG.endpoints.projects);

  constructor(private http: HttpClient) {}

  /**
   * Fetch all communities from the API
   * Endpoint: GET https://lsl-platform.com/backend/api/developers
   * Headers: Authorization: Bearer {token}
   * 
   * Maps the API response (DeveloperApiResponse[]) to Community[] format
   * Also fetches project counts for each developer
   */
  getCommunities(): Observable<Community[]> {
    return forkJoin({
      developers: this.http.get<DeveloperApiResponse[]>(this.apiUrl),
      projects: this.http.get<ProjectApiResponse[]>(this.projectsUrl).pipe(
        catchError(() => of([])) // If projects fetch fails, use empty array
      )
    }).pipe(
      map(({ developers, projects }) => {
        // Count projects per developer
        const projectCounts = new Map<string, number>();
        projects.forEach(project => {
          const developerId = project.developer;
          if (developerId) {
            projectCounts.set(developerId, (projectCounts.get(developerId) || 0) + 1);
          }
        });

        // Map developers to communities with project counts
        return developers.map(dev => {
          const community = this.mapDeveloperToCommunity(dev);
          community.projectCount = projectCounts.get(dev._id) || 0;
          return community;
        });
      })
    );
  }

  /**
   * Fetch a single community by ID
   */
  getCommunityById(id: string): Observable<Community> {
    return this.http.get<DeveloperApiResponse>(`${this.apiUrl}/${id}`).pipe(
      map(dev => this.mapDeveloperToCommunity(dev))
    );
  }

  /**
   * Map API Developer response to Community format for UI
   */
  private mapDeveloperToCommunity(developer: DeveloperApiResponse): Community {
    // Get image from internalAttachments if available, otherwise use logo
    let imageUrl = '';
    
    if (developer.internalAttachments && developer.internalAttachments.length > 0) {
      // Use the first attachment URL (already a full URL from S3)
      imageUrl = developer.internalAttachments[0].url;
    } else if (developer.logo) {
      // Logo is a relative path like "logos/developer/xxx.png"
      // Construct full URL
      imageUrl = developer.logo.startsWith('http') 
        ? developer.logo 
        : `${API_CONFIG.baseUrl}/${developer.logo}`;
    }

    return {
      id: developer._id,
      name: developer.developerName,
      projectCount: 0, // Default to 0, can be updated if you have a separate endpoint for project counts
      image: imageUrl,
      description: developer.description,
      logo: developer.logo,
    };
  }
}
