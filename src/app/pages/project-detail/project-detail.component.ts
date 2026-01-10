import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as L from 'leaflet';
import { PROJECT_IMAGE, NO_IMAGE, COMMUNITY_IMAGES, ICONS } from '../../constants/figma-assets';
import { ProjectsService } from '../../services/projects.service';
import { CamerasService } from '../../services/cameras.service';
import { CameraPicsService } from '../../services/camera-pics.service';
import { CameraPicsCacheService } from '../../services/camera-pics-cache.service';
import { Camera } from '../../models/camera.model';
import { Project } from '../../models/project.model';
import { CommunitiesService } from '../../services/communities.service';
import { ServiceConfigService, ServiceConfig } from '../../services/service-config.service';
import { API_CONFIG } from '../../config/api.config';
import { MAP_THEMES, DEFAULT_MAP_THEME } from '../../config/map-themes.config';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css'
})
export class ProjectDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  projectId: string = '';
  project: Project | null = null;
  projectName = 'Loading...';
  communityName = 'Loading...';
  communityImage: string = '';
  daysCompleted = 0;
  totalDays = 0;
  progressPercentage = 0;
  bannerImage: string | null = null;
  isBannerImageLoading = false;
  
  activeTab: 'timelaps' | 'live' | 'satellite' | 'gallery' = 'timelaps';
  viewMode: 'list' | 'map' | 'slideshow' = 'list';
  mapTheme: string = DEFAULT_MAP_THEME; // Current map theme
  
  serviceConfig: ServiceConfig | null = null;
  icons = ICONS;
  
  cameras: Camera[] = [];
  isLoading = false;
  isLoadingCameras = false;
  isLoadingImages = false; // Track if we're loading camera images
  isPreloadingLastDayImages = false; // Track if we're preloading last day images
  error: string | null = null;
  loadingImages: Set<string> = new Set(); // Track which camera images are loading
  preloadingProgress: { loaded: number; total: number } = { loaded: 0, total: 0 }; // Track preloading progress

  hoveredCameraId: string | null = null;
  quickViewCamera: Camera | null = null;
  isQuickViewOpen = false;
  currentCameraIndex: number = 0;

  @ViewChild('thumbnailMap', { static: false }) thumbnailMapContainer!: ElementRef;
  @ViewChild('fullMap', { static: false }) fullMapContainer!: ElementRef;
  @ViewChild('projectMap', { static: false }) projectMapContainer!: ElementRef;
  private thumbnailMap: L.Map | null = null;
  private thumbnailMarker: L.Marker | null = null;
  private fullMap: L.Map | null = null;
  private fullMapMarker: L.Marker | null = null;
  private projectMap: L.Map | null = null;
  private projectMapMarkers: L.Marker[] = [];
  isFullMapOpen = false;
  
  // Map view state
  selectedMapCamera: Camera | null = null;
  thumbnailCardPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private projectsService: ProjectsService,
    private camerasService: CamerasService,
    private cameraPicsService: CameraPicsService,
    private communitiesService: CommunitiesService,
    private serviceConfigService: ServiceConfigService,
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
    // Prevent switching to inactive services
    if (tab === 'live' && !this.isServiceActive('live')) {
      return;
    }
    if (tab === 'satellite' && !this.isServiceActive('satellite')) {
      return;
    }
    this.activeTab = tab;
  }

  // Get array of theme keys for iteration
  getThemeKeys(): string[] {
    return Object.keys(MAP_THEMES);
  }

  // Get theme name by key
  getThemeName(themeKey: string): string {
    return MAP_THEMES[themeKey]?.name || themeKey;
  }

  // Method to change map theme
  setMapTheme(themeKey: string) {
    if (MAP_THEMES[themeKey]) {
      this.mapTheme = themeKey;
      // Reinitialize maps with new theme if they are already initialized
      if (this.projectMap) {
        this.projectMap.remove();
        this.projectMap = null;
        this.projectMapMarkers = [];
        setTimeout(() => {
          this.initProjectMap();
        }, 100);
      }
      if (this.thumbnailMap) {
        this.thumbnailMap.remove();
        this.thumbnailMap = null;
        this.thumbnailMarker = null;
        if (this.quickViewCamera) {
          setTimeout(() => {
            this.initThumbnailMap();
          }, 100);
        }
      }
      if (this.fullMap) {
        this.fullMap.remove();
        this.fullMap = null;
        this.fullMapMarker = null;
        if (this.quickViewCamera) {
          setTimeout(() => {
            this.initFullMap();
          }, 100);
        }
      }
    }
  }

  setViewMode(mode: 'list' | 'map' | 'slideshow') {
    this.viewMode = mode;
    if (mode === 'map') {
      // Initialize map when switching to map view
      setTimeout(() => {
        this.initProjectMap();
      }, 100);
    } else {
      // Clean up map when switching away
      if (this.projectMap) {
        this.projectMap.remove();
        this.projectMap = null;
        this.projectMapMarkers = [];
      }
      this.selectedMapCamera = null;
    }
  }

  /**
   * Calculate project progress based on creation date
   * Uses 3 years (1095 days) as total duration
   */
  private calculateProjectProgress(project: Project): { daysCompleted: number; totalDays: number } {
    const THREE_YEARS_DAYS = 1095; // 3 years = 365 * 3 = 1095 days
    const totalDays = THREE_YEARS_DAYS;

    if (!project.createdDate) {
      // If no creation date, return 0 progress
      return { daysCompleted: 0, totalDays };
    }

    try {
      // Parse creation date (assuming ISO format or YYYY-MM-DD)
      const createdDate = new Date(project.createdDate);
      const today = new Date();
      
      // Set time to midnight for accurate day calculation
      today.setHours(0, 0, 0, 0);
      createdDate.setHours(0, 0, 0, 0);

      // Calculate days difference
      const timeDiff = today.getTime() - createdDate.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

      // Days completed should be between 0 and totalDays
      const daysCompleted = Math.max(0, Math.min(daysDiff, totalDays));

      return { daysCompleted, totalDays };
    } catch (error) {
      console.error('Error calculating project progress for project:', project.id, error);
      return { daysCompleted: 0, totalDays };
    }
  }

  loadProject() {
    if (!this.projectId) return;

    this.isLoading = true;
    this.isBannerImageLoading = false;
    this.bannerImage = null; // Reset banner image when starting new load
    this.error = null;

    // Load project and service config in parallel
    forkJoin({
      project: this.projectsService.getProjectById(this.projectId),
      serviceConfig: this.serviceConfigService.getServiceConfig()
    }).subscribe({
      next: ({ project, serviceConfig }) => {
        this.project = project;
        this.projectName = project.name;
        this.serviceConfig = serviceConfig;
        
        // Calculate progress based on creation date (3 years = 1095 days)
        const calculatedProgress = this.calculateProjectProgress(project);
        this.daysCompleted = calculatedProgress.daysCompleted;
        this.totalDays = calculatedProgress.totalDays;
        this.progressPercentage = this.totalDays > 0 
          ? Math.round((this.daysCompleted / this.totalDays) * 100) 
          : 0;
        
        // If current active tab is disabled, switch to timelaps
        if (this.activeTab === 'live' && !this.isServiceActive('live')) {
          this.activeTab = 'timelaps';
        }
        if (this.activeTab === 'satellite' && !this.isServiceActive('satellite')) {
          this.activeTab = 'timelaps';
        }

        // Load community/developer name and developer tag in parallel
        if (project.developer) {
          forkJoin({
            community: this.communitiesService.getCommunityById(project.developer),
            developer: this.http.get<{ developerTag: string }>(`${API_CONFIG.baseUrl}/api/developers/${project.developer}`)
          }).subscribe({
            next: (results) => {
              this.communityName = results.community.name;
              this.communityImage = results.community.image || COMMUNITY_IMAGES[results.community.name as keyof typeof COMMUNITY_IMAGES] || '';
              this.developerTag = results.developer.developerTag || '';
              // If cameras are already loaded, load images now
              if (this.cameras.length > 0) {
                this.loadImagesWithTags(this.cameras, this.developerTag, project.projectTag || '');
                // Preload last day images for all cameras
                this.preloadLastDayImagesForAllCameras(this.cameras, this.developerTag, project.projectTag || '');
              }
            },
            error: (err) => {
              console.error('Error loading community/developer:', err);
              this.communityName = 'Unknown';
            }
          });
        }

        // Preload the banner image to avoid showing static image first
        if (project.image) {
          this.isBannerImageLoading = true;
          const img = new Image();
          img.onload = () => {
            // Image is fully loaded, now set it (this prevents the flash)
            this.bannerImage = project.image!;
            this.isBannerImageLoading = false;
          };
          img.onerror = () => {
            // Image failed to load, set to null (no fallback)
            this.bannerImage = null;
            this.isBannerImageLoading = false;
          };
          img.src = project.image;
        } else {
          // No image, set to null
          this.bannerImage = null;
          this.isBannerImageLoading = false;
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

  /**
   * Check if a service is active for the current project
   */
  isServiceActive(service: 'live' | 'satellite'): boolean {
    if (!this.project || !this.serviceConfig) {
      return false;
    }
    
    if (service === 'live') {
      return this.serviceConfigService.isServiceActive(this.project.projectTag, 'live', this.serviceConfig);
    }
    
    // Satellite is always inactive for now (not in service config)
    if (service === 'satellite') {
      return false;
    }
    
    return false;
  }

  /**
   * Handle tab click - prevent switching to inactive services
   */
  handleTabClick(tab: 'timelaps' | 'live' | 'satellite' | 'gallery') {
    // Allow timelaps and gallery always
    if (tab === 'timelaps' || tab === 'gallery') {
      this.setActiveTab(tab);
      return;
    }
    
    // Check if service is active before switching
    if (tab === 'live' && !this.isServiceActive('live')) {
      return; // Don't switch if service is inactive
    }
    
    if (tab === 'satellite' && !this.isServiceActive('satellite')) {
      return; // Don't switch if service is inactive
    }
    
    this.setActiveTab(tab);
  }

  loadCameras() {
    if (!this.projectId) return;

    this.isLoadingCameras = true;
    this.isLoadingImages = true;
    this.error = null;

    this.camerasService.getCamerasByProjectId(this.projectId).subscribe({
      next: (cameras) => {
        // Clear any existing images to prevent static image flash
        cameras.forEach(camera => {
          camera.image = null;
          camera.thumbnail = null;
        });
        this.cameras = cameras;
        // If we already have developerTag and projectTag, load images immediately
        if (this.project && this.developerTag && this.project.projectTag) {
          this.loadImagesWithTags(cameras, this.developerTag, this.project.projectTag);
          // Start preloading last day images for all cameras
          this.preloadLastDayImagesForAllCameras(cameras, this.developerTag, this.project.projectTag);
        } else {
          // Otherwise, wait for tags to be loaded
          this.loadLastImagesForCameras(cameras);
        }
        this.isLoadingCameras = false;
        
        // Initialize map if we're in map view mode
        if (this.viewMode === 'map') {
          setTimeout(() => {
            this.initProjectMap();
          }, 100);
        }
      },
      error: (err) => {
        console.error('Error loading cameras:', err);
        this.error = 'Failed to load cameras.';
        this.isLoadingCameras = false;
        this.isLoadingImages = false;
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

    // Store paths for cameras to use for direct S3 URLs
    const cameraPaths: Map<string, string> = new Map();

    // Create observables for fetching last images for each camera using tags
    const imageRequests = cameras.map(camera => {
      // First try to get from cache
      const cachedTimestamp = this.cacheService.getLastPhoto(
        developerTag,
        projectTag,
        camera.camera
      );

      if (cachedTimestamp) {
        // Return cached data immediately - try to use direct S3 URL if we have path
        // For cached timestamps, we'll still use proxied URL since we don't have path stored
        // In production, you might want to cache the path as well
        return of({
          cameraId: camera.id,
          imageUrl: this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, camera.camera, cachedTimestamp),
          lastPhotoTimestamp: cachedTimestamp,
          path: '' // No path available for cached data
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
          // Store path for this camera
          if (response.path) {
            cameraPaths.set(camera.id, response.path);
          }
          
          // Use direct S3 URL if path is available (faster than proxy), otherwise use proxied URL
          let imageUrl = '';
          if (response.lastPhoto) {
            if (response.path) {
              // Use direct S3 URL from path - much faster!
              imageUrl = this.cameraPicsService.getDirectS3ImageUrl(response.path, response.lastPhoto);
              console.log(`✓ Using direct S3 URL for camera ${camera.name}: ${imageUrl}`);
            } else {
              // Fallback to proxied URL
              imageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, camera.camera, response.lastPhoto);
            }
          }
          return {
            cameraId: camera.id,
            imageUrl: imageUrl,
            lastPhotoTimestamp: response.lastPhoto || '',
            path: response.path || '' // Store path for future use
          };
        }),
        catchError(error => {
          console.warn(`Failed to load last image for camera ${camera.id}:`, error);
          return of({ cameraId: camera.id, imageUrl: '', lastPhotoTimestamp: '', path: '' });
        })
      );
    });

    // Mark all cameras as loading images
    cameras.forEach(camera => {
      this.loadingImages.add(camera.id);
    });

    // Track loading completion
    let completedCount = 0;
    const totalCameras = cameras.length;

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
              // Store path if available for future direct S3 URL construction
              if ((result as any).path) {
                cameraPaths.set(camera.id, (result as any).path);
              }
              
              // Preload image before setting to avoid static image flash
              // Use direct S3 URL if available, otherwise fall back to proxied
              if (result.imageUrl) {
                // If we have path, use direct S3 URL for preloading
                if ((result as any).path && result.lastPhotoTimestamp) {
                  const directUrl = this.cameraPicsService.getDirectS3ImageUrl((result as any).path, result.lastPhotoTimestamp);
                  this.preloadImageWithDirectUrl(camera, directUrl, result.lastPhotoTimestamp, developerTag, projectTag, camera.camera);
                } else {
                  this.preloadImageWithFallback(
                    camera,
                    result.lastPhotoTimestamp,
                    developerTag,
                    projectTag,
                    camera.camera
                  );
                }
              } else {
                // No image URL, remove from loading
                this.loadingImages.delete(camera.id);
                completedCount++;
                if (completedCount === totalCameras) {
                  this.isLoadingImages = false;
                }
              }
            } else {
              // No timestamp means no images - set status to 'Removed' and set image to no-image.png
              camera.status = 'Removed';
              camera.image = NO_IMAGE;
              camera.thumbnail = NO_IMAGE;
              camera.lastPhotoDate = 'N/A';
              camera.lastPhotoTime = 'N/A';
              this.loadingImages.delete(camera.id); // Stop skeleton
              completedCount++;
              if (completedCount === totalCameras) {
                this.isLoadingImages = false;
              }
            }
            // Loading state is managed in the preload handlers above
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
            this.loadingImages.delete(camera.id); // Stop skeleton
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

  /**
   * Preload image with fallback to previous images if current one fails
   */
  /**
   * Preload image using direct S3 URL (faster than proxy)
   * Falls back to proxied URL if direct URL fails
   */
  private preloadImageWithDirectUrl(
    camera: Camera,
    directUrl: string,
    timestamp: string,
    developerTag: string,
    projectTag: string,
    cameraTag: string
  ) {
    if (!directUrl || !timestamp || timestamp.length < 14) {
      // Invalid URL or timestamp, fall back to proxied URL
      this.preloadImageWithFallback(camera, timestamp, developerTag, projectTag, cameraTag);
      return;
    }

    const img = new Image();
    
    img.onload = () => {
      // Direct S3 URL loaded successfully - much faster!
      camera.image = directUrl;
      camera.thumbnail = directUrl;
      this.loadingImages.delete(camera.id);
      this.checkAllImagesLoaded();
      console.log(`✓ Direct S3 URL loaded successfully for camera ${camera.name}`);
    };
    
    img.onerror = () => {
      // Direct S3 URL failed (might be CORS issue or wrong path), fall back to proxied URL
      console.warn(`Direct S3 URL failed for camera ${camera.name}, falling back to proxied URL`);
      this.preloadImageWithFallback(camera, timestamp, developerTag, projectTag, cameraTag);
    };
    
    img.src = directUrl;
  }

  private preloadImageWithFallback(
    camera: Camera,
    timestamp: string,
    developerTag: string,
    projectTag: string,
    cameraTag: string,
    attemptIndex: number = 0
  ) {
    if (!timestamp || timestamp.length < 14) {
      // No valid timestamp, show no-image
      camera.image = NO_IMAGE;
      camera.thumbnail = NO_IMAGE;
      camera.status = 'Removed';
      this.loadingImages.delete(camera.id);
      return;
    }

    const imageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp);
    const img = new Image();
    
    img.onload = () => {
      // Image is fully loaded, now set it
      camera.image = imageUrl;
      camera.thumbnail = imageUrl;
      this.loadingImages.delete(camera.id);
      // Check if all images are loaded
      this.checkAllImagesLoaded();
    };
    
    img.onerror = () => {
      // Image failed to load - first try to get images for the same date
      if (attemptIndex === 0) {
        // First attempt: try to get all images for this date and use the last available one
        this.tryGetImagesForDate(camera, timestamp, developerTag, projectTag, cameraTag);
      } else if (attemptIndex < 5) {
        // Subsequent attempts: try previous timestamp
        const previousTimestamp = this.getPreviousTimestamp(timestamp, attemptIndex - 1);
        
        if (previousTimestamp) {
          console.log(`Image ${timestamp} failed, trying previous: ${previousTimestamp}`);
          // Try previous image
          this.preloadImageWithFallback(
            camera,
            previousTimestamp,
            developerTag,
            projectTag,
            cameraTag,
            attemptIndex + 1
          );
        } else {
          // No more timestamps to try, show no-image
          this.handleImageLoadFailure(camera);
        }
      } else {
        // Too many attempts, show no-image
        this.handleImageLoadFailure(camera);
      }
    };
    
    img.src = imageUrl;
  }

  /**
   * Get previous timestamp by subtracting time
   */
  private getPreviousTimestamp(timestamp: string, attemptIndex: number): string | null {
    if (!timestamp || timestamp.length < 14) return null;
    
    try {
      const year = parseInt(timestamp.substring(0, 4), 10);
      const month = parseInt(timestamp.substring(4, 6), 10) - 1; // Month is 0-indexed
      const day = parseInt(timestamp.substring(6, 8), 10);
      const hour = parseInt(timestamp.substring(8, 10), 10);
      const minute = parseInt(timestamp.substring(10, 12), 10);
      const second = parseInt(timestamp.substring(12, 14), 10);
      
      const date = new Date(year, month, day, hour, minute, second);
      
      // First attempt: subtract 1 hour
      // Second attempt: subtract 6 hours
      // Third attempt: subtract 1 day
      // Fourth attempt: subtract 1 week
      let subtractMs = 0;
      switch (attemptIndex) {
        case 0:
          subtractMs = 60 * 60 * 1000; // 1 hour
          break;
        case 1:
          subtractMs = 6 * 60 * 60 * 1000; // 6 hours
          break;
        case 2:
          subtractMs = 24 * 60 * 60 * 1000; // 1 day
          break;
        case 3:
          subtractMs = 7 * 24 * 60 * 60 * 1000; // 1 week
          break;
        default:
          return null;
      }
      
      date.setTime(date.getTime() - subtractMs);
      
      // Format back to YYYYMMDDHHMMSS
      const yearStr = date.getFullYear().toString();
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      const hourStr = String(date.getHours()).padStart(2, '0');
      const minuteStr = String(date.getMinutes()).padStart(2, '0');
      const secondStr = String(date.getSeconds()).padStart(2, '0');
      
      return `${yearStr}${monthStr}${dayStr}${hourStr}${minuteStr}${secondStr}`;
    } catch (error) {
      console.error('Error calculating previous timestamp:', error);
      return null;
    }
  }

  /**
   * Handle image load failure - try to get images for the same date
   */
  private tryGetImagesForDate(
    camera: Camera,
    timestamp: string,
    developerTag: string,
    projectTag: string,
    cameraTag: string
  ) {
    if (!timestamp || timestamp.length < 14) {
      this.handleImageLoadFailure(camera);
      return;
    }

    // Extract date from timestamp (YYYYMMDD)
    const dateStr = timestamp.substring(0, 8);
    
    // Get all images for this date
    this.cameraPicsService.getCameraPictures(developerTag, projectTag, cameraTag, dateStr, dateStr).subscribe({
      next: (response) => {
        const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        
        if (allPhotos.length > 0) {
          // Sort and get the last one (most recent)
          const sortedPhotos = allPhotos.sort();
          const lastPhoto = sortedPhotos[sortedPhotos.length - 1];
          
          // If the last photo is different from what we tried, try it
          if (lastPhoto !== timestamp) {
            console.log(`Trying last available image for date: ${lastPhoto}`);
            this.preloadImageWithFallback(camera, lastPhoto, developerTag, projectTag, cameraTag, 1);
          } else if (sortedPhotos.length > 1) {
            // Try the second-to-last image
            const secondLast = sortedPhotos[sortedPhotos.length - 2];
            console.log(`Trying second-to-last image: ${secondLast}`);
            this.preloadImageWithFallback(camera, secondLast, developerTag, projectTag, cameraTag, 1);
          } else {
            // No other images available, try previous timestamp
            const previousTimestamp = this.getPreviousTimestamp(timestamp, 0);
            if (previousTimestamp) {
              this.preloadImageWithFallback(camera, previousTimestamp, developerTag, projectTag, cameraTag, 1);
            } else {
              this.handleImageLoadFailure(camera);
            }
          }
        } else {
          // No images for this date, try previous timestamp
          const previousTimestamp = this.getPreviousTimestamp(timestamp, 0);
          if (previousTimestamp) {
            this.preloadImageWithFallback(camera, previousTimestamp, developerTag, projectTag, cameraTag, 1);
          } else {
            this.handleImageLoadFailure(camera);
          }
        }
      },
      error: () => {
        // Failed to get images for date, try previous timestamp
        const previousTimestamp = this.getPreviousTimestamp(timestamp, 0);
        if (previousTimestamp) {
          this.preloadImageWithFallback(camera, previousTimestamp, developerTag, projectTag, cameraTag, 1);
        } else {
          this.handleImageLoadFailure(camera);
        }
      }
    });
  }

  /**
   * Handle image load failure
   */
  private handleImageLoadFailure(camera: Camera) {
    // If camera is removed, show no-image.png and stop skeleton
    if (camera.status === 'Removed') {
      camera.image = NO_IMAGE;
      camera.thumbnail = NO_IMAGE;
    } else {
      // For other errors, remove image and set status to stopped
      camera.image = null;
      camera.thumbnail = null;
      camera.status = 'Stopped';
    }
    this.loadingImages.delete(camera.id);
    // Check if all images are loaded
    this.checkAllImagesLoaded();
  }

  /**
   * Check if all camera images are loaded
   */
  private checkAllImagesLoaded() {
    if (this.loadingImages.size === 0 && this.cameras.length > 0) {
      this.isLoadingImages = false;
    }
  }

  /**
   * Preload last day images for all cameras
   * This ensures images are ready when user clicks on camera-detail
   */
  private preloadLastDayImagesForAllCameras(cameras: Camera[], developerTag: string, projectTag: string) {
    if (!cameras || cameras.length === 0) {
      this.isPreloadingLastDayImages = false;
      return;
    }

    this.isPreloadingLastDayImages = true;
    this.preloadingProgress = { loaded: 0, total: cameras.filter(c => c.camera && c.status !== 'Removed').length };

    const activeCameras = cameras.filter(c => c.camera && c.status !== 'Removed');
    
    if (activeCameras.length === 0) {
      this.isPreloadingLastDayImages = false;
      return;
    }

    // Get today's date
    const today = new Date();
    const todayStr = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    // Load last day images for all cameras in parallel
    const preloadRequests = activeCameras.map(camera => {
      // Check if already cached
      if (this.cacheService.hasDateImages(developerTag, projectTag, camera.camera!, todayStr)) {
        this.preloadingProgress.loaded++;
        if (this.preloadingProgress.loaded === this.preloadingProgress.total) {
          this.isPreloadingLastDayImages = false;
        }
        return of(null);
      }

      // Use getCameraPictures to get today's images with timestamps
      return this.cameraPicsService.getCameraPictures(developerTag, projectTag, camera.camera!, todayStr, todayStr).pipe(
        map(response => {
          const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
          
          if (allPhotos.length > 0) {
            // Try to use direct S3 URLs if path is available (faster than proxy)
            // Otherwise fall back to proxied URLs
            const imageUrls = allPhotos.map(timestamp => {
              if (response.path) {
                // Use direct S3 URL from path - much faster!
                return this.cameraPicsService.getDirectS3ImageUrl(response.path, timestamp);
              } else {
                // Fallback to proxied URL
                return this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, camera.camera!, timestamp);
              }
            });

            // Cache the images with timestamps
            this.cacheService.setDateImages(
              developerTag,
              projectTag,
              camera.camera!,
              todayStr,
              allPhotos,
              imageUrls
            );

            // Preload images in browser cache using direct S3 URLs for faster loading
            const startTime = performance.now();
            imageUrls.forEach((url, index) => {
              const timestamp = allPhotos[index]; // Get corresponding timestamp
              const img = new Image();
              img.onload = () => {
                if (index === allPhotos.length - 1) {
                  const loadTime = performance.now() - startTime;
                  console.log(`✓ Preloaded ${allPhotos.length} images for ${camera.name} (${todayStr}) in ${loadTime.toFixed(0)}ms using direct S3 URLs`);
                }
              };
              img.onerror = () => {
                // If direct S3 URL fails, try proxied URL as fallback
                console.warn(`Direct S3 URL failed for ${timestamp}, trying proxied URL...`);
                const proxiedUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, camera.camera!, timestamp);
                const fallbackImg = new Image();
                fallbackImg.src = proxiedUrl;
              };
              img.src = url;
            });

            console.log(`Preloading ${allPhotos.length} images for ${camera.name} (${todayStr}) using direct S3 URLs from path: ${response.path}`);
          } else {
            // No images for today, try yesterday
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.getFullYear().toString() +
              String(yesterday.getMonth() + 1).padStart(2, '0') +
              String(yesterday.getDate()).padStart(2, '0');

            if (!this.cacheService.hasDateImages(developerTag, projectTag, camera.camera!, yesterdayStr)) {
              // Load yesterday's images asynchronously (don't wait)
              this.cameraPicsService.getCameraPictures(developerTag, projectTag, camera.camera!, yesterdayStr, yesterdayStr).subscribe({
                next: (yesterdayResponse) => {
                  const yesterdayPhotos = [...new Set([...yesterdayResponse.date1Photos, ...yesterdayResponse.date2Photos])];
                  if (yesterdayPhotos.length > 0) {
                    // Use direct S3 URLs if path is available
                    const yesterdayUrls = yesterdayPhotos.map(timestamp => {
                      if (yesterdayResponse.path) {
                        return this.cameraPicsService.getDirectS3ImageUrl(yesterdayResponse.path, timestamp);
                      } else {
                        return this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, camera.camera!, timestamp);
                      }
                    });
                    this.cacheService.setDateImages(
                      developerTag,
                      projectTag,
                      camera.camera!,
                      yesterdayStr,
                      yesterdayPhotos,
                      yesterdayUrls
                    );
                    // Preload images using direct S3 URLs
                    yesterdayUrls.forEach(url => {
                      const img = new Image();
                      img.src = url;
                    });
                    console.log(`Preloaded ${yesterdayPhotos.length} images for ${camera.name} (${yesterdayStr}) using direct S3 URLs`);
                  }
                }
              });
            }
          }
          this.preloadingProgress.loaded++;
          if (this.preloadingProgress.loaded === this.preloadingProgress.total) {
            this.isPreloadingLastDayImages = false;
          }
          return null;
        }),
        catchError(error => {
          console.warn(`Failed to preload last day images for camera ${camera.id}:`, error);
          this.preloadingProgress.loaded++;
          if (this.preloadingProgress.loaded === this.preloadingProgress.total) {
            this.isPreloadingLastDayImages = false;
          }
          return of(null);
        })
      );
    });

    // Execute all preload requests
    forkJoin(preloadRequests).subscribe({
      next: () => {
        console.log('Finished preloading last day images for all cameras');
        this.isPreloadingLastDayImages = false;
      },
      error: (err) => {
        console.error('Error preloading last day images:', err);
        this.isPreloadingLastDayImages = false;
      }
    });
  }

  /**
   * Start preloading camera images in background
   * First loads last day images, then last 7 days
   */
  private startPreloadingCameraImages(cameras: Camera[], developerTag: string, projectTag: string) {
    // Delay to not interfere with initial loading
    setTimeout(() => {
      cameras.forEach((camera, index) => {
        // Stagger requests to avoid overwhelming the server
        setTimeout(() => {
          if (camera.camera && camera.status !== 'Removed') {
            this.preloadLastDayImages(camera, developerTag, projectTag, camera.camera);
          }
        }, index * 200); // 200ms delay between cameras
      });
    }, 2000); // Wait 2 seconds after cameras are loaded

    // After last day is loaded, start loading last 7 days
    setTimeout(() => {
      cameras.forEach((camera, index) => {
        setTimeout(() => {
          if (camera.camera && camera.status !== 'Removed') {
            this.preloadLast7DaysImages(camera, developerTag, projectTag, camera.camera);
          }
        }, index * 300); // 300ms delay between cameras
      });
    }, 5000); // Start after 5 seconds
  }

  /**
   * Preload images for the last day (today or most recent day with images)
   */
  private preloadLastDayImages(camera: Camera, developerTag: string, projectTag: string, cameraTag: string) {
    // Get today's date
    const today = new Date();
    const todayStr = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    // Check if already cached
    if (this.cacheService.hasDateImages(developerTag, projectTag, cameraTag, todayStr)) {
      return; // Already cached
    }

    // Get images for today
    this.cameraPicsService.getCameraPictures(developerTag, projectTag, cameraTag, todayStr, todayStr).subscribe({
      next: (response) => {
        const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        
        if (allPhotos.length > 0) {
          // Convert timestamps to image URLs
          const imageUrls = allPhotos.map(timestamp =>
            this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
          );

          // Cache the images
          this.cacheService.setDateImages(
            developerTag,
            projectTag,
            cameraTag,
            todayStr,
            allPhotos,
            imageUrls
          );

          // Preload images in browser cache
          imageUrls.forEach(url => {
            const img = new Image();
            img.src = url;
          });

          console.log(`Preloaded ${allPhotos.length} images for ${camera.name} (${todayStr})`);
        } else {
          // No images for today, try yesterday
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.getFullYear().toString() +
            String(yesterday.getMonth() + 1).padStart(2, '0') +
            String(yesterday.getDate()).padStart(2, '0');

          if (!this.cacheService.hasDateImages(developerTag, projectTag, cameraTag, yesterdayStr)) {
            this.cameraPicsService.getCameraPictures(developerTag, projectTag, cameraTag, yesterdayStr, yesterdayStr).subscribe({
              next: (yesterdayResponse) => {
                const yesterdayPhotos = [...new Set([...yesterdayResponse.date1Photos, ...yesterdayResponse.date2Photos])];
                if (yesterdayPhotos.length > 0) {
                  const yesterdayUrls = yesterdayPhotos.map(timestamp =>
                    this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
                  );
                  this.cacheService.setDateImages(
                    developerTag,
                    projectTag,
                    cameraTag,
                    yesterdayStr,
                    yesterdayPhotos,
                    yesterdayUrls
                  );
                  yesterdayUrls.forEach(url => {
                    const img = new Image();
                    img.src = url;
                  });
                  console.log(`Preloaded ${yesterdayPhotos.length} images for ${camera.name} (${yesterdayStr})`);
                }
              },
              error: () => {
                // Silent fail for background preloading
              }
            });
          }
        }
      },
      error: () => {
        // Silent fail for background preloading
      }
    });
  }

  /**
   * Preload images for the last 7 days
   */
  private preloadLast7DaysImages(camera: Camera, developerTag: string, projectTag: string, cameraTag: string) {
    const today = new Date();
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 6); // Last 7 days (including today)

    const startDateStr = startDate.getFullYear().toString() +
      String(startDate.getMonth() + 1).padStart(2, '0') +
      String(startDate.getDate()).padStart(2, '0');
    const endDateStr = endDate.getFullYear().toString() +
      String(endDate.getMonth() + 1).padStart(2, '0') +
      String(endDate.getDate()).padStart(2, '0');

    // Get images for last 7 days
    this.cameraPicsService.getCameraPictures(developerTag, projectTag, cameraTag, startDateStr, endDateStr).subscribe({
      next: (response) => {
        // Get unique dates from the response
        const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        
        if (allPhotos.length > 0) {
          // Group by date and cache each date separately
          const photosByDate = new Map<string, string[]>();
          
          allPhotos.forEach(timestamp => {
            const dateStr = timestamp.substring(0, 8); // YYYYMMDD
            if (!photosByDate.has(dateStr)) {
              photosByDate.set(dateStr, []);
            }
            photosByDate.get(dateStr)!.push(timestamp);
          });

          // Cache each date's images
          photosByDate.forEach((timestamps, dateStr) => {
            // Check if already cached
            if (!this.cacheService.hasDateImages(developerTag, projectTag, cameraTag, dateStr)) {
              const imageUrls = timestamps.map(timestamp =>
                this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
              );

              this.cacheService.setDateImages(
                developerTag,
                projectTag,
                cameraTag,
                dateStr,
                timestamps,
                imageUrls
              );

              // Preload images in browser cache (limit to first 10 per date to avoid overload)
              imageUrls.slice(0, 10).forEach(url => {
                const img = new Image();
                img.src = url;
              });
            }
          });

          console.log(`Preloaded last 7 days images for ${camera.name} (${photosByDate.size} dates)`);
        }
      },
      error: () => {
        // Silent fail for background preloading
      }
    });
  }

  onImageError(event: Event, camera: Camera) {
    this.loadingImages.delete(camera.id); // Image failed to load - stop skeleton
    
    // If camera is removed, show no-image.png and stop skeleton
    if (camera.status === 'Removed') {
      camera.image = NO_IMAGE;
      camera.thumbnail = NO_IMAGE;
      return;
    }
    
    // For other errors, remove image and set status to stopped
    camera.image = null;
    camera.thumbnail = null;
    camera.status = 'Stopped';
  }

  ngAfterViewInit() {
    // Map will be initialized when quick view opens
  }

  ngOnDestroy() {
    // Clean up maps when component is destroyed
    if (this.thumbnailMap) {
      this.thumbnailMap.remove();
      this.thumbnailMap = null;
    }
    if (this.projectMap) {
      this.projectMap.remove();
      this.projectMap = null;
      this.projectMapMarkers = [];
    }
    if (this.fullMap) {
      this.fullMap.remove();
      this.fullMap = null;
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

      // Add map tiles based on selected theme
      const theme = MAP_THEMES[this.mapTheme] || MAP_THEMES[DEFAULT_MAP_THEME];
      L.tileLayer(theme.url, {
        maxZoom: theme.maxZoom || 19,
        crossOrigin: true,
        attribution: theme.attribution
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
      const theme = MAP_THEMES[this.mapTheme] || MAP_THEMES[DEFAULT_MAP_THEME];
      L.tileLayer(theme.url, {
        maxZoom: theme.maxZoom || 19,
        crossOrigin: true,
        attribution: theme.attribution
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

  /**
   * Initialize the project map with all camera markers
   */
  private initProjectMap() {
    if (!this.projectMapContainer?.nativeElement) {
      return;
    }

    const container = this.projectMapContainer.nativeElement;
    
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      setTimeout(() => this.initProjectMap(), 100);
      return;
    }

    // Fix Leaflet default icon issue
    this.fixLeafletIcons();

    // Get cameras with valid coordinates
    const camerasWithCoords = this.cameras.filter(c => c.lat && c.lng);
    
    if (camerasWithCoords.length === 0) {
      console.warn('No cameras with coordinates found');
      return;
    }

    // Calculate center point (average of all camera coordinates)
    const lats = camerasWithCoords.map(c => typeof c.lat === 'string' ? parseFloat(c.lat) : c.lat!);
    const lngs = camerasWithCoords.map(c => typeof c.lng === 'string' ? parseFloat(c.lng) : c.lng!);
    const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    // Initialize map
    this.projectMap = L.map(container, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: true
    });

    // Add OpenStreetMap tiles
    const theme = MAP_THEMES[this.mapTheme] || MAP_THEMES[DEFAULT_MAP_THEME];
    L.tileLayer(theme.url, {
      maxZoom: theme.maxZoom || 19,
      crossOrigin: true,
      attribution: theme.attribution
    }).addTo(this.projectMap);

    // Add markers for each camera
    camerasWithCoords.forEach(camera => {
      const lat = typeof camera.lat === 'string' ? parseFloat(camera.lat) : camera.lat!;
      const lng = typeof camera.lng === 'string' ? parseFloat(camera.lng) : camera.lng!;
      
      // Determine marker color based on status
      let markerColor = '#cf1d17'; // Default red (Stopped/Removed)
      if (camera.status === 'Online') {
        markerColor = '#5621d2'; // Purple for active/online
      } else if (camera.status === 'Offline') {
        markerColor = '#cf1d17'; // Red for offline
      }

      // Create custom marker icon
      const markerIcon = L.divIcon({
        className: 'project-map-marker',
        html: `<div style="background: ${markerColor}; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [25, 25],
        iconAnchor: [12.5, 12.5]
      });

      const marker = L.marker([lat, lng], { icon: markerIcon })
        .addTo(this.projectMap!)
        .on('click', () => {
          this.onMapCameraClick(camera, lat, lng);
        });

      this.projectMapMarkers.push(marker);
    });

    // Fit bounds to show all cameras
    if (camerasWithCoords.length > 0) {
      const bounds = camerasWithCoords.map(c => [
        typeof c.lat === 'string' ? parseFloat(c.lat) : c.lat!,
        typeof c.lng === 'string' ? parseFloat(c.lng) : c.lng!
      ] as [number, number]);
      this.projectMap.fitBounds(bounds, { padding: [50, 50] });
    }

    // Invalidate size to ensure proper rendering
    setTimeout(() => {
      this.projectMap?.invalidateSize();
    }, 100);
  }

  /**
   * Handle camera marker click on map
   */
  private onMapCameraClick(camera: Camera, lat: number, lng: number) {
    this.selectedMapCamera = camera;
    
    // Position the thumbnail card near the clicked marker
    // Convert lat/lng to pixel coordinates
    if (this.projectMap) {
      const point = this.projectMap.latLngToContainerPoint([lat, lng]);
      // Position card to the left and slightly above the marker
      this.thumbnailCardPosition = {
        x: Math.max(20, point.x - 320), // 320px is approximately card width
        y: Math.max(20, point.y - 200)   // Position above marker
      };
    }
  }
}

