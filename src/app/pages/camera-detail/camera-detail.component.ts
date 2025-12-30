import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PROJECT_IMAGE } from '../../constants/figma-assets';
import { CamerasService } from '../../services/cameras.service';
import { CameraPicsService } from '../../services/camera-pics.service';
import { ProjectsService } from '../../services/projects.service';
import { Camera } from '../../models/camera.model';
import { API_CONFIG } from '../../config/api.config';

@Component({
  selector: 'app-camera-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './camera-detail.component.html',
  styleUrl: './camera-detail.component.css'
})
export class CameraDetailComponent implements OnInit {
  cameraId: string | null = null;
  camera: Camera | null = null;
  cameraName = 'Loading...';
  cameraStatus: 'Active' | 'Error' | 'Maintenance' = 'Active';
  selectedDate = '20-Dec-2025';
  selectedTime = '14:52:37';
  humidity = '50%';
  temperature = '24°C';
  currentImageIndex = 0;
  
  images: string[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private camerasService: CamerasService,
    private cameraPicsService: CameraPicsService,
    private projectsService: ProjectsService
  ) {}

  ngOnInit() {
    this.cameraId = this.route.snapshot.paramMap.get('cameraId');
    if (this.cameraId) {
      this.loadCameraData();
    }
  }

  loadCameraData() {
    this.isLoading = true;
    this.error = null;

    this.camerasService.getCameraById(this.cameraId!).subscribe({
      next: (camera) => {
        this.camera = camera;
        this.cameraName = camera.name || camera.camera || 'Camera';
        this.cameraStatus = camera.status;
        
        // Update selected date and time to today
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[today.getMonth()];
        const year = today.getFullYear();
        this.selectedDate = `${day}-${month}-${year}`;
        this.selectedTime = today.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Load today's images
        this.loadTodayImages(camera);
      },
      error: (err) => {
        console.error('Error loading camera:', err);
        this.error = 'Failed to load camera data.';
        this.isLoading = false;
        this.images = [PROJECT_IMAGE]; // Fallback image
      }
    });
  }

  loadTodayImages(camera: Camera) {
    if (!camera.project || !camera.developer) {
      this.images = [PROJECT_IMAGE];
      this.isLoading = false;
      return;
    }

    // Fetch project to get projectTag
    this.projectsService.getProjectById(camera.project).subscribe({
      next: (project) => {
        const projectTag = project.projectTag || '';
        
        // Fetch developer to get developerTag
        this.http.get<any>(`${API_CONFIG.baseUrl}/api/developers/${camera.developer}`).subscribe({
          next: (developer) => {
            const developerTag = developer.developerTag || '';
            const cameraTag = camera.camera || '';

            if (developerTag && projectTag && cameraTag) {
              // Load today's images
              this.cameraPicsService.getTodayImages(developerTag, projectTag, cameraTag).subscribe({
                next: (imageUrls) => {
                  if (imageUrls.length > 0) {
                    this.images = imageUrls;
                    this.currentImageIndex = imageUrls.length - 1; // Start with the latest image
                  } else {
                    this.images = [PROJECT_IMAGE]; // Fallback if no images
                  }
                  this.isLoading = false;
                },
                error: (err) => {
                  console.error('Error loading today\'s images:', err);
                  this.images = [PROJECT_IMAGE];
                  this.isLoading = false;
                }
              });
            } else {
              this.images = [PROJECT_IMAGE];
              this.isLoading = false;
            }
          },
          error: (err) => {
            console.error('Error loading developer:', err);
            this.images = [PROJECT_IMAGE];
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error loading project:', err);
        this.images = [PROJECT_IMAGE];
        this.isLoading = false;
      }
    });
  }

  previousImage() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  nextImage() {
    if (this.currentImageIndex < this.images.length - 1) {
      this.currentImageIndex++;
    }
  }

  fullscreenImage() {
    // Implement fullscreen functionality
  }
}
