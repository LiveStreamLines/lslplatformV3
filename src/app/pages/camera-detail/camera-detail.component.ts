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
  selectedDateObj: Date = new Date();
  showDatePicker = false;
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
        this.selectedDateObj = new Date(today);
        this.updateDateDisplay();

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

  loadLastImages(developerTag: string, projectTag: string, cameraTag: string) {
    // Get recent images from the last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const date1Str = sevenDaysAgo.getFullYear().toString() +
      String(sevenDaysAgo.getMonth() + 1).padStart(2, '0') +
      String(sevenDaysAgo.getDate()).padStart(2, '0');
    
    const date2Str = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    const url = `${API_CONFIG.baseUrl}/api/camerapics-s3-test/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
    
    this.http.post<any>(url, { date1: date1Str, date2: date2Str }).subscribe({
      next: (response) => {
        // Combine all photos from the date range
        const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        
        if (allPhotos.length > 0) {
          // Sort by timestamp (descending - newest first) and take the most recent ones (up to 50)
          const sortedPhotos = allPhotos.sort((a, b) => b.localeCompare(a)).slice(0, 50);
          
          // Convert to proxied image URLs
          this.images = sortedPhotos.map(timestamp =>
            this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
          );
          this.currentImageIndex = 0; // Start with the latest image
        } else {
          // No images in the last 7 days, try to get at least the last photo
          this.cameraPicsService.getCameraPictures(developerTag, projectTag, cameraTag).subscribe({
            next: (picsResponse) => {
              if (picsResponse.lastPhoto) {
                this.images = [this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, picsResponse.lastPhoto)];
                this.currentImageIndex = 0;
              } else {
                this.images = [PROJECT_IMAGE];
              }
              this.isLoading = false;
            },
            error: () => {
              this.images = [PROJECT_IMAGE];
              this.isLoading = false;
            }
          });
          return; // Don't set isLoading to false here, let the nested call handle it
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading recent images:', err);
        // Fallback to getting just the last photo
        this.cameraPicsService.getLastImageUrl(developerTag, projectTag, cameraTag).subscribe({
          next: (lastImageUrl) => {
            if (lastImageUrl) {
              this.images = [lastImageUrl];
              this.currentImageIndex = 0;
            } else {
              this.images = [PROJECT_IMAGE];
            }
            this.isLoading = false;
          },
          error: () => {
            this.images = [PROJECT_IMAGE];
            this.isLoading = false;
          }
        });
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
              // Load today's images first
              this.cameraPicsService.getTodayImages(developerTag, projectTag, cameraTag).subscribe({
                next: (imageUrls) => {
                  if (imageUrls.length > 0) {
                    // We have today's images, use them
                    this.images = imageUrls;
                    this.currentImageIndex = imageUrls.length - 1; // Start with the latest image
                    this.isLoading = false;
                  } else {
                    // No images for today, fall back to last images
                    this.loadLastImages(developerTag, projectTag, cameraTag);
                  }
                },
                error: (err) => {
                  console.error('Error loading today\'s images:', err);
                  // On error, try to load last images as fallback
                  this.loadLastImages(developerTag, projectTag, cameraTag);
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

  updateDateDisplay() {
    const day = String(this.selectedDateObj.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[this.selectedDateObj.getMonth()];
    const year = this.selectedDateObj.getFullYear();
    this.selectedDate = `${day}-${month}-${year}`;
    this.selectedTime = this.selectedDateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDateObj = new Date(input.value);
      this.updateDateDisplay();
      this.showDatePicker = false;
      
      // Reload images for the selected date
      if (this.camera) {
        this.loadImagesForDate(this.camera, this.selectedDateObj);
      }
    }
  }

  toggleDatePicker() {
    this.showDatePicker = !this.showDatePicker;
  }

  loadImagesForDate(camera: Camera, date: Date) {
    if (!camera.project || !camera.developer) {
      this.images = [PROJECT_IMAGE];
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.error = null;

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
              // Check if selected date is today
              const today = new Date();
              const isToday = date.toDateString() === today.toDateString();
              
              if (isToday) {
                // Load today's images
                this.cameraPicsService.getTodayImages(developerTag, projectTag, cameraTag).subscribe({
                  next: (imageUrls) => {
                    if (imageUrls.length > 0) {
                      this.images = imageUrls;
                      this.currentImageIndex = imageUrls.length - 1;
                    } else {
                      this.loadLastImages(developerTag, projectTag, cameraTag);
                    }
                    this.isLoading = false;
                  },
                  error: (err) => {
                    console.error('Error loading today\'s images:', err);
                    this.loadLastImages(developerTag, projectTag, cameraTag);
                  }
                });
              } else {
                // Load images for the selected date
                const dateStr = date.getFullYear().toString() +
                  String(date.getMonth() + 1).padStart(2, '0') +
                  String(date.getDate()).padStart(2, '0');

                const url = `${API_CONFIG.baseUrl}/api/camerapics-s3-test/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
                
                this.http.post<any>(url, { date1: dateStr, date2: dateStr }).subscribe({
                  next: (response) => {
                    const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
                    
                    if (allPhotos.length > 0) {
                      const sortedPhotos = allPhotos.sort((a, b) => b.localeCompare(a));
                      this.images = sortedPhotos.map(timestamp =>
                        this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
                      );
                      this.currentImageIndex = 0;
                    } else {
                      // No images for selected date, show fallback
                      this.images = [PROJECT_IMAGE];
                    }
                    this.isLoading = false;
                  },
                  error: (err) => {
                    console.error('Error loading images for date:', err);
                    this.images = [PROJECT_IMAGE];
                    this.isLoading = false;
                  }
                });
              }
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

  getDateInputValue(): string {
    // Format date as YYYY-MM-DD for HTML date input
    const year = this.selectedDateObj.getFullYear();
    const month = String(this.selectedDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
