import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_CONFIG, getApiUrl } from '../config/api.config';
import { Project, ProjectApiResponse } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  constructor(private http: HttpClient) {}

  /**
   * Get all projects
   */
  getProjects(): Observable<Project[]> {
    return this.http.get<ProjectApiResponse[]>(getApiUrl(API_CONFIG.endpoints.projects))
      .pipe(
        map(projects => projects.map(project => this.mapProjectApiToProject(project)))
      );
  }

  /**
   * Get projects by developer ID
   */
  getProjectsByDeveloperId(developerId: string): Observable<Project[]> {
    const url = `${getApiUrl(API_CONFIG.endpoints.projects)}/dev/${developerId}`;
    return this.http.get<ProjectApiResponse[]>(url)
      .pipe(
        map(projects => projects.map(project => this.mapProjectApiToProject(project)))
      );
  }

  /**
   * Get a single project by ID
   */
  getProjectById(projectId: string): Observable<Project> {
    const url = `${getApiUrl(API_CONFIG.endpoints.projects)}/${projectId}`;
    return this.http.get<ProjectApiResponse>(url)
      .pipe(
        map(project => this.mapProjectApiToProject(project))
      );
  }

  /**
   * Map API response to Project model
   */
  private mapProjectApiToProject(apiProject: ProjectApiResponse): Project {
    // Build image URL from logo (backend URL) - prioritize logo over internalAttachments
    let imageUrl = '';
    if (apiProject.logo) {
      // Logo is a relative path like "logos/project/xxx.png"
      // Construct full backend URL
      if (apiProject.logo.startsWith('http')) {
        imageUrl = apiProject.logo;
      } else {
        imageUrl = `${API_CONFIG.baseUrl}/${apiProject.logo}`;
      }
    } else if (apiProject.internalAttachments && apiProject.internalAttachments.length > 0) {
      // Fallback to internalAttachments only if no logo
      // Only use if it's already a backend URL (not S3)
      const imageAttachment = apiProject.internalAttachments.find(
        att => att.type && att.type.startsWith('image/')
      );
      if (imageAttachment) {
        // Only use if it's a backend URL, not S3
        if (imageAttachment.url && imageAttachment.url.startsWith(API_CONFIG.baseUrl)) {
          imageUrl = imageAttachment.url;
        }
        // Skip S3 URLs - we want backend URLs only
      }
    }

    // Format status for UI display
    let formattedStatus = 'IN PROGRESS';
    if (apiProject.status) {
      const statusLower = apiProject.status.toLowerCase();
      if (statusLower === 'active' || statusLower === 'in progress') {
        formattedStatus = 'IN PROGRESS';
      } else if (statusLower === 'completed' || statusLower === 'finished') {
        // Normalize "finished" to "completed"
        formattedStatus = 'COMPLETED';
      } else {
        formattedStatus = apiProject.status.toUpperCase();
      }
    }

    return {
      id: apiProject._id,
      name: apiProject.projectName || '',
      projectTag: apiProject.projectTag || '',
      description: apiProject.description || '',
      developer: apiProject.developer || '',
      logo: apiProject.logo || '',
      image: imageUrl,
      status: formattedStatus,
      createdDate: apiProject.createdDate || '',
      isActive: apiProject.isActive || 'true',
      blocked: apiProject.blocked || false,
      lat: apiProject.lat || '',
      lng: apiProject.lng || '',
      internalDescription: apiProject.internalDescription || '',
      internalAttachments: apiProject.internalAttachments || [],
      // Default values for UI display
      daysCompleted: 0,
      totalDays: 0,
      timeLapsActive: false
    };
  }
}

