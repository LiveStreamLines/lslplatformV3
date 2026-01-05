import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as L from 'leaflet';
import { PROJECT_IMAGE, NO_IMAGE } from '../../constants/figma-assets';
import { ProjectsService } from '../../services/projects.service';
import { CamerasService } from '../../services/cameras.service';
import { CameraPicsService } from '../../services/camera-pics.service';
import { CameraPicsCacheService } from '../../services/camera-pics-cache.service';
import { Camera } from '../../models/camera.model';
import { Project } from '../../models/project.model';
import { CommunitiesService } from '../../services/communities.service';
import { API_CONFIG } from '../../config/api.config';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css'
})
export class ProjectDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  projectId: string = '';
  project: Project | null = null;
  projectName = 'Loading...';
  communityName = 'Loading...';
  daysCompleted = 0;
  totalDays = 0;
  progressPercentage = 0;
  bannerImage = PROJECT_IMAGE;
  
  activeTab: 'timelaps' | 'live' | 'satellite' | 'gallery' = 'timelaps';
  viewMode: 'list' | 'map' | 'slideshow' = 'list';
  
  cameras: Camera[] = [];
  isLoading = false;
  isLoadingCameras = false;
  error: string | null = null;
  loadingImages: Set<string> = new Set(); // Track which camera images are loading

  hoveredCameraId: string | null = null;
  quickViewCamera: Camera | null = null;
  isQuickViewOpen = false;
  currentCameraIndex: number = 0;

  @ViewChild('thumbnailMap', { static: false }) thumbnailMapContainer!: ElementRef;
  @ViewChild('fullMap', { static: false }) fullMapContainer!: ElementRef;
  private thumbnailMap: L.Map | null = null;
  private thumbnailMarker: L.Marker | null = null;
  private fullMap: L.Map | null = null;
  private fullMapMarker: L.Marker | null = null;
  isFullMapOpen = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private projectsService: ProjectsService,
    private camerasService: CamerasService,
    private cameraPicsService: CameraPicsService,
    private communitiesService: CommunitiesService,
    private cacheService: CameraPicsCacheService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.projectId = params['id'];
      if (this.projectId) {
        // Load project and cameras in parallel for faster loading
        this.loadProject();
        this.loadCameras();
      }
    });
  }

  setActiveTab(tab: 'timelaps' | 'live' | 'satellite' | 'gallery') {
    this.activeTab = tab;
  }

  setViewMode(mode: 'list' | 'map' | 'slideshow') {
    this.viewMode = mode;
  }

  loadProject() {
    if (!this.projectId) return;

    this.isLoading = true;
    this.error = null;

    this.projectsService.getProjectById(this.projectId).subscribe({
      next: (project) => {
        this.project = project;
        this.projectName = project.name;
        this.bannerImage = project.image || PROJECT_IMAGE;
        this.daysCompleted = project.daysCompleted || 0;
        this.totalDays = project.totalDays || 0;
        this.progressPercentage = this.totalDays > 0 
          ? Math.round((this.daysCompleted / this.totalDays) * 100) 
          : 0;

        // Load community/developer name and developer tag in parallel
        if (project.developer) {
          forkJoin({
            community: this.communitiesService.getCommunityById(project.developer),
            developer: this.http.get<{ developerTag: string }>(`${API_CONFIG.baseUrl}/api/developers/${project.developer}`)
          }).subscribe({
            next: (results) => {
              this.communityName = results.community.name;
              this.developerTag = results.developer.developerTag || '';
              // If cameras are already loaded, load images now
              if (this.cameras.length > 0) {
                this.loadImagesWithTags(this.cameras, this.developerTag, project.projectTag || '');
              }
            },
            error: (err) => {
              console.error('Error loading community/developer:', err);
              this.communityName = 'Unknown';
            }
          });
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading project:', err);
        this.error = 'Failed to load project details.';
        this.isLoading = false;
      }
    });
  }

  loadCameras() {
    if (!this.projectId) return;

    this.isLoadingCameras = true;
    this.error = null;

    this.camerasService.getCamerasByProjectId(this.projectId).subscribe({
      next: (cameras) => {
        this.cameras = cameras;
        // If we already have developerTag and projectTag, load images immediately
        if (this.project && this.developerTag && this.project.projectTag) {
          this.loadImagesWithTags(cameras, this.developerTag, this.project.projectTag);
        } else {
          // Otherwise, wait for tags to be loaded
          this.loadLastImagesForCameras(cameras);
        }
        this.isLoadingCameras = false;
      },
      error: (err) => {
        console.error('Error loading cameras:', err);
        this.error = 'Failed to load cameras.';
        this.isLoadingCameras = false;
        this.cameras = [];
      }
    });
  }

  developerTag: string = '';

  loadLastImagesForCameras(cameras: Camera[]) {
    if (!this.project || cameras.length === 0) return;

    const projectTag = this.project.projectTag || '';

    // If we have developerTag, load images immediately
    if (this.developerTag && projectTag) {
      this.loadImagesWithTags(cameras, this.developerTag, projectTag);
    }
    // If developerTag is not loaded yet, it will be loaded in loadProject() and then trigger image loading
  }

  loadImagesWithTags(cameras: Camera[], developerTag: string, projectTag: string) {
    if (!developerTag || !projectTag) {
      console.warn('Missing developerTag or projectTag');
      return;
    }

    // Create observables for fetching last images for each camera using tags
    const imageRequests = cameras.map(camera => {
      // First try to get from cache
      const cachedTimestamp = this.cacheService.getLastPhoto(
        developerTag,
        projectTag,
        camera.camera
      );

      if (cachedTimestamp) {
        // Return cached data immediately
        return of({
          cameraId: camera.id,
          imageUrl: this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, camera.camera, cachedTimestamp),
          lastPhotoTimestamp: cachedTimestamp
        });
      }

      // Cache miss - fetch from API
      return this.cameraPicsService.getCameraPictures(
        developerTag,
        projectTag,
        camera.camera // camera tag (camera name)
      ).pipe(
        map(response => {
          // Cache the timestamp
          if (response.lastPhoto) {
            this.cacheService.setLastPhoto(
              developerTag,
              projectTag,
              camera.camera,
              response.lastPhoto
            );
          }
          return {
            cameraId: camera.id,
            imageUrl: response.lastPhoto ? this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, camera.camera, response.lastPhoto) : '',
            lastPhotoTimestamp: response.lastPhoto || ''
          };
        }),
        catchError(error => {
          console.warn(`Failed to load last image for camera ${camera.id}:`, error);
          return of({ cameraId: camera.id, imageUrl: '', lastPhotoTimestamp: '' });
        })
      );
    });

    // Mark all cameras as loading images
    cameras.forEach(camera => {
      this.loadingImages.add(camera.id);
    });

    // Subscribe to each request immediately so images load as soon as available
    // This provides progressive loading instead of waiting for all images
    imageRequests.forEach((request, index) => {
      request.subscribe({
        next: (result) => {
          const camera = this.cameras.find(c => c.id === result.cameraId);
          if (camera) {
            // Update last photo date from timestamp
            if (result.lastPhotoTimestamp) {
              camera.lastPhotoDate = this.formatTimestampToDate(result.lastPhotoTimestamp);
              camera.lastPhotoTime = this.formatTimestampToTime(result.lastPhotoTimestamp);
              // Calculate and update status based on last photo timestamp
              camera.status = this.calculateStatusFromTimestamp(result.lastPhotoTimestamp);
              // Set image URL if available
              if (result.imageUrl) {
                camera.image = result.imageUrl;
                camera.thumbnail = result.imageUrl;
              }
            } else {
              // No timestamp means no images - set status to 'Removed' and use NO_IMAGE
              camera.status = 'Removed';
              camera.image = NO_IMAGE;
              camera.thumbnail = NO_IMAGE;
              camera.lastPhotoDate = 'N/A';
              camera.lastPhotoTime = 'N/A';
            }
            // Remove from loading set when image URL is set
            this.loadingImages.delete(camera.id);
          }
        },
        error: (err) => {
          console.warn(`Failed to load image for camera at index ${index}:`, err);
          // Remove from loading set on error
          const camera = this.cameras.find(c => c.id === cameras[index].id);
          if (camera) {
            // If we can't load the last photo (likely no images exist), set status to 'Removed'
            camera.status = 'Removed';
            camera.image = NO_IMAGE;
            camera.thumbnail = NO_IMAGE;
            camera.lastPhotoDate = 'N/A';
            camera.lastPhotoTime = 'N/A';
            this.loadingImages.delete(camera.id);
          }
        }
      });
    });
  }

  /**
   * Format timestamp (YYYYMMDDHHMMSS) to date string (DD-MMM-YYYY)
   */
  formatTimestampToDate(timestamp: string): string {
    if (!timestamp || timestamp.length < 8) return 'N/A';
    
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = months[monthIndex] || month;
    
    return `${day}-${monthName}-${year}`;
  }

  /**
   * Format timestamp (YYYYMMDDHHMMSS) to time string (HH:MM:SS)
   */
  formatTimestampToTime(timestamp: string): string {
    if (!timestamp || timestamp.length < 14) return 'N/A';
    
    const hour = timestamp.substring(8, 10);
    const minute = timestamp.substring(10, 12);
    const second = timestamp.substring(12, 14);
    
    return `${hour}:${minute}:${second}`;
  }

  /**
   * Format coordinate (lat/lng) to string with 6 decimal places
   */
  formatCoordinate(coord: number | string | undefined): string {
    if (coord === undefined || coord === null) return '';
    const num = typeof coord === 'string' ? parseFloat(coord) : coord;
    if (isNaN(num)) return '';
    // Format to 6 decimal places
    return num.toFixed(6);
  }

  /**
   * Calculate camera status based on last photo timestamp
   * Online: Last photo is less than 2 hours ago
   * Offline: Last photo is more than 2 hours ago but less than 5 days ago
   * Stopped: Last photo is more than 5 days ago
   * Removed: No timestamp (no images available)
   */
  calculateStatusFromTimestamp(timestamp: string): 'Online' | 'Offline' | 'Stopped' | 'Removed' {
    if (!timestamp || timestamp.length < 14) return 'Removed';
    
    try {
      // Parse timestamp (YYYYMMDDHHMMSS)
      const year = parseInt(timestamp.substring(0, 4), 10);
      const month = parseInt(timestamp.substring(4, 6), 10) - 1; // Month is 0-indexed
      const day = parseInt(timestamp.substring(6, 8), 10);
      const hour = parseInt(timestamp.substring(8, 10), 10);
      const minute = parseInt(timestamp.substring(10, 12), 10);
      const second = parseInt(timestamp.substring(12, 14), 10);
      
      const lastPhotoDate = new Date(year, month, day, hour, minute, second);
      const now = new Date();
      const diffMs = now.getTime() - lastPhotoDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60); // Convert to hours
      const diffDays = diffHours / 24; // Convert to days
      
      if (diffHours < 2) {
        return 'Online';
      } else if (diffDays < 5) {
        return 'Offline';
      } else {
        return 'Stopped';
      }
    } catch (error) {
      console.error('Error calculating status from timestamp:', error);
      return 'Stopped';
    }
  }

  onCameraHover(cameraId: string) {
    this.hoveredCameraId = cameraId;
  }

  onCameraLeave() {
    this.hoveredCameraId = null;
  }

  openQuickView(camera: Camera, event: Event) {
    event.stopPropagation();
    this.quickViewCamera = camera;
    this.currentCameraIndex = this.cameras.findIndex(c => c.id === camera.id);
    this.isQuickViewOpen = true;
    // Initialize map after view is updated
    setTimeout(() => {
      this.initThumbnailMap();
    }, 100);
  }

  navigatePreviousCamera() {
    if (this.currentCameraIndex > 0) {
      this.currentCameraIndex--;
      this.quickViewCamera = this.cameras[this.currentCameraIndex];
      // Update map when camera changes
      setTimeout(() => {
        this.updateThumbnailMap();
      }, 100);
    }
  }

  navigateNextCamera() {
    if (this.currentCameraIndex < this.cameras.length - 1) {
      this.currentCameraIndex++;
      this.quickViewCamera = this.cameras[this.currentCameraIndex];
      // Update map when camera changes
      setTimeout(() => {
        this.updateThumbnailMap();
      }, 100);
    }
  }

  closeQuickView() {
    this.isQuickViewOpen = false;
    setTimeout(() => {
      this.quickViewCamera = null;
    }, 400);
  }

  onQuickViewBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('quick-view-backdrop')) {
      this.closeQuickView();
    }
  }

  getProgressWidth(): number {
    // Progress bar is 220px wide, so calculate pixel width
    if (this.totalDays === 0) return 0;
    const progressPercentage = (this.daysCompleted / this.totalDays);
    return progressPercentage * 220;
  }

  navigateToCommunities() {
    this.router.navigate(['/communities']);
  }

  navigateToCommunity() {
    if (this.project?.developer) {
      // Navigate to projects page with developer ID to show all projects for this developer
      this.router.navigate(['/projects'], { 
        queryParams: { developerId: this.project.developer } 
      });
    }
  }

  navigateToProjects() {
    if (this.project?.developer) {
      // Navigate to projects page with developer ID as query parameter
      this.router.navigate(['/projects'], { 
        queryParams: { developerId: this.project.developer } 
      });
    }
  }

  onImageLoad(event: Event, cameraId: string) {
    const img = event.target as HTMLImageElement;
    img.style.opacity = '1';
    // Remove from loading set when image actually loads
    this.loadingImages.delete(cameraId);
  }

  onImageError(event: Event, camera: Camera) {
    this.loadingImages.delete(camera.id); // Image failed to load
    // Use NO_IMAGE if status is Removed, otherwise use PROJECT_IMAGE
    const fallbackImage = camera.status === 'Removed' ? NO_IMAGE : PROJECT_IMAGE;
    camera.image = fallbackImage;
    camera.thumbnail = fallbackImage;
    if (camera.status !== 'Removed') {
      camera.status = 'Stopped'; // Set status to stopped on image error (unless already Removed)
    }
  }

  ngAfterViewInit() {
    // Map will be initialized when quick view opens
  }

  ngOnDestroy() {
    // Clean up map when component is destroyed
    if (this.thumbnailMap) {
      this.thumbnailMap.remove();
      this.thumbnailMap = null;
    }
  }

  private initThumbnailMap() {
    if (!this.quickViewCamera || !this.quickViewCamera.lat || !this.quickViewCamera.lng) {
      return;
    }

    // Wait for view to update
    setTimeout(() => {
      if (!this.thumbnailMapContainer?.nativeElement) {
        return;
      }

      const container = this.thumbnailMapContainer.nativeElement;
      
      // Check if container has dimensions
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        setTimeout(() => this.initThumbnailMap(), 100);
        return;
      }

      // Fix Leaflet default icon issue
      this.fixLeafletIcons();

      const lat = typeof this.quickViewCamera!.lat === 'string' 
        ? parseFloat(this.quickViewCamera!.lat) 
        : this.quickViewCamera!.lat!;
      const lng = typeof this.quickViewCamera!.lng === 'string' 
        ? parseFloat(this.quickViewCamera!.lng) 
        : this.quickViewCamera!.lng!;

      // Initialize map with lower zoom to show more area
      this.thumbnailMap = L.map(container, {
        center: [lat, lng],
        zoom: 5,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        dragging: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        crossOrigin: true
      }).addTo(this.thumbnailMap);

      // Add marker for camera location
      const markerIcon = L.divIcon({
        className: 'thumbnail-map-marker',
        html: `<div style="background: #5621d2; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      this.thumbnailMarker = L.marker([lat, lng], { icon: markerIcon })
        .addTo(this.thumbnailMap);

      // Fit bounds to show marker with some padding
      this.thumbnailMap.fitBounds([[lat, lng]], { padding: [10, 10] });
    }, 50);
  }

  private updateThumbnailMap() {
    if (!this.quickViewCamera || !this.quickViewCamera.lat || !this.quickViewCamera.lng) {
      if (this.thumbnailMap) {
        this.thumbnailMap.remove();
        this.thumbnailMap = null;
        this.thumbnailMarker = null;
      }
      return;
    }

    if (!this.thumbnailMap) {
      this.initThumbnailMap();
      return;
    }

    const lat = typeof this.quickViewCamera.lat === 'string' 
      ? parseFloat(this.quickViewCamera.lat) 
      : this.quickViewCamera.lat!;
    const lng = typeof this.quickViewCamera.lng === 'string' 
      ? parseFloat(this.quickViewCamera.lng) 
      : this.quickViewCamera.lng!;

    // Update map center with lower zoom
    this.thumbnailMap.setView([lat, lng], 5);

    // Update or create marker
    if (this.thumbnailMarker) {
      this.thumbnailMarker.setLatLng([lat, lng]);
    } else {
      const markerIcon = L.divIcon({
        className: 'thumbnail-map-marker',
        html: `<div style="background: #5621d2; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      this.thumbnailMarker = L.marker([lat, lng], { icon: markerIcon })
        .addTo(this.thumbnailMap);
    }

    // Fit bounds
    this.thumbnailMap.fitBounds([[lat, lng]], { padding: [10, 10] });
  }

  openFullMap() {
    if (!this.quickViewCamera || !this.quickViewCamera.lat || !this.quickViewCamera.lng) {
      return;
    }
    this.isFullMapOpen = true;
    setTimeout(() => {
      this.initFullMap();
    }, 100);
  }

  closeFullMap(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.isFullMapOpen = false;
    if (this.fullMap) {
      setTimeout(() => {
        this.fullMap?.remove();
        this.fullMap = null;
        this.fullMapMarker = null;
      }, 300);
    }
  }

  private initFullMap() {
    if (!this.quickViewCamera || !this.quickViewCamera.lat || !this.quickViewCamera.lng) {
      return;
    }

    const camera = this.quickViewCamera; // Store reference to avoid null checks

    setTimeout(() => {
      if (!this.fullMapContainer?.nativeElement) {
        return;
      }

      const container = this.fullMapContainer.nativeElement;
      
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        setTimeout(() => this.initFullMap(), 100);
        return;
      }

      // Fix Leaflet default icon issue
      this.fixLeafletIcons();

      const lat = typeof camera.lat === 'string' 
        ? parseFloat(camera.lat) 
        : camera.lat!;
      const lng = typeof camera.lng === 'string' 
        ? parseFloat(camera.lng) 
        : camera.lng!;

      // Initialize full map
      this.fullMap = L.map(container, {
        center: [lat, lng],
        zoom: 13,
        zoomControl: true,
        attributionControl: true
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        crossOrigin: true,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.fullMap);

      // Add marker for camera location
      const markerIcon = L.divIcon({
        className: 'full-map-marker',
        html: `<div style="background: #5621d2; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      this.fullMapMarker = L.marker([lat, lng], { icon: markerIcon })
        .addTo(this.fullMap)
        .bindPopup(`
          <div class="map-popup">
            <h3>${camera.name || 'Camera'}</h3>
            <p>Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
          </div>
        `);

      // Fit bounds to show marker with padding
      this.fullMap.fitBounds([[lat, lng]], { padding: [50, 50] });

      // Invalidate size to ensure proper rendering
      setTimeout(() => {
        this.fullMap?.invalidateSize();
      }, 100);
    }, 50);
  }

  private fixLeafletIcons() {
    // Fix Leaflet default icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }
}

