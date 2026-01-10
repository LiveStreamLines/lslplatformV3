import { Component, Input, OnInit, OnChanges, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
  satellite: boolean; // Always false for now
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
  mapTheme: string = DEFAULT_MAP_THEME; // Current map theme
  availableThemes = MAP_THEMES; // Available map themes
  projects: Project[] = []; // Projects for current developer (for list view)
  
  // Get array of theme keys for iteration
  getThemeKeys(): string[] {
    return Object.keys(MAP_THEMES);
  }
  
  // Method to change map theme
  setMapTheme(themeKey: string) {
    if (MAP_THEMES[themeKey]) {
      this.mapTheme = themeKey;
      // Reinitialize map with new theme if map is already initialized
      if (this.map) {
        this.map.remove();
        this.map = null;
        setTimeout(() => {
          this.initMap();
        }, 100);
      }
    }
  }
  allProjectsForMap: Project[] = []; // All projects from all developers (for map view)
  projectCameras: Map<string, Camera[]> = new Map(); // Store cameras per project
  projectServiceStatuses: Map<string, ProjectServiceStatus> = new Map();
  serviceConfig: ServiceConfig | null = null;
  isLoading = false;
  error: string | null = null;
  hoveredService: { projectId: string; service: string } | null = null;
  tooltipPositions: Map<string, { left: string; transform: string }> = new Map();
  
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private cameraMarkers: L.Marker[] = [];
  
  // Camera card overlay state
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
    private cacheService: CameraPicsCacheService
  ) {}

  toggleView(mode: 'list' | 'map') {
    this.viewMode = mode;
    if (mode === 'map') {
      // Initialize or resize map when switching to map view
      setTimeout(() => {
        if (!this.map) {
          this.initMap();
        } else {
          // Force resize multiple times to ensure proper rendering
          setTimeout(() => {
            this.map?.invalidateSize();
            this.map?.eachLayer((layer) => {
              if (layer instanceof L.TileLayer) {
                (layer as L.TileLayer).redraw();
              }
            });
            // Load cameras first, then update map
            if (this.developerId && this.projects.length > 0) {
              this.loadCamerasForProjects();
            } else {
              this.updateMap();
            }
          }, 100);
          setTimeout(() => {
            this.map?.invalidateSize();
          }, 500);
        }
      }, 200);
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

  getProgressPercentage(daysCompleted: number = 0, totalDays: number = 0): number {
    if (totalDays === 0) return 0;
    const percentage = (daysCompleted / totalDays) * 100;
    // Ensure percentage is between 0 and 100
    return Math.max(0, Math.min(100, percentage));
  }

  navigateToProject(projectId: string) {
    this.router.navigate(['/project', projectId]);
  }

  navigateToAllProjects() {
    // Navigate to communities page to show all projects
    this.router.navigate(['/communities']);
  }

  ngOnInit() {
    // Initialize community image from selectedCategory if available
    if (this.selectedCategory) {
      this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
    }
    
    // Check for developerId in route query params first, then use @Input
    this.route.queryParams.subscribe(params => {
      if (params['developerId']) {
        this.developerId = params['developerId'];
        // Load community name for breadcrumb
        this.loadCommunityName();
        this.loadProjects();
      } else if (this.developerId) {
        this.loadCommunityName();
        this.loadProjects();
      }
    });
  }

  private loadCommunityName() {
    if (this.developerId) {
      this.communitiesService.getCommunityById(this.developerId).subscribe({
        next: (community) => {
          this.selectedCategory = community.name;
          // Load community image for breadcrumb logo
          this.communityImage = community.image || COMMUNITY_IMAGES[community.name as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
        },
        error: (err) => {
          console.error('Error loading community name:', err);
          // Fallback to default image based on selectedCategory
          this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
        }
      });
    } else {
      // Fallback to default image based on selectedCategory if no developerId
      this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
    }
  }

  ngOnChanges() {
    // Load community image based on selectedCategory if it changes
    if (this.selectedCategory) {
      this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
    }
    
    // Only load if developerId is provided via @Input (not from route)
    if (this.developerId && !this.route.snapshot.queryParams['developerId']) {
      this.loadCommunityName();
      this.loadProjects();
    }
  }

  private loadProjects() {
    if (!this.developerId) {
      this.projects = [];
      return;
    }

    this.isLoading = true;
    this.error = null;

    // Fetch both projects and service config in parallel
    forkJoin({
      projects: this.projectsService.getProjectsByDeveloperId(this.developerId),
      serviceConfig: this.serviceConfigService.getServiceConfig()
    }).subscribe({
      next: ({ projects, serviceConfig }) => {
        this.serviceConfig = serviceConfig;
        
        // Use project image or fallback to default, and calculate progress based on creation date
        this.projects = projects.map(project => {
          const calculatedProgress = this.calculateProjectProgress(project);
          return {
            ...project,
            image: project.image || PROJECT_IMAGE,
            daysCompleted: calculatedProgress.daysCompleted,
            totalDays: calculatedProgress.totalDays
          };
        });

        // Determine service statuses for each project
        this.updateProjectServiceStatuses();
        
        // Load cameras for all projects
        this.loadCamerasForProjects();
        
        this.isLoading = false;
        
        // Update map if in map view
        if (this.viewMode === 'map') {
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

  private updateProjectServiceStatuses() {
    if (!this.serviceConfig) return;

    this.projectServiceStatuses.clear();
    
    this.projects.forEach(project => {
      const status: ProjectServiceStatus = {
        timelapse: true, // All projects have timelapse active
        live: this.serviceConfigService.isServiceActive(project.projectTag, 'live', this.serviceConfig!),
        drone: this.serviceConfigService.isServiceActive(project.projectTag, 'drone', this.serviceConfig!),
        photography: this.serviceConfigService.isServiceActive(project.projectTag, 'photography', this.serviceConfig!),
        satellite: false // Not implemented yet
      };
      this.projectServiceStatuses.set(project.id, status);
    });
  }

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
    
    // Calculate and store tooltip position
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
    
    // Calculate button position relative to card
    const buttonLeftRelative = buttonRect.left - cardRect.left;
    const cardWidth = cardRect.width;
    
    // Position tooltip to start from the left edge of the button and extend to the right
    // This ensures it always stays inside the card
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

  private loadCamerasForProjects() {
    this.projectCameras.clear();
    
    // Load cameras for each project in parallel
    const cameraRequests = this.projects.map(project => 
      this.camerasService.getCamerasByProjectId(project.id).pipe(
        map(cameras => ({ projectId: project.id, cameras }))
      )
    );

    if (cameraRequests.length === 0) {
      return;
    }

    forkJoin(cameraRequests).subscribe({
      next: (results) => {
        results.forEach(({ projectId, cameras }) => {
          // Format installed dates and clear images initially
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
          
          // Load images for cameras in this project
          const project = this.projects.find(p => p.id === projectId);
          if (project) {
            this.loadCameraImagesForProject(project, cameras);
          }
        });
        
        // Debug: Log all camera coordinates for current developer
        console.log('=== DEBUG: Camera Coordinates for Current Developer ===');
        const allCameraCoordinates: Array<{
          developer: string;
          project: string;
          camera: string;
          name: string;
          lat: number | undefined;
          lng: number | undefined;
        }> = [];

        this.projects.forEach(project => {
          const cameras = this.projectCameras.get(project.id) || [];
          cameras.forEach(camera => {
            if (camera.lat !== undefined && camera.lng !== undefined) {
              allCameraCoordinates.push({
                developer: project.developer || 'Unknown',
                project: project.name || project.id,
                camera: camera.camera || camera.id,
                name: camera.name || camera.camera || 'Camera',
                lat: camera.lat,
                lng: camera.lng
              });
            }
          });
        });

        console.log(`Total cameras with coordinates: ${allCameraCoordinates.length}`);
        console.table(allCameraCoordinates);
        console.log('=== End Debug Info ===');
        
        // Update map if in map view (cameras are now loaded)
        if (this.viewMode === 'map' && this.map) {
          setTimeout(() => {
            this.updateMap();
          }, 100);
        }
      },
      error: (err) => {
        console.error('Error loading cameras for projects:', err);
      }
    });
  }

  private loadAllCamerasForAllDevelopers() {
    // Load all developers, then all their projects, then all cameras
    this.communitiesService.getCommunities().subscribe({
      next: (communities) => {
        // Get all projects for all developers
        const projectRequests = communities.map(community =>
          this.projectsService.getProjectsByDeveloperId(community.id).pipe(
            map(projects => ({ developerId: community.id, projects }))
          )
        );

        if (projectRequests.length === 0) {
          return;
        }

        forkJoin(projectRequests).subscribe({
          next: (projectResults) => {
            // Store all projects for map display
            this.allProjectsForMap = [];
            projectResults.forEach(({ projects }) => {
              this.allProjectsForMap.push(...projects);
            });

            const cameraRequests = this.allProjectsForMap.map(project =>
              this.camerasService.getCamerasByProjectId(project.id).pipe(
                map(cameras => ({ projectId: project.id, cameras })),
                catchError(() => of({ projectId: project.id, cameras: [] })) // Handle errors gracefully
              )
            );

            if (cameraRequests.length === 0) {
              return;
            }

            forkJoin(cameraRequests).subscribe({
              next: (cameraResults) => {
                cameraResults.forEach(({ projectId, cameras }) => {
                  this.projectCameras.set(projectId, cameras);
                });

                // Debug: Log all camera coordinates
                console.log('=== DEBUG: All Camera Coordinates ===');
                const allCameraCoordinates: Array<{
                  developer: string;
                  project: string;
                  camera: string;
                  name: string;
                  lat: number | undefined;
                  lng: number | undefined;
                }> = [];

                this.allProjectsForMap.forEach(project => {
                  const cameras = this.projectCameras.get(project.id) || [];
                  cameras.forEach(camera => {
                    if (camera.lat !== undefined && camera.lng !== undefined) {
                      allCameraCoordinates.push({
                        developer: project.developer || 'Unknown',
                        project: project.name || project.id,
                        camera: camera.camera || camera.id,
                        name: camera.name || camera.camera || 'Camera',
                        lat: camera.lat,
                        lng: camera.lng
                      });
                    }
                  });
                });

                console.log(`Total cameras with coordinates: ${allCameraCoordinates.length}`);
                console.table(allCameraCoordinates);
                console.log('=== End Debug Info ===');

                // Update map if in map view
                if (this.viewMode === 'map' && this.map) {
                  this.updateMap();
                }
              },
              error: (err) => {
                console.error('Error loading cameras for all projects:', err);
              }
            });
          },
          error: (err) => {
            console.error('Error loading projects for all developers:', err);
          }
        });
      },
      error: (err) => {
        console.error('Error loading all developers:', err);
      }
    });
  }

  ngAfterViewInit() {
    // Initialize map when view is ready
    if (this.viewMode === 'map') {
      setTimeout(() => this.initMap(), 300);
    }
  }

  ngOnDestroy() {
    // Clean up map when component is destroyed
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap() {
    if (!this.mapContainer?.nativeElement || this.map) {
      return;
    }

    const container = this.mapContainer.nativeElement;
    
    // Ensure container has dimensions
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.warn('Map container has no dimensions, retrying...');
      setTimeout(() => this.initMap(), 200);
      return;
    }

    // Fix Leaflet default icon issue
    this.fixLeafletIcons();

    // Default center (Dubai)
    const defaultCenter: L.LatLngExpression = [25.2048, 55.2708];
    const defaultZoom = 11;

    try {
      // Initialize map
      this.map = L.map(container, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
        preferCanvas: false
      });

      // Add map tiles based on selected theme
      const theme = MAP_THEMES[this.mapTheme] || MAP_THEMES[DEFAULT_MAP_THEME];
      const tileLayer = L.tileLayer(theme.url, {
        attribution: theme.attribution,
        maxZoom: theme.maxZoom || 19,
        crossOrigin: true
      });

      // Handle tile loading errors
      tileLayer.on('tileerror', (error: any) => {
        console.warn('Tile loading error:', error);
        // Retry loading the tile
        setTimeout(() => {
          tileLayer.redraw();
        }, 1000);
      });

      tileLayer.addTo(this.map);

      // Force tile reload after map is ready
      this.map.whenReady(() => {
        setTimeout(() => {
          this.map?.invalidateSize();
          tileLayer.redraw();
        }, 300);
      });

      // Wait a bit for tiles to load, then update with markers
      setTimeout(() => {
        this.updateMap();
        // Invalidate size multiple times to ensure proper rendering
        setTimeout(() => {
          this.map?.invalidateSize();
        }, 100);
        setTimeout(() => {
          this.map?.invalidateSize();
        }, 500);
      }, 200);
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private fixLeafletIcons() {
    // Fix Leaflet default icon paths - use CDN as fallback
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }

  private updateMap() {
    if (!this.map) {
      if (this.viewMode === 'map') {
        this.initMap();
      }
      return;
    }

    console.log('=== DEBUG: updateMap called ===');
    console.log('Projects count:', this.projects.length);
    console.log('Project cameras map size:', this.projectCameras.size);

    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
    this.cameraMarkers.forEach(marker => marker.remove());
    this.cameraMarkers = [];

    // Helper function to parse coordinates (handles both string and number)
    const parseCoordinate = (coord: number | string | undefined): number | null => {
      if (coord === undefined || coord === null) return null;
      const parsed = typeof coord === 'string' ? parseFloat(coord) : coord;
      if (isNaN(parsed) || parsed === 0) return null; // Filter out 0,0 and invalid
      return parsed;
    };

    // Helper function to check if coordinates are valid
    const isValidCoordinate = (lat: number | string | undefined, lng: number | string | undefined): boolean => {
      const parsedLat = parseCoordinate(lat);
      const parsedLng = parseCoordinate(lng);
      return parsedLat !== null && parsedLng !== null;
    };

    // Filter projects with valid coordinates
    const projectsWithCoords = this.projects.filter(p => isValidCoordinate(p.lat, p.lng));

    console.log('Projects with coordinates:', projectsWithCoords.length);
    projectsWithCoords.forEach(p => {
      console.log(`Project: ${p.name}, lat: ${p.lat}, lng: ${p.lng}`);
    });

    // Create markers for each project (if they have coordinates)
    const bounds: L.LatLngBoundsExpression = [];
    
    projectsWithCoords.forEach(project => {
      const lat = parseCoordinate(project.lat!)!;
      const lng = parseCoordinate(project.lng!)!;
      const position: L.LatLngExpression = [lat, lng];
      
      bounds.push(position);

      // Create custom icon
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="map-marker">
          <div class="marker-dot"></div>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 20]
      });

      // Get cameras for this project
      const cameras = this.projectCameras.get(project.id) || [];
      const camerasWithCoords = cameras.filter(c => isValidCoordinate(c.lat, c.lng));
      
      // Create cameras list HTML
      let camerasHtml = '';
      if (camerasWithCoords.length > 0) {
        camerasHtml = '<div class="cameras-list"><h4>Cameras:</h4><ul>';
        camerasWithCoords.forEach(camera => {
          const lat = parseCoordinate(camera.lat!)!;
          const lng = parseCoordinate(camera.lng!)!;
          camerasHtml += `<li>${camera.name || camera.camera || 'Camera'}: ${lat.toFixed(6)}, ${lng.toFixed(6)}</li>`;
        });
        camerasHtml += '</ul></div>';
      }

      // Create popup content
      const popupContent = `
        <div class="map-popup">
          <h3>${project.name}</h3>
          <p>Status: ${project.status || 'N/A'}</p>
          <p>Days Completed: ${project.daysCompleted || 0} / ${project.totalDays || 0}</p>
          ${camerasHtml}
        </div>
      `;

      // Create marker with tooltip
      const marker = L.marker(position, { 
        icon,
        title: project.name // Tooltip on hover
      })
        .addTo(this.map!)
        .bindTooltip(project.name, {
          permanent: false, // Show on hover
          direction: 'top',
          offset: [0, -10]
        })
        .bindPopup(popupContent);

      // Add click handler to navigate to project
      marker.on('click', () => {
        this.navigateToProject(project.id);
      });

      this.markers.push(marker);
    });

    // Add camera markers for ALL projects (even if project doesn't have coordinates)
    this.projects.forEach(project => {
      const cameras = this.projectCameras.get(project.id) || [];
      
      cameras.forEach(camera => {
        const cameraLat = parseCoordinate(camera.lat);
        const cameraLng = parseCoordinate(camera.lng);
        
        console.log(`Camera: ${camera.name || camera.camera}, Original lat: ${camera.lat}, lng: ${camera.lng}, Parsed lat: ${cameraLat}, lng: ${cameraLng}`);
        
        if (cameraLat !== null && cameraLng !== null) {
          const cameraPosition: L.LatLngExpression = [cameraLat, cameraLng];
          bounds.push(cameraPosition);

          // Use a simple, visible marker for debugging - green circle
          const cameraIcon = L.divIcon({
            className: 'custom-marker camera-marker',
            html: `<div style="background: #00b330; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 20]
          });

          console.log(`Creating camera marker at: [${cameraLat}, ${cameraLng}] for ${camera.name || camera.camera}`);

          const cameraName = camera.name || camera.camera || 'Camera';
          
          const cameraMarker = L.marker(cameraPosition, { 
            icon: cameraIcon,
            title: cameraName
          })
            .addTo(this.map!);

          // Add mouseenter handler to show camera card
          cameraMarker.on('mouseover', () => {
            this.onMapCameraHover(camera, cameraLat, cameraLng);
          });

          // Add mouseleave handler to hide camera card
          cameraMarker.on('mouseout', () => {
            this.selectedMapCamera = null;
          });

          // Add click handler to navigate to camera
          cameraMarker.on('click', () => {
            this.router.navigate(['/camera', camera.id]);
          });

          // Verify marker was added
          console.log(`Camera marker created and added:`, cameraMarker);
          console.log(`Marker position:`, cameraMarker.getLatLng());

          this.cameraMarkers.push(cameraMarker);
        } else {
          console.warn(`Skipping camera ${camera.name || camera.camera} - invalid coordinates`);
        }
      });
    });


    // Fit map to show all markers
    if (bounds.length > 0) {
      console.log('Fitting map bounds with', bounds.length, 'markers');
      console.log('Bounds array:', bounds);
      this.map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
    } else {
      console.warn('No bounds to fit map to');
      // If no bounds, center on Dubai
      this.map.setView([25.2048, 55.2708], 13);
    }
    
    console.log('Total project markers:', this.markers.length);
    console.log('Total camera markers:', this.cameraMarkers.length);
    console.log('Map instance:', this.map);
    console.log('Map container:', this.mapContainer?.nativeElement);
    console.log('=== End updateMap ===');
  }

  private onMapCameraHover(camera: Camera, lat: number, lng: number) {
    this.selectedMapCamera = camera;
    
    // If camera image hasn't been loaded yet, load it now
    if (!camera.image) {
      // Find the project for this camera
      const project = this.projects.find(p => {
        const cameras = this.projectCameras.get(p.id) || [];
        return cameras.some(c => c.id === camera.id);
      });
      
      if (project && project.developer && project.projectTag) {
        // Get developer tag and load image
        this.http.get<{ developerTag: string }>(`${API_CONFIG.baseUrl}/api/developers/${project.developer}`).subscribe({
          next: (developer) => {
            const developerTag = developer.developerTag || '';
            const projectTag = project.projectTag || '';
            if (developerTag && projectTag) {
              this.loadCameraImage(camera, developerTag, projectTag);
            }
          },
          error: (err) => {
            console.error('Error loading developer tag for hover:', err);
          }
        });
      }
    }
    
    // Position the thumbnail card near the hovered marker
    // Convert lat/lng to pixel coordinates
    if (this.map) {
      const point = this.map.latLngToContainerPoint([lat, lng]);
      // Position card to the left and slightly above the marker
      this.thumbnailCardPosition = {
        x: Math.max(20, point.x - 320), // 320px is approximately card width
        y: Math.max(20, point.y - 200)   // Position above marker
      };
    }
  }

  navigateToCamera(cameraId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/camera', cameraId]);
  }

  /**
   * Load camera images for a project
   */
  private loadCameraImagesForProject(project: Project, cameras: Camera[]) {
    if (!project.developer || !project.projectTag) {
      return;
    }

    // Get developer tag
    this.http.get<{ developerTag: string }>(`${API_CONFIG.baseUrl}/api/developers/${project.developer}`).subscribe({
      next: (developer) => {
        const developerTag = developer.developerTag || '';
        const projectTag = project.projectTag || '';
        
        if (!developerTag || !projectTag) {
          return;
        }

        // Load images for each camera
        cameras.forEach(camera => {
          this.loadCameraImage(camera, developerTag, projectTag);
        });
      },
      error: (err) => {
        console.error('Error loading developer tag:', err);
      }
    });
  }

  /**
   * Load image for a single camera
   */
  private loadCameraImage(camera: Camera, developerTag: string, projectTag: string) {
    const cameraTag = camera.camera || '';
    if (!cameraTag) return;

    // Check cache first
    const cachedTimestamp = this.cacheService.getLastPhoto(developerTag, projectTag, cameraTag);
    
    if (cachedTimestamp) {
      const imageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, cachedTimestamp);
      // Preload image
      const img = new Image();
      img.onload = () => {
        camera.image = imageUrl;
        camera.thumbnail = imageUrl;
        camera.lastPhotoDate = this.formatTimestampToDate(cachedTimestamp);
      };
      img.onerror = () => {
        camera.image = null;
        camera.thumbnail = null;
      };
      img.src = imageUrl;
      return;
    }

    // Cache miss - fetch from API
    this.cameraPicsService.getCameraPictures(developerTag, projectTag, cameraTag).subscribe({
      next: (response) => {
        if (response.lastPhoto) {
          // Cache the timestamp
          this.cacheService.setLastPhoto(developerTag, projectTag, cameraTag, response.lastPhoto);
          
          const imageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, response.lastPhoto);
          
          // Preload image
          const img = new Image();
          img.onload = () => {
            camera.image = imageUrl;
            camera.thumbnail = imageUrl;
            camera.lastPhotoDate = this.formatTimestampToDate(response.lastPhoto);
          };
          img.onerror = () => {
            camera.image = null;
            camera.thumbnail = null;
          };
          img.src = imageUrl;
        } else {
          camera.image = null;
          camera.thumbnail = null;
          camera.lastPhotoDate = 'N/A';
        }
      },
      error: (err) => {
        console.warn(`Failed to load image for camera ${camera.id}:`, err);
        camera.image = null;
        camera.thumbnail = null;
        camera.lastPhotoDate = 'N/A';
      }
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
   * Format date string (ISO or other format) to DD-MMM-YYYY
   */
  formatDateString(dateStr: string): string {
    if (!dateStr) return 'N/A';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      
      const day = String(date.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  }
}

