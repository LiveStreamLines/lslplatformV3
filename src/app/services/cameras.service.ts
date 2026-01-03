import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_CONFIG, getApiUrl } from '../config/api.config';
import { Camera, CameraApiResponse } from '../models/camera.model';
import { PROJECT_IMAGE } from '../constants/figma-assets';

@Injectable({
  providedIn: 'root'
})
export class CamerasService {
  constructor(private http: HttpClient) {}

  /**
   * Get all cameras
   */
  getCameras(): Observable<Camera[]> {
    return this.http.get<CameraApiResponse[]>(getApiUrl(API_CONFIG.endpoints.cameras))
      .pipe(
        map(cameras => cameras.map(camera => this.mapCameraApiToCamera(camera)))
      );
  }

  /**
   * Get cameras by project ID
   */
  getCamerasByProjectId(projectId: string): Observable<Camera[]> {
    const url = `${getApiUrl(API_CONFIG.endpoints.cameras)}/proj/${projectId}`;
    return this.http.get<CameraApiResponse[]>(url)
      .pipe(
        map(cameras => cameras.map(camera => this.mapCameraApiToCamera(camera)))
      );
  }

  /**
   * Get a single camera by ID
   */
  getCameraById(cameraId: string): Observable<Camera> {
    const url = `${getApiUrl(API_CONFIG.endpoints.cameras)}/${cameraId}`;
    return this.http.get<CameraApiResponse>(url)
      .pipe(
        map(camera => this.mapCameraApiToCamera(camera))
      );
  }

  /**
   * Map API response to Camera model
   */
  private mapCameraApiToCamera(apiCamera: CameraApiResponse): Camera {
    // Build image URL from internalAttachments
    let imageUrl = PROJECT_IMAGE; // Default fallback
    if (apiCamera.internalAttachments && apiCamera.internalAttachments.length > 0) {
      // Use first image attachment if available
      const imageAttachment = apiCamera.internalAttachments.find(
        att => att.type && att.type.startsWith('image/')
      );
      if (imageAttachment) {
        imageUrl = imageAttachment.url;
      }
    }

    // Initial status - will be updated based on last photo timestamp
    // Default to 'Stopped' if no last photo date is available
    let status: 'Online' | 'Offline' | 'Stopped' = 'Stopped';

    // Format dates - use same format as last photo (DD-MMM-YYYY)
    const installedDate = apiCamera.createdDate 
      ? this.formatDateForDisplay(apiCamera.createdDate)
      : 'N/A';

    // For last photo date, we'll need to fetch this separately or use a default
    // For now, using createdDate as placeholder
    const lastPhotoDate = apiCamera.createdDate
      ? this.formatDateForDisplay(apiCamera.createdDate)
      : 'N/A';

    return {
      id: apiCamera._id,
      name: apiCamera.cameraDescription || apiCamera.camera || 'Camera',
      camera: apiCamera.camera || '',
      cameraDescription: apiCamera.cameraDescription || '',
      project: apiCamera.project || '',
      developer: apiCamera.developer || '',
      image: imageUrl,
      thumbnail: imageUrl,
      status: status,
      installedDate: installedDate,
      lastPhotoDate: lastPhotoDate,
      lastPhotoTime: '14:52:37', // Default, should be fetched from camera pics
      lat: apiCamera.lat,
      lng: apiCamera.lng,
      serverFolder: apiCamera.serverFolder || '',
      country: apiCamera.country || '',
      server: apiCamera.server || '',
      isActive: apiCamera.isActive || 'true',
      createdDate: apiCamera.createdDate || '',
      maintenanceStatus: apiCamera.maintenanceStatus,
      internalAttachments: apiCamera.internalAttachments || []
    };
  }

  /**
   * Format date to DD/MM/YYYY
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Format date for display (DD-MMM-YYYY)
   */
  private formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
}

