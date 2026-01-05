import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
  @ViewChild('dateInput', { static: false }) dateInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dateInputNew', { static: false }) dateInputNewRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dateInputModal', { static: false }) dateInputModalRef!: ElementRef<HTMLInputElement>;
  
  // Expose console to template for debugging
  console = console;

  cameraId: string | null = null;
  camera: Camera | null = null;
  cameraName = 'Loading...';
  cameraStatus: 'Online' | 'Offline' | 'Stopped' | 'Removed' = 'Stopped';
  selectedDate = '';
  selectedTime = '';
  selectedDateObj: Date = new Date();
  showDatePickerModal = false;
  humidity = '50%';
  temperature = '24°C';
  currentImageIndex = 0;
  
  images: string[] = [];
  isLoading = false;
  error: string | null = null;
  isFullscreen = false;

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
        
        // Initialize date to today
        this.selectedDateObj = new Date();
        this.updateDateDisplay();

        // Load images for today
        this.loadImagesForSelectedDate(camera);
      },
      error: (err) => {
        console.error('Error loading camera:', err);
        this.error = 'Failed to load camera data.';
        this.isLoading = false;
        this.images = [PROJECT_IMAGE];
      }
    });
  }

  loadImagesForSelectedDate(camera: Camera) {
    if (!camera.project || !camera.developer) {
      this.images = [PROJECT_IMAGE];
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.error = null;

    forkJoin({
      project: this.projectsService.getProjectById(camera.project),
      developer: this.http.get<any>(`${API_CONFIG.baseUrl}/api/developers/${camera.developer}`)
    }).subscribe({
      next: ({ project, developer }) => {
        const projectTag = project.projectTag || '';
        const developerTag = developer.developerTag || '';
        const cameraTag = camera.camera || '';

        if (developerTag && projectTag && cameraTag) {
          const selectedDateStr = this.formatDateToYYYYMMDD(this.selectedDateObj);
          const todayStr = this.formatDateToYYYYMMDD(new Date());

          if (selectedDateStr === todayStr) {
            this.loadTodayImages(developerTag, projectTag, cameraTag);
          } else {
            this.loadImagesForDate(developerTag, projectTag, cameraTag, selectedDateStr);
          }
        } else {
          this.images = [PROJECT_IMAGE];
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('Error loading project or developer:', err);
        this.images = [PROJECT_IMAGE];
        this.isLoading = false;
      }
    });
  }

  loadTodayImages(developerTag: string, projectTag: string, cameraTag: string) {
    // Get timestamps first, then convert to URLs
    const today = new Date();
    const todayStr = String(today.getFullYear()) +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    const url = `${API_CONFIG.baseUrl}/api/camerapics-s3-test/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
    
    this.http.post<any>(url, { date1: todayStr, date2: todayStr }).subscribe({
      next: (response) => {
        const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        
        if (allPhotos.length > 0) {
          const sortedPhotos = allPhotos.sort((a, b) => b.localeCompare(a));
          this.images = sortedPhotos.map(timestamp =>
            this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
          );
          this.currentImageIndex = sortedPhotos.length - 1; // Start with latest
        } else {
          this.loadRecentImages(developerTag, projectTag, cameraTag);
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading today\'s images:', err);
        this.loadRecentImages(developerTag, projectTag, cameraTag);
      }
    });
  }

  loadImagesForDate(developerTag: string, projectTag: string, cameraTag: string, dateStr: string) {
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

  loadRecentImages(developerTag: string, projectTag: string, cameraTag: string) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const startDateStr = this.formatDateToYYYYMMDD(startDate);
    const endDateStr = this.formatDateToYYYYMMDD(endDate);

    const url = `${API_CONFIG.baseUrl}/api/camerapics-s3-test/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
    
    this.http.post<any>(url, { date1: startDateStr, date2: endDateStr }).subscribe({
      next: (response) => {
        const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        
        if (allPhotos.length > 0) {
          const sortedPhotos = allPhotos.sort((a, b) => b.localeCompare(a)).slice(0, 50);
          this.images = sortedPhotos.map(timestamp =>
            this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
          );
          this.currentImageIndex = 0;
        } else {
          this.loadLastSingleImage(developerTag, projectTag, cameraTag);
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading recent images:', err);
        this.loadLastSingleImage(developerTag, projectTag, cameraTag);
      }
    });
  }

  loadLastSingleImage(developerTag: string, projectTag: string, cameraTag: string) {
    this.cameraPicsService.getLastImageUrl(developerTag, projectTag, cameraTag).subscribe({
      next: (imageUrl) => {
        if (imageUrl) {
          this.images = [imageUrl];
          this.currentImageIndex = 0;
        } else {
          this.images = [PROJECT_IMAGE];
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading last image:', err);
        this.images = [PROJECT_IMAGE];
        this.isLoading = false;
      }
    });
  }

  formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  updateDateDisplay() {
    const day = String(this.selectedDateObj.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[this.selectedDateObj.getMonth()];
    const year = this.selectedDateObj.getFullYear();
    this.selectedDate = `${day}-${month}-${year}`;
    this.selectedTime = this.selectedDateObj.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  getDateInputValue(): string {
    const year = this.selectedDateObj.getFullYear();
    const month = String(this.selectedDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDatePickerClick(event: Event) {
    console.log('Date picker clicked!', event);
    event.preventDefault();
    event.stopPropagation();
    
    // Use setTimeout to ensure ViewChild is available
    setTimeout(() => {
      const input = this.dateInputRef?.nativeElement;
      console.log('Date input element:', input);
      if (input) {
        console.log('Clicking date input...');
        input.focus();
        input.click();
        // Try showPicker if available
        if (typeof (input as any).showPicker === 'function') {
          console.log('Trying showPicker()...');
          (input as any).showPicker().catch((err: any) => {
            console.log('showPicker failed:', err);
          });
        }
      } else {
        console.warn('Date input element not found!');
      }
    }, 0);
  }

  onNewDatePickerClick(event: Event) {
    console.log('NEW Date picker clicked!', event);
    event.preventDefault();
    event.stopPropagation();
    
    // Use setTimeout to ensure ViewChild is available
    setTimeout(() => {
      const input = this.dateInputNewRef?.nativeElement;
      console.log('NEW Date input element:', input);
      if (input) {
        // First try showPicker() if available (modern browsers)
        if (typeof (input as any).showPicker === 'function') {
          console.log('Trying showPicker() on NEW input...');
          (input as any).showPicker().catch((err: any) => {
            console.log('showPicker failed, trying click fallback:', err);
            input.focus();
            input.click();
          });
        } else {
          console.log('showPicker not available, using click...');
          input.focus();
          // Force the input to be visible temporarily
          const originalStyle = input.style.display;
          input.style.display = 'block';
          input.style.position = 'fixed';
          input.style.top = '50%';
          input.style.left = '50%';
          input.style.zIndex = '99999';
          input.click();
          // Restore after a short delay
          setTimeout(() => {
            input.style.display = originalStyle;
            input.style.position = '';
            input.style.top = '';
            input.style.left = '';
            input.style.zIndex = '';
          }, 100);
        }
      } else {
        console.warn('NEW Date input element not found!');
      }
    }, 0);
  }

  openDatePickerModal() {
    this.showDatePickerModal = true;
    // Focus the date input in the modal after it's rendered
    setTimeout(() => {
      const input = this.dateInputModalRef?.nativeElement;
      if (input) {
        input.focus();
        // Try to open the picker directly
        if (typeof (input as any).showPicker === 'function') {
          (input as any).showPicker().catch((err: any) => {
            console.log('showPicker failed:', err);
          });
        }
      }
    }, 100);
  }

  closeDatePickerModal(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.showDatePickerModal = false;
  }

  applyDateFromModal() {
    const input = this.dateInputModalRef?.nativeElement;
    if (input && input.value) {
      this.onDateChange({ target: input } as any);
    }
    this.closeDatePickerModal();
  }

  onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      // Parse YYYY-MM-DD format
      const dateParts = input.value.split('-');
      this.selectedDateObj = new Date(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[2], 10)
      );
      this.updateDateDisplay();
      
      // Reload images for the selected date
      if (this.camera) {
        this.loadImagesForSelectedDate(this.camera);
      }
    }
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
    if (this.images.length === 0) return;
    this.isFullscreen = true;
    // Prevent body scroll when fullscreen is open
    document.body.style.overflow = 'hidden';
  }

  closeFullscreen() {
    this.isFullscreen = false;
    document.body.style.overflow = '';
  }

  nextImageFullscreen() {
    if (this.currentImageIndex < this.images.length - 1) {
      this.currentImageIndex++;
    }
  }

  previousImageFullscreen() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  onFullscreenKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.closeFullscreen();
    } else if (event.key === 'ArrowRight') {
      this.nextImageFullscreen();
    } else if (event.key === 'ArrowLeft') {
      this.previousImageFullscreen();
    }
  }

}
