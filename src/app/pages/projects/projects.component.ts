import { Component, Input, OnInit, OnChanges, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as L from 'leaflet';
import { PROJECT_IMAGE, ICONS, COMMUNITY_IMAGES } from '../../constants/figma-assets';
import { ProjectsService } from '../../services/projects.service';
import { ServiceConfigService, ServiceConfig } from '../../services/service-config.service';
import { CommunitiesService } from '../../services/communities.service';
import { CamerasService } from '../../services/cameras.service';
import { CameraPicsService } from '../../services/camera-pics.service';
import { CameraPicsCacheService } from '../../services/camera-pics-cache.service';
import { Project } from '../../models/project.model';
import { Camera } from '../../models/camera.model';
import { API_CONFIG } from '../../config/api.config';
import { MAP_THEMES, DEFAULT_MAP_THEME, MapTheme } from '../../config/map-themes.config';

export interface ProjectServiceStatus {
  timelapse: boolean;
  live: boolean;
  drone: boolean;
  photography: boolean;
  satellite: boolean;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css'
})
export class ProjectsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() selectedCategory: string = 'Dubai Hills Estate';
  @Input() developerId: string = '';
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  
  viewMode: 'list' | 'map' = 'list';
  communityImage: string = '';
  
  icons = ICONS;
  mapTheme: string = DEFAULT_MAP_THEME;
  availableThemes = MAP_THEMES;
  projects: Project[] = [];
  
  projectCameras: Map<string, Camera[]> = new Map();
  projectServiceStatuses: Map<string, ProjectServiceStatus> = new Map();
  serviceConfig: ServiceConfig | null = null;
  isLoading = false;
  error: string | null = null;
  hoveredService: { projectId: string; service: string } | null = null;
  tooltipPositions: Map<string, { left: string; transform: string }> = new Map();
  
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private cameraMarkers: L.Marker[] = [];
  
  selectedMapCamera: Camera | null = null;
  thumbnailCardPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private projectsService: ProjectsService,
    private serviceConfigService: ServiceConfigService,
    private communitiesService: CommunitiesService,
    private camerasService: CamerasService,
    private cameraPicsService: CameraPicsService,
    private cacheService: CameraPicsCacheService,
    private cdr: ChangeDetectorRef
  ) {}

  // Helper methods
  isListView(): boolean {
    return this.viewMode === 'list';
  }
  
  isMapView(): boolean {
    return this.viewMode === 'map';
  }
  
  getThemeKeys(): string[] {
    return Object.keys(MAP_THEMES);
  }

  toggleView(mode: 'list' | 'map'): void {
    if (this.viewMode === mode) return;
    
    // Clean up map if switching away from map view
    if (this.viewMode === 'map' && mode === 'list') {
      this.cleanupMap();
    }
    
    this.viewMode = mode;
    this.cdr.detectChanges();
    
    // If switching to map view, initialize map after Angular renders the view
    if (mode === 'map' && !this.map) {
      // Wait for *ngIf to create the element and Angular to render it
      setTimeout(() => {
        this.initializeMap();
      }, 100);
    } else if (mode === 'map' && this.map) {
      // Map already initialized, just invalidate size
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize(true);
        }
      }, 100);
    }
  }

  ngOnInit() {
    if (this.selectedCategory) {
      this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
    }
    
    this.route.queryParams.subscribe(params => {
      if (params['developerId']) {
        this.developerId = params['developerId'];
        this.loadCommunityName();
        this.loadProjects();
      } else if (this.developerId) {
        this.loadCommunityName();
        this.loadProjects();
      }
    });
  }

  ngOnChanges() {
    if (this.selectedCategory) {
      this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
    }
    
    if (this.developerId && !this.route.snapshot.queryParams['developerId']) {
      this.loadCommunityName();
      this.loadProjects();
    }
  }

  ngAfterViewInit() {
    // If default view is map, initialize it
    if (this.viewMode === 'map') {
      setTimeout(() => {
        this.initializeMap();
      }, 200);
    }
  }

  ngOnDestroy() {
    this.cleanupMap();
  }

  private loadCommunityName() {
    if (this.developerId) {
      this.communitiesService.getCommunityById(this.developerId).subscribe({
        next: (community) => {
          this.selectedCategory = community.name;
          this.communityImage = community.image || COMMUNITY_IMAGES[community.name as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
        },
        error: (err) => {
          console.error('Error loading community name:', err);
          this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
        }
      });
    }
  }

  private loadProjects() {
    if (!this.developerId) {
      this.projects = [];
      return;
    }

    this.isLoading = true;
    this.error = null;

    forkJoin({
      projects: this.projectsService.getProjectsByDeveloperId(this.developerId),
      serviceConfig: this.serviceConfigService.getServiceConfig()
    }).subscribe({
      next: ({ projects, serviceConfig }) => {
        this.serviceConfig = serviceConfig;
        
        this.projects = projects.map(project => {
          const progress = this.calculateProjectProgress(project);
          return {
            ...project,
            image: project.image || PROJECT_IMAGE,
            daysCompleted: progress.daysCompleted,
            totalDays: progress.totalDays
          };
        });

        this.updateProjectServiceStatuses();
        this.loadCamerasForProjects();
        this.isLoading = false;
        
        if (this.viewMode === 'map' && this.map) {
          setTimeout(() => this.updateMap(), 100);
        }
      },
      error: (err) => {
        console.error('Error loading projects:', err);
        this.error = 'Failed to load projects. Please try again later.';
        this.isLoading = false;
        this.projects = [];
      }
    });
  }

  private calculateProjectProgress(project: Project): { daysCompleted: number; totalDays: number } {
    const THREE_YEARS_DAYS = 1095;
    const totalDays = THREE_YEARS_DAYS;

    if (!project.createdDate) {
      return { daysCompleted: 0, totalDays };
    }

    try {
      const createdDate = new Date(project.createdDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      createdDate.setHours(0, 0, 0, 0);

      const timeDiff = today.getTime() - createdDate.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const daysCompleted = Math.max(0, Math.min(daysDiff, totalDays));

      return { daysCompleted, totalDays };
    } catch (error) {
      console.error('Error calculating project progress:', error);
      return { daysCompleted: 0, totalDays };
    }
  }

  getProgressPercentage(daysCompleted: number = 0, totalDays: number = 0): number {
    if (totalDays === 0) return 0;
    const percentage = (daysCompleted / totalDays) * 100;
    return Math.max(0, Math.min(100, percentage));
  }

  private updateProjectServiceStatuses() {
    if (!this.serviceConfig) return;

    this.projectServiceStatuses.clear();
    
    this.projects.forEach(project => {
      const status: ProjectServiceStatus = {
        timelapse: true,
        live: this.serviceConfigService.isServiceActive(project.projectTag, 'live', this.serviceConfig!),
        drone: this.serviceConfigService.isServiceActive(project.projectTag, 'drone', this.serviceConfig!),
        photography: this.serviceConfigService.isServiceActive(project.projectTag, 'photography', this.serviceConfig!),
        satellite: false
      };
      this.projectServiceStatuses.set(project.id, status);
    });
  }

  private loadCamerasForProjects() {
    this.projectCameras.clear();
    
    const cameraRequests = this.projects.map(project => 
      this.camerasService.getCamerasByProjectId(project.id).pipe(
        map(cameras => ({ projectId: project.id, cameras })),
        catchError(() => of({ projectId: project.id, cameras: [] }))
      )
    );

    if (cameraRequests.length === 0) return;

    forkJoin(cameraRequests).subscribe({
      next: (results) => {
        results.forEach(({ projectId, cameras }) => {
          cameras.forEach(camera => {
            if (camera.createdDate) {
              camera.installedDate = this.formatDateString(camera.createdDate);
            } else {
              camera.installedDate = 'N/A';
            }
            camera.image = null;
            camera.thumbnail = null;
          });
          this.projectCameras.set(projectId, cameras);
          
          const project = this.projects.find(p => p.id === projectId);
          if (project) {
            this.loadCameraImagesForProject(project, cameras);
          }
        });
        
        if (this.viewMode === 'map' && this.map) {
          setTimeout(() => this.updateMap(), 100);
        }
      },
      error: (err) => {
        console.error('Error loading cameras:', err);
      }
    });
  }

  private loadCameraImagesForProject(project: Project, cameras: Camera[]) {
    if (!project.developer || !project.projectTag) return;

    this.http.get<{ developerTag: string }>(`${API_CONFIG.baseUrl}/api/developers/${project.developer}`).subscribe({
      next: (developer) => {
        const developerTag = developer.developerTag || '';
        const projectTag = project.projectTag || '';

          cameras.forEach(camera => {
            const cameraId = camera.camera || camera.id;
            
            // Load image directly - getLastImageUrl returns Observable<string>
            this.cameraPicsService.getLastImageUrl(developerTag, projectTag, cameraId).subscribe({
              next: (imageUrl) => {
                if (imageUrl) {
                  camera.image = imageUrl;
                  camera.thumbnail = imageUrl;
                }
              },
              error: (err) => {
                // Silently fail - camera image is optional
              }
            });
          });
      },
      error: (err) => {
        console.error('Error loading developer tag:', err);
      }
    });
  }

  private formatDateString(dateString: string): string {
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  }

  // Service status methods
  getServiceStatus(projectId: string, service: keyof ProjectServiceStatus): boolean {
    const status = this.projectServiceStatuses.get(projectId);
    return status ? status[service] : false;
  }

  getServiceName(service: string): string {
    const names: { [key: string]: string } = {
      'timelapse': 'Time laps',
      'live': 'Live',
      'drone': 'Drone',
      'photography': 'Photography',
      'satellite': 'Satellite'
    };
    return names[service] || service;
  }

  onServiceHover(projectId: string, service: string, event: MouseEvent) {
    event.stopPropagation();
    this.hoveredService = { projectId, service };
    
    const style = this.getTooltipStyle(event);
    const key = `${projectId}-${service}`;
    this.tooltipPositions.set(key, style);
  }

  onServiceLeave() {
    this.hoveredService = null;
  }

  isServiceHovered(projectId: string, service: string): boolean {
    return this.hoveredService?.projectId === projectId && this.hoveredService?.service === service;
  }

  getTooltipStyle(event: MouseEvent): { left: string; transform: string } {
    const button = event.currentTarget as HTMLElement;
    const card = button.closest('.project-card') as HTMLElement;
    
    if (!button || !card) {
      return { left: '0', transform: 'translateX(0)' };
    }

    const buttonRect = button.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const buttonLeftRelative = buttonRect.left - cardRect.left;
    const cardWidth = cardRect.width;
    const leftPercent = (buttonLeftRelative / cardWidth) * 100;
    
    return {
      left: `${leftPercent}%`,
      transform: 'translateX(0)'
    };
  }

  getTooltipStyleForService(projectId: string, service: string): { left: string; transform: string } {
    const key = `${projectId}-${service}`;
    return this.tooltipPositions.get(key) || { left: '50%', transform: 'translateX(-50%)' };
  }

  // Navigation methods
  navigateToProject(projectId: string) {
    this.router.navigate(['/project', projectId]);
  }

  navigateToAllProjects() {
    this.router.navigate(['/communities']);
  }

  navigateToCamera(cameraId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/camera', cameraId]);
  }

  // Map methods
  setMapTheme(themeKey: string) {
    if (MAP_THEMES[themeKey]) {
      this.mapTheme = themeKey;
      if (this.map) {
        this.map.remove();
        this.map = null;
        setTimeout(() => {
          this.initializeMap();
        }, 100);
      }
    }
  }

  /**
   * Initialize the map - simple approach with *ngIf
   * The map container only exists in DOM when isMapView() is true
   * Since it's created fresh, it should have proper dimensions from CSS
   */
  private initializeMap(): void {
    if (this.map) {
      console.warn('Map already initialized!');
      return;
    }

    if (!this.isMapView()) {
      console.log('Not in map view, skipping initialization');
      return;
    }

    // Wait for Angular to render the map container (it's created by *ngIf)
    // Use requestAnimationFrame to wait for browser to render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = this.mapContainer?.nativeElement || document.querySelector('.map-container') as HTMLElement;
        
        if (!container) {
          console.error('Map container not found! Element may not be rendered yet.');
          // Retry once more after a longer delay
          setTimeout(() => {
            const retryContainer = this.mapContainer?.nativeElement || document.querySelector('.map-container') as HTMLElement;
            if (retryContainer) {
              this.createMap(retryContainer);
            } else {
              console.error('Map container still not found after retry!');
            }
          }, 300);
          return;
        }

        // Container exists, wait a bit for flex layout to calculate dimensions
        setTimeout(() => {
          this.createMap(container);
        }, 50);
      });
    });
  }

  /**
   * Actually create the Leaflet map instance
   * Container is created fresh by *ngIf, so it should have dimensions from CSS flex layout
   */
  private createMap(container: HTMLElement): void {
    if (this.map) {
      console.warn('Map already exists!');
      return;
    }

    // Check dimensions - with *ngIf and flex layout, container should have dimensions
    let width = container.offsetWidth || container.clientWidth || 0;
    let height = container.offsetHeight || container.clientHeight || 0;

    console.log('Creating map - initial container dimensions:', width, 'x', height);

    // If dimensions are 0, wait for flex layout to calculate
    if (!width || !height) {
      console.warn('Container has 0 dimensions, waiting for flex layout...');
      
      // Wait a bit more for flex layout to calculate
      setTimeout(() => {
        width = container.offsetWidth || container.clientWidth || 0;
        height = container.offsetHeight || container.clientHeight || 0;
        
        console.log('After wait - container dimensions:', width, 'x', height);

        // If still 0, calculate from viewport and set explicit dimensions
        if (!width || !height) {
          const viewportHeight = window.innerHeight - 80;
          const viewportWidth = window.innerWidth;
          const header = document.querySelector('.page-header') as HTMLElement;
          const headerHeight = header ? header.offsetHeight : 100;
          
          const calculatedHeight = Math.max(600, viewportHeight - headerHeight - 48);
          const calculatedWidth = viewportWidth - 240;

          console.warn('Container still has 0 dimensions! Setting explicit dimensions:', calculatedWidth, 'x', calculatedHeight);

          // Set explicit dimensions on both wrapper and container
          const wrapper = container.closest('.map-view-wrapper') as HTMLElement;
          if (wrapper) {
            wrapper.style.height = (viewportHeight - headerHeight) + 'px';
            wrapper.style.minHeight = '600px';
          }
          
          container.style.height = calculatedHeight + 'px';
          container.style.width = calculatedWidth + 'px';
          container.style.minHeight = calculatedHeight + 'px';
          
          // Force reflow
          container.offsetHeight;
          wrapper?.offsetHeight;
          container.getBoundingClientRect();
          
          // Re-check dimensions
          width = container.offsetWidth || container.clientWidth || calculatedWidth;
          height = container.offsetHeight || container.clientHeight || calculatedHeight;
          
          console.log('After explicit dimensions - actual:', width, 'x', height);
        }

        // Proceed with initialization (use calculated dimensions as fallback if needed)
        const finalWidth = width || (window.innerWidth - 240);
        const finalHeight = height || Math.max(600, window.innerHeight - 100 - 48);
        
        this.initializeLeafletMap(container, finalWidth, finalHeight);
      }, 200);
      return;
    }

    // Dimensions are valid, initialize immediately
    this.initializeLeafletMap(container, width, height);
  }

  /**
   * Initialize Leaflet map with verified dimensions
   * Use ResizeObserver to wait for actual dimensions before initializing
   */
  private initializeLeafletMap(container: HTMLElement, width: number, height: number): void {
    if (this.map) {
      console.warn('Map already exists!');
      return;
    }

    console.log('Initializing Leaflet map with expected dimensions:', width, 'x', height);

    // Fix Leaflet icons
    this.fixLeafletIcons();

    // Default center (Dubai)
    const defaultCenter: L.LatLngExpression = [25.2048, 55.2708];
    const defaultZoom = 11;

    // Use ResizeObserver to wait for container to actually have dimensions
    // This is the most reliable way to ensure dimensions before L.map()
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const actualWidth = entry.contentRect.width;
        const actualHeight = entry.contentRect.height;
        
        console.log('ResizeObserver detected dimensions:', actualWidth, 'x', actualHeight);
        console.log('Container offsetWidth/offsetHeight:', container.offsetWidth, 'x', container.offsetHeight);
        
        // If we have valid dimensions, initialize the map
        if (actualWidth > 0 && actualHeight > 0) {
          // Disconnect observer since we got dimensions
          resizeObserver.disconnect();
          
          // Double-check offsetWidth/offsetHeight (Leaflet reads these)
          const offsetWidth = container.offsetWidth || container.clientWidth || actualWidth;
          const offsetHeight = container.offsetHeight || container.clientHeight || actualHeight;
          
          console.log('✓ Got valid dimensions! Initializing Leaflet map with:', offsetWidth, 'x', offsetHeight);
          
          // Initialize map NOW
          this.createLeafletInstance(container, offsetWidth, offsetHeight, defaultCenter, defaultZoom);
          return;
        } else if (actualWidth === 0 && actualHeight === 0) {
          // Still 0, but observer is watching - it will fire again when dimensions change
          console.log('Container still has 0 dimensions, ResizeObserver will fire again when dimensions change...');
        }
      }
    });

    // Observe the container for size changes
    resizeObserver.observe(container);
    
    // Also check dimensions immediately in case they're already valid
    const immediateWidth = container.offsetWidth || container.clientWidth || 0;
    const immediateHeight = container.offsetHeight || container.clientHeight || 0;
    
    console.log('Immediate check - container dimensions:', immediateWidth, 'x', immediateHeight);

    if (immediateWidth > 0 && immediateHeight > 0) {
      // Already have dimensions! Disconnect observer and initialize immediately
      resizeObserver.disconnect();
      console.log('✓ Container already has valid dimensions! Initializing immediately...');
      this.createLeafletInstance(container, immediateWidth, immediateHeight, defaultCenter, defaultZoom);
      return;
    }

    // If dimensions are 0, set explicit dimensions to trigger ResizeObserver
    console.warn('Container has 0 dimensions, setting explicit dimensions to trigger ResizeObserver...');
    
    const viewportHeight = window.innerHeight - 80;
    const viewportWidth = window.innerWidth;
    const header = document.querySelector('.page-header') as HTMLElement;
    const headerHeight = header ? header.offsetHeight : 100;
    
    const calculatedHeight = Math.max(600, viewportHeight - headerHeight - 48);
    const calculatedWidth = viewportWidth - 240;

    // Set explicit dimensions on wrapper and container
    const wrapper = container.closest('.map-view-wrapper') as HTMLElement;
    if (wrapper) {
      wrapper.style.height = (viewportHeight - headerHeight) + 'px';
      wrapper.style.minHeight = '600px';
    }
    
    container.style.height = calculatedHeight + 'px';
    container.style.width = calculatedWidth + 'px';
    container.style.minHeight = calculatedHeight + 'px';
    
    // Force reflow to ensure dimensions are applied
    container.offsetHeight;
    wrapper?.offsetHeight;
    container.getBoundingClientRect();
    
    // Wait a bit, then check again
    setTimeout(() => {
      const afterWaitWidth = container.offsetWidth || container.clientWidth || 0;
      const afterWaitHeight = container.offsetHeight || container.clientHeight || 0;
      
      console.log('After setting dimensions and waiting - container dimensions:', afterWaitWidth, 'x', afterWaitHeight);
      
      if (afterWaitWidth > 0 && afterWaitHeight > 0) {
        // Got dimensions! Disconnect observer and initialize
        resizeObserver.disconnect();
        console.log('✓ Container now has dimensions! Initializing Leaflet map...');
        this.createLeafletInstance(container, afterWaitWidth, afterWaitHeight, defaultCenter, defaultZoom);
      } else {
        // Still 0, but ResizeObserver is watching - it will fire when dimensions become available
        // Set a timeout to disconnect observer if it takes too long
        setTimeout(() => {
          resizeObserver.disconnect();
          // Proceed with calculated dimensions as last resort
          console.error('Timeout: Container still has 0 dimensions after 2 seconds!');
          console.error('Proceeding with calculated dimensions as last resort...');
          this.createLeafletInstance(container, calculatedWidth, calculatedHeight, defaultCenter, defaultZoom);
        }, 2000);
      }
    }, 300);
  }

  /**
   * Actually call L.map() and create the map instance
   */
  private createLeafletInstance(
    container: HTMLElement,
    width: number,
    height: number,
    center: L.LatLngExpression,
    zoom: number
  ): void {
    try {
      // Create the map with scroll wheel zoom enabled
      this.map = L.map(container, {
        center: center,
        zoom: zoom,
        zoomControl: true,
        preferCanvas: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
        touchZoom: true
      });

      console.log('Leaflet map created. Map size:', this.map.getSize());
      console.log('Container dimensions after L.map():', container.offsetWidth, 'x', container.offsetHeight);

      // Add tiles
      this.addTiles();

      // Add markers after a short delay
      setTimeout(() => {
        this.updateMap();
        // Invalidate size after markers are added
        if (this.map) {
          this.map.invalidateSize(true);
        }
      }, 300);

      // Handle map ready event
      this.map.whenReady(() => {
        console.log('Map ready - size:', this.map?.getSize());
        if (this.map) {
          // If map size is 0, fix it
          const mapSize = this.map.getSize();
          if (mapSize.x === 0 || mapSize.y === 0) {
            console.error('Map initialized with 0 size! Fixing...');
            
            // Set explicit dimensions on container
            container.style.height = height + 'px';
            container.style.width = width + 'px';
            
            // Force reflow
            container.offsetHeight;
            
            // Invalidate size
            setTimeout(() => {
              if (this.map) {
                this.map.invalidateSize(true);
                console.log('After invalidateSize - Map size:', this.map.getSize());
              }
            }, 100);
          }
        }
      });
    } catch (error) {
      console.error('Error creating Leaflet instance:', error);
      this.map = null;
    }
  }

  /**
   * Add tiles to the map
   */
  private addTiles(): void {
    if (!this.map) return;

    const theme = MAP_THEMES[this.mapTheme] || MAP_THEMES[DEFAULT_MAP_THEME];
    const tileLayer = L.tileLayer(theme.url, {
      attribution: theme.attribution,
      maxZoom: theme.maxZoom || 19,
      crossOrigin: true
    });

    tileLayer.on('tileerror', (error: any) => {
      console.warn('Tile loading error:', error);
      setTimeout(() => {
        tileLayer.redraw();
      }, 1000);
    });

    tileLayer.addTo(this.map);
  }

  /**
   * Update map with markers
   */
  private updateMap(): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot update markers');
      return;
    }

    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
    this.cameraMarkers.forEach(marker => marker.remove());
    this.cameraMarkers = [];

    const parseCoordinate = (coord: number | string | undefined): number | null => {
      if (coord === undefined || coord === null) return null;
      const parsed = typeof coord === 'string' ? parseFloat(coord) : coord;
      if (isNaN(parsed) || parsed === 0) return null;
      return parsed;
    };

    const isValidCoordinate = (lat: number | string | undefined, lng: number | string | undefined): boolean => {
      const parsedLat = parseCoordinate(lat);
      const parsedLng = parseCoordinate(lng);
      return parsedLat !== null && parsedLng !== null;
    };

    // Add project markers
    const bounds: L.LatLngExpression[] = [];
    const projectsWithCoords = this.projects.filter(p => isValidCoordinate(p.lat, p.lng));

    projectsWithCoords.forEach(project => {
      const lat = parseCoordinate(project.lat!)!;
      const lng = parseCoordinate(project.lng!)!;
      const position: L.LatLngExpression = [lat, lng];
      bounds.push(position);

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="map-marker"><div class="marker-dot"></div></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 20]
      });

      const popupContent = `
        <div class="map-popup">
          <h3>${project.name}</h3>
          <p>Status: ${project.status || 'N/A'}</p>
          <p>Days Completed: ${project.daysCompleted || 0} / ${project.totalDays || 0}</p>
        </div>
      `;

      const marker = L.marker(position, { icon, title: project.name })
        .addTo(this.map!)
        .bindTooltip(project.name, {
          permanent: false,
          direction: 'top',
          offset: [0, -10]
        })
        .bindPopup(popupContent);

      marker.on('click', () => {
        this.navigateToProject(project.id);
      });

      this.markers.push(marker);
    });

    // Add camera markers
    this.projects.forEach(project => {
      const cameras = this.projectCameras.get(project.id) || [];
      
      cameras.forEach(camera => {
        const cameraLat = parseCoordinate(camera.lat);
        const cameraLng = parseCoordinate(camera.lng);
        
        if (cameraLat !== null && cameraLng !== null) {
          const cameraPosition: L.LatLngExpression = [cameraLat, cameraLng];
          bounds.push(cameraPosition);

          const cameraIcon = L.divIcon({
            className: 'custom-marker camera-marker',
            html: `<div style="background: #00b330; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 20]
          });

          const cameraName = camera.name || camera.camera || 'Camera';
          
          const cameraMarker = L.marker(cameraPosition, { 
            icon: cameraIcon,
            title: cameraName
          }).addTo(this.map!);

          cameraMarker.on('mouseover', () => {
            this.onMapCameraHover(camera, cameraLat, cameraLng);
          });

          cameraMarker.on('mouseout', () => {
            this.selectedMapCamera = null;
          });

          cameraMarker.on('click', () => {
            this.navigateToCamera(camera.id, new Event('click'));
          });

          this.cameraMarkers.push(cameraMarker);
        }
      });
    });

    // Fit map to bounds
    if (bounds.length > 0) {
      this.map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
    } else {
      this.map.setView([25.2048, 55.2708], 13);
    }
    
    console.log(`Map updated: ${this.markers.length} project markers, ${this.cameraMarkers.length} camera markers`);
    
    // Ensure map size is correct
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize(true);
      }
    }, 200);
  }

  private onMapCameraHover(camera: Camera, lat: number, lng: number) {
    this.selectedMapCamera = camera;
    
    if (!camera.image) {
      const project = this.projects.find(p => {
        const cameras = this.projectCameras.get(p.id) || [];
        return cameras.some(c => c.id === camera.id);
      });
      
      if (project && project.developer && project.projectTag) {
        this.http.get<{ developerTag: string }>(`${API_CONFIG.baseUrl}/api/developers/${project.developer}`).subscribe({
          next: (developer) => {
            const developerTag = developer.developerTag || '';
            const projectTag = project.projectTag || '';
            const cameraId = camera.camera || camera.id;
            
            this.cameraPicsService.getLastImageUrl(developerTag, projectTag, cameraId).subscribe({
              next: (imageUrl) => {
                if (imageUrl) {
                  camera.image = imageUrl;
                  camera.thumbnail = imageUrl;
                }
              },
              error: () => {}
            });
          },
          error: () => {}
        });
      }
    }
    
    if (this.map) {
      const point = this.map.latLngToContainerPoint([lat, lng]);
      this.thumbnailCardPosition = {
        x: Math.max(20, point.x - 320),
        y: Math.max(20, point.y - 200)
      };
    }
  }

  private fixLeafletIcons() {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }

  private cleanupMap() {
    if (this.map) {
      this.markers.forEach(marker => marker.remove());
      this.markers = [];
      this.cameraMarkers.forEach(marker => marker.remove());
      this.cameraMarkers = [];
      this.map.remove();
      this.map = null;
    }
  }
}
