import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { PROJECT_IMAGE } from '../../constants/figma-assets';
import { ProjectsService } from '../../services/projects.service';
import { CamerasService } from '../../services/cameras.service';
import { CameraPicsService } from '../../services/camera-pics.service';
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
export class ProjectDetailComponent implements OnInit {
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

  hoveredCameraId: string | null = null;
  quickViewCamera: Camera | null = null;
  isQuickViewOpen = false;
  currentCameraIndex: number = 0;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private projectsService: ProjectsService,
    private camerasService: CamerasService,
    private cameraPicsService: CameraPicsService,
    private communitiesService: CommunitiesService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.projectId = params['id'];
      if (this.projectId) {
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

        // Load community/developer name
        if (project.developer) {
          this.communitiesService.getCommunityById(project.developer).subscribe({
            next: (community) => {
              this.communityName = community.name;
            },
            error: () => {
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
        // Fetch last images for all cameras
        this.loadLastImagesForCameras(cameras);
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

    // Fetch developer to get developerTag if we don't have it
    if (this.project.developer && !this.developerTag) {
      this.http.get<{ developerTag: string }>(`${API_CONFIG.baseUrl}/api/developers/${this.project.developer}`).subscribe({
        next: (developer) => {
          this.developerTag = developer.developerTag || '';
          this.loadImagesWithTags(cameras, this.developerTag, projectTag);
        },
        error: (err: any) => {
          console.error('Failed to fetch developer tag:', err);
        }
      });
    } else if (this.developerTag) {
      // Developer tag already loaded
      this.loadImagesWithTags(cameras, this.developerTag, projectTag);
    }
  }

  loadImagesWithTags(cameras: Camera[], developerTag: string, projectTag: string) {
    if (!developerTag || !projectTag) {
      console.warn('Missing developerTag or projectTag');
      return;
    }

    // Create observables for fetching last images for each camera using tags
    const imageRequests = cameras.map(camera => {
      return this.cameraPicsService.getLastImageUrl(
        developerTag,
        projectTag,
        camera.camera // camera tag (camera name)
      ).pipe(
        map(imageUrl => ({ cameraId: camera.id, imageUrl })),
        catchError(error => {
          console.warn(`Failed to load last image for camera ${camera.id}:`, error);
          return of({ cameraId: camera.id, imageUrl: '' });
        })
      );
    });

    // Fetch all last images in parallel
    forkJoin(imageRequests).subscribe({
      next: (results) => {
        // Update camera images with last images
        results.forEach(result => {
          const camera = this.cameras.find(c => c.id === result.cameraId);
          if (camera && result.imageUrl) {
            camera.image = result.imageUrl;
            camera.thumbnail = result.imageUrl;
          }
        });
      },
      error: (err) => {
        console.error('Error loading last images:', err);
      }
    });
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
  }

  navigatePreviousCamera() {
    if (this.currentCameraIndex > 0) {
      this.currentCameraIndex--;
      this.quickViewCamera = this.cameras[this.currentCameraIndex];
    }
  }

  navigateNextCamera() {
    if (this.currentCameraIndex < this.cameras.length - 1) {
      this.currentCameraIndex++;
      this.quickViewCamera = this.cameras[this.currentCameraIndex];
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
}

