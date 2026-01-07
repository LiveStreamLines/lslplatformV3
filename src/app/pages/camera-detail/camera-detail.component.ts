import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
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
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './camera-detail.component.html',
  styleUrl: './camera-detail.component.css'
})
export class CameraDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('dateInput', { static: false }) dateInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dateInputNew', { static: false }) dateInputNewRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dateInputModal', { static: false }) dateInputModalRef!: ElementRef<HTMLInputElement>;
  @ViewChild('thumbnailStrip', { static: false }) thumbnailStripRef!: ElementRef<HTMLDivElement>;
  
  // Expose console to template for debugging
  console = console;

  cameraId: string | null = null;
  camera: Camera | null = null;
  cameraName = 'Loading...';
  cameraStatus: 'Online' | 'Offline' | 'Stopped' | 'Removed' = 'Stopped';
  projectId: string | null = null;
  selectedDate = '';
  selectedTime = '';
  selectedDateObj: Date = new Date();
  showDatePickerModal = false;
  humidity = '50%';
  temperature = '24°C';
  currentImageIndex = 0;
  
  images: string[] = [];
  imageTimestamps: string[] = []; // Store timestamps for each image
  isLoading = false;
  loadingProgress = 0; // Loading progress percentage (0-100)
  error: string | null = null;
  currentProjectTag: string = '';
  currentDeveloperTag: string = '';
  currentCameraTag: string = '';
  isFullscreen = false;

  // Thumbnail Strip
  showThumbnailStrip = false;
  thumbnailScrollLeft = 0;
  maxThumbnailScroll = 0;
  private thumbnailScrollListenerAdded = false;

  // Video Generation Modal
  showVideoGenerationModal = false;
  videoFromDate: Date = new Date();
  videoFromTime: string = '00:00:00';
  videoToDate: Date = new Date();
  videoToTime: string = '23:59:59';
  videoResolution: string = '720';
  videoDuration: string = '1 Minute';
  showDateInVideo: boolean = false;
  showTimeInVideo: boolean = true;
  videoOverlayType: 'text' | 'logo' | 'watermark' | null = null;
  videoBrightness: number = 42;
  videoContrast: number = 42;
  videoSaturation: number = 42;

  // Photo Generation Modal
  showPhotoGenerationModal = false;
  photoFromDate: Date = new Date();
  photoFromTime: string = '00:00:00';
  photoToDate: Date = new Date();
  photoToTime: string = '23:59:59';
  showDateInPhoto: boolean = false;
  showTimeInPhoto: boolean = true;

  // Compare Modal
  showCompareModal = false;
  compareMode: 'side-by-side' | 'slider' | 'spot' = 'side-by-side';
  compareLeftDate: Date = new Date();
  compareLeftTime: string = '00:00:00';
  compareRightDate: Date = new Date();
  compareRightTime: string = '23:59:59';
  compareLeftImages: string[] = []; // Array of timestamps
  compareRightImages: string[] = []; // Array of timestamps
  selectedComparisonImage1: string | null = null;
  selectedComparisonImage2: string | null = null;
  loadingCompareLeft: boolean = false;
  loadingCompareRight: boolean = false;
  showCompareLeftThumbnailStrip: boolean = false; // Show thumbnail strip for left side
  showCompareRightThumbnailStrip: boolean = false; // Show thumbnail strip for right side
  comparisonSliderValue: number = 50; // 0-100, 50 is middle
  isDraggingComparison: boolean = false;
  rectangleX: number = 50; // percentage from left
  rectangleY: number = 50; // percentage from top
  rectangleSize: number = 183; // size in pixels
  isDraggingRectangle: boolean = false;
  rectangleDragStartX: number = 0;
  rectangleDragStartY: number = 0;
  rectangleWrapperWidth: number = 1000; // will be updated dynamically
  rectangleWrapperHeight: number = 600; // will be updated dynamically
  showCompareLeftDatePicker = false;
  showCompareLeftTimePicker = false;
  showCompareRightDatePicker = false;
  showCompareRightTimePicker = false;
  tempCompareLeftDate: Date | null = null;
  tempCompareRightDate: Date | null = null;
  tempCompareLeftTime: string | null = null;
  tempCompareRightTime: string | null = null;

  // Studio Modal
  showStudioModal = false;
  studioDate: Date = new Date();
  studioTime: string = '00:00:00';
  studioImage: string | null = null;
  studioImageTimestamp: string | null = null;
  studioTool: 'crop' | 'text' | 'box' | 'circle' | 'arrow' | 'image' | 'effect' | null = null;
  showStudioDatePicker = false;
  showStudioTimePicker = false;
  studioHistory: any[] = []; // For undo/redo functionality
  studioHistoryIndex: number = -1;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
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
    this.loadingProgress = 0;
    this.error = null;

    this.camerasService.getCameraById(this.cameraId!).subscribe({
      next: (camera) => {
        this.camera = camera;
        this.cameraName = camera.name || camera.camera || 'Camera';
        this.cameraStatus = camera.status;
        this.projectId = camera.project || null;
        
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

        // Store tags for use in compare/studio modals
        this.currentProjectTag = projectTag;
        this.currentDeveloperTag = developerTag;
        this.currentCameraTag = cameraTag;

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
          this.imageTimestamps = sortedPhotos;
          this.loadingProgress = 0;
          
          // Load the last (most recent) image first and wait for it to fully load
          const lastTimestamp = sortedPhotos[sortedPhotos.length - 1];
          const lastImageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, lastTimestamp);
          
          // Simulate progress and preload the last image first
          this.simulateProgress();
          
          const img = new Image();
          img.onload = () => {
            // Image is fully loaded, now set all images
            this.images = sortedPhotos.map(timestamp =>
              this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
            );
            this.currentImageIndex = sortedPhotos.length - 1; // Start with latest
            this.loadingProgress = 100;
            
            // Wait a bit more to ensure images are ready before hiding loading
            setTimeout(() => {
              this.isLoading = false;
            }, 300);
          };
          img.onerror = () => {
            // Even if last image fails, still show the list
            this.images = sortedPhotos.map(timestamp =>
              this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
            );
            this.currentImageIndex = sortedPhotos.length - 1;
            this.loadingProgress = 100;
            setTimeout(() => {
              this.isLoading = false;
            }, 300);
          };
          img.src = lastImageUrl;
        } else {
          this.loadRecentImages(developerTag, projectTag, cameraTag);
        }
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
          this.imageTimestamps = sortedPhotos;
          this.loadingProgress = 0;
          
          // Load the last (most recent) image first and wait for it to fully load
          const lastTimestamp = sortedPhotos[sortedPhotos.length - 1];
          const lastImageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, lastTimestamp);
          
          // Simulate progress and preload the last image first
          this.simulateProgress();
          
          const img = new Image();
          img.onload = () => {
            // Image is fully loaded, now set all images
            this.images = sortedPhotos.map(timestamp =>
              this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
            );
            this.currentImageIndex = sortedPhotos.length - 1; // Start with latest
            this.loadingProgress = 100;
            
            // Wait a bit more to ensure images are ready before hiding loading
            setTimeout(() => {
              this.isLoading = false;
            }, 300);
          };
          img.onerror = () => {
            // Even if last image fails, still show the list
            this.images = sortedPhotos.map(timestamp =>
              this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
            );
            this.currentImageIndex = sortedPhotos.length - 1;
            this.loadingProgress = 100;
            setTimeout(() => {
              this.isLoading = false;
            }, 300);
          };
          img.src = lastImageUrl;
        } else {
          this.images = [PROJECT_IMAGE];
          this.imageTimestamps = [];
          this.loadingProgress = 100;
          this.isLoading = false;
        }
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
          this.imageTimestamps = sortedPhotos;
          this.loadingProgress = 0;
          
          // Load the last (most recent) image first and wait for it to fully load
          const lastTimestamp = sortedPhotos[sortedPhotos.length - 1];
          const lastImageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, lastTimestamp);
          
          // Simulate progress and preload the last image first
          this.simulateProgress();
          
          const img = new Image();
          img.onload = () => {
            // Image is fully loaded, now set all images
            this.images = sortedPhotos.map(timestamp =>
              this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
            );
            this.currentImageIndex = sortedPhotos.length - 1; // Start with latest
            this.loadingProgress = 100;
            
            // Wait a bit more to ensure images are ready before hiding loading
            setTimeout(() => {
              this.isLoading = false;
            }, 300);
          };
          img.onerror = () => {
            // Even if last image fails, still show the list
            this.images = sortedPhotos.map(timestamp =>
              this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp)
            );
            this.currentImageIndex = sortedPhotos.length - 1;
            this.loadingProgress = 100;
            setTimeout(() => {
              this.isLoading = false;
            }, 300);
          };
          img.src = lastImageUrl;
        } else {
          this.loadLastSingleImage(developerTag, projectTag, cameraTag);
        }
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
          // Try to extract timestamp from URL (format: .../YYYYMMDDHHMMSS.jpg)
          const timestampMatch = imageUrl.match(/(\d{14})\.jpg/);
          if (timestampMatch) {
            this.imageTimestamps = [timestampMatch[1]];
          } else {
            // Try to get from cache service
            this.cameraPicsService.getCameraPictures(developerTag, projectTag, cameraTag).subscribe({
              next: (response) => {
                if (response.lastPhoto) {
                  this.imageTimestamps = [response.lastPhoto];
                } else {
                  this.imageTimestamps = [];
                }
              },
              error: () => {
                this.imageTimestamps = [];
              }
            });
          }
          this.currentImageIndex = 0;
        } else {
          this.images = [PROJECT_IMAGE];
          this.imageTimestamps = [];
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading last image:', err);
        this.images = [PROJECT_IMAGE];
        this.imageTimestamps = [];
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

  /**
   * Simulate loading progress to show percentage
   */
  simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15; // Increment by random amount (0-15%)
      if (progress >= 90) {
        progress = 90; // Stop at 90%, wait for actual image load
        clearInterval(interval);
      }
      this.loadingProgress = Math.min(Math.round(progress), 90);
    }, 200); // Update every 200ms
  }

  /**
   * Navigate back to project detail page
   */
  navigateToProject() {
    if (this.projectId) {
      this.router.navigate(['/project', this.projectId]);
    }
  }

  /**
   * Format timestamp (YYYYMMDDHHMMSS) to date string (DD-MMM-YYYY)
   */
  formatTimestampToDate(timestamp: string): string {
    if (!timestamp || timestamp.length < 8) return '';
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    return `${day}-${monthNames[monthIndex]}-${year}`;
  }

  /**
   * Format timestamp (YYYYMMDDHHMMSS) to time string (HH:MM:SS)
   */
  formatTimestampToTime(timestamp: string): string {
    if (!timestamp || timestamp.length < 14) return '';
    const hour = timestamp.substring(8, 10);
    const minute = timestamp.substring(10, 12);
    const second = timestamp.substring(12, 14);
    return `${hour}:${minute}:${second}`;
  }

  /**
   * Open video generation modal
   */
  openVideoGenerationModal() {
    // Initialize with current date/time
    this.videoFromDate = new Date();
    this.videoToDate = new Date();
    this.videoFromTime = '00:00:00';
    this.videoToTime = '23:59:59';
    this.showVideoGenerationModal = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close video generation modal
   */
  closeVideoGenerationModal(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.showVideoGenerationModal = false;
    document.body.style.overflow = '';
  }

  /**
   * Format date for video picker display (DD-MMM-YYYY)
   */
  formatDateForVideo(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Format time for video picker display (HH:MM:SS)
   */
  formatTimeForVideo(time: string): string {
    return time;
  }

  /**
   * Generate video with current settings
   */
  generateVideo() {
    // TODO: Implement video generation API call
    console.log('Generating video with settings:', {
      fromDate: this.videoFromDate,
      fromTime: this.videoFromTime,
      toDate: this.videoToDate,
      toTime: this.videoToTime,
      resolution: this.videoResolution,
      duration: this.videoDuration,
      showDate: this.showDateInVideo,
      showTime: this.showTimeInVideo,
      overlayType: this.videoOverlayType,
      brightness: this.videoBrightness,
      contrast: this.videoContrast,
      saturation: this.videoSaturation
    });
    
    // Close modal after generation starts
    // this.closeVideoGenerationModal();
  }

  /**
   * Open photo generation modal
   */
  openPhotoGenerationModal() {
    // Initialize with current date/time
    this.photoFromDate = new Date();
    this.photoToDate = new Date();
    this.photoFromTime = '00:00:00';
    this.photoToTime = '23:59:59';
    this.showPhotoGenerationModal = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close photo generation modal
   */
  closePhotoGenerationModal(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.showPhotoGenerationModal = false;
    document.body.style.overflow = '';
  }

  /**
   * Format date for photo picker display (DD-MMM-YYYY)
   */
  formatDateForPhoto(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Format time for photo picker display (HH:MM:SS)
   */
  formatTimeForPhoto(time: string): string {
    return time;
  }

  /**
   * Generate photo with current settings
   */
  generatePhoto() {
    // TODO: Implement photo generation API call
    console.log('Generating photo with settings:', {
      fromDate: this.photoFromDate,
      fromTime: this.photoFromTime,
      toDate: this.photoToDate,
      toTime: this.photoToTime,
      showDate: this.showDateInPhoto,
      showTime: this.showTimeInPhoto
    });
    
    // Close modal after generation starts
    // this.closePhotoGenerationModal();
  }

  /**
   * Toggle thumbnail strip visibility
   */
  toggleThumbnailStrip() {
    this.showThumbnailStrip = !this.showThumbnailStrip;
    if (this.showThumbnailStrip) {
      // Calculate max scroll when strip is shown
      setTimeout(() => {
        this.updateThumbnailScroll();
      }, 100);
      // Add click outside listener
      setTimeout(() => {
        document.addEventListener('click', this.handleClickOutsideThumbnailStrip);
      }, 0);
    } else {
      // Remove click outside listener
      document.removeEventListener('click', this.handleClickOutsideThumbnailStrip);
    }
  }

  /**
   * Close thumbnail strip
   */
  closeThumbnailStrip() {
    this.showThumbnailStrip = false;
    document.removeEventListener('click', this.handleClickOutsideThumbnailStrip);
  }

  /**
   * Handle click outside thumbnail strip
   */
  private handleClickOutsideThumbnailStrip = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const stripContainer = document.querySelector('.thumbnail-strip-container');
    const sliderBtn = document.querySelector('.slider-btn');
    
    // Close if clicking outside the strip and not on the slider button
    if (stripContainer && !stripContainer.contains(target) && 
        sliderBtn && !sliderBtn.contains(target)) {
      this.closeThumbnailStrip();
    }
  };

  /**
   * Update thumbnail scroll limits
   */
  updateThumbnailScroll() {
    if (this.thumbnailStripRef?.nativeElement) {
      const strip = this.thumbnailStripRef.nativeElement;
      const content = strip.querySelector('.thumbnail-strip-content') as HTMLElement;
      if (content) {
        this.maxThumbnailScroll = Math.max(0, content.scrollWidth - strip.clientWidth);
      }
    }
  }

  /**
   * Scroll thumbnails left or right
   */
  scrollThumbnails(direction: 'prev' | 'next') {
    if (!this.thumbnailStripRef?.nativeElement) return;

    const strip = this.thumbnailStripRef.nativeElement;
    const scrollAmount = 200; // Pixels to scroll per click
    const currentScroll = strip.scrollLeft;

    if (direction === 'prev') {
      strip.scrollTo({
        left: Math.max(0, currentScroll - scrollAmount),
        behavior: 'smooth'
      });
    } else {
      strip.scrollTo({
        left: Math.min(this.maxThumbnailScroll, currentScroll + scrollAmount),
        behavior: 'smooth'
      });
    }

    // Update scroll position after animation
    setTimeout(() => {
      this.thumbnailScrollLeft = strip.scrollLeft;
    }, 300);
  }

  /**
   * Select thumbnail and update main image
   */
  selectThumbnail(index: number) {
    if (index >= 0 && index < this.images.length) {
      this.currentImageIndex = index;
      // Scroll to selected thumbnail if needed
      this.scrollToThumbnail(index);
    }
  }

  /**
   * Scroll to specific thumbnail
   */
  scrollToThumbnail(index: number) {
    if (!this.thumbnailStripRef?.nativeElement) return;

    const strip = this.thumbnailStripRef.nativeElement;
    const content = strip.querySelector('.thumbnail-strip-content') as HTMLElement;
    if (!content) return;

    const thumbnail = content.children[index] as HTMLElement;
    if (!thumbnail) return;

    const thumbnailLeft = thumbnail.offsetLeft;
    const thumbnailWidth = thumbnail.offsetWidth;
    const stripWidth = strip.clientWidth;
    const currentScroll = strip.scrollLeft;

    // Calculate if thumbnail is visible
    const thumbnailRight = thumbnailLeft + thumbnailWidth;
    const visibleLeft = currentScroll;
    const visibleRight = currentScroll + stripWidth;

    // Scroll if thumbnail is not fully visible
    if (thumbnailLeft < visibleLeft) {
      strip.scrollTo({
        left: thumbnailLeft - 10, // 10px padding
        behavior: 'smooth'
      });
    } else if (thumbnailRight > visibleRight) {
      strip.scrollTo({
        left: thumbnailRight - stripWidth + 10, // 10px padding
        behavior: 'smooth'
      });
    }

    setTimeout(() => {
      this.thumbnailScrollLeft = strip.scrollLeft;
      this.updateThumbnailScroll();
    }, 300);
  }

  /**
   * Update thumbnail scroll position when main image changes
   */
  ngAfterViewChecked() {
    // Add scroll listener only once when strip becomes visible
    if (this.showThumbnailStrip && this.images.length > 0 && this.thumbnailStripRef?.nativeElement && !this.thumbnailScrollListenerAdded) {
      const strip = this.thumbnailStripRef.nativeElement;
      strip.addEventListener('scroll', () => {
        this.thumbnailScrollLeft = strip.scrollLeft;
        this.updateThumbnailScroll();
      });
      this.thumbnailScrollListenerAdded = true;
    } else if (!this.showThumbnailStrip) {
      this.thumbnailScrollListenerAdded = false;
    }
  }

  /**
   * Cleanup on component destroy
   */
  ngOnDestroy() {
    // Remove click outside listener if component is destroyed
    document.removeEventListener('click', this.handleClickOutsideThumbnailStrip);
    // Remove drag listeners
    if (this.isDraggingComparison) {
      this.isDraggingComparison = false;
    }
    if (this.isDraggingRectangle) {
      this.isDraggingRectangle = false;
    }
  }

  // ==================== COMPARE MODAL METHODS ====================

  /**
   * Open compare modal
   */
  openCompareModal() {
    // Initialize with current image timestamp
    if (this.images.length > 0 && this.imageTimestamps.length > 0) {
      const currentTimestamp = this.imageTimestamps[this.currentImageIndex];
      if (currentTimestamp && currentTimestamp.length >= 8) {
        const year = parseInt(currentTimestamp.substring(0, 4), 10);
        const month = parseInt(currentTimestamp.substring(4, 6), 10) - 1;
        const day = parseInt(currentTimestamp.substring(6, 8), 10);
        const hour = currentTimestamp.length >= 10 ? parseInt(currentTimestamp.substring(8, 10), 10) : 0;
        const minute = currentTimestamp.length >= 12 ? parseInt(currentTimestamp.substring(10, 12), 10) : 0;
        const second = currentTimestamp.length >= 14 ? parseInt(currentTimestamp.substring(12, 14), 10) : 0;
        
        this.compareLeftDate = new Date(year, month, day);
        this.compareLeftTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        
        this.compareRightDate = new Date(year, month, day);
        this.compareRightTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
      }
    }
    
    // Reset comparison state
    this.selectedComparisonImage1 = null;
    this.selectedComparisonImage2 = null;
    this.compareLeftImages = [];
    this.compareRightImages = [];
    this.comparisonSliderValue = 50;
    this.rectangleX = 50;
    this.rectangleY = 50;
    this.compareMode = 'side-by-side';
    this.showCompareLeftThumbnailStrip = false;
    this.showCompareRightThumbnailStrip = false;
    this.showCompareModal = true;
    document.body.style.overflow = 'hidden';
    
    // Load all images for both dates
    this.loadCompareImagesForDate('left');
    this.loadCompareImagesForDate('right');
  }

  /**
   * Close compare modal
   */
  closeCompareModal(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.showCompareModal = false;
    document.body.style.overflow = '';
    this.isDraggingComparison = false;
    this.isDraggingRectangle = false;
  }

  /**
   * Load all images for a date (for thumbnail selection)
   */
  loadCompareImagesForDate(side: 'left' | 'right') {
    if (!this.camera) return;

    const date = side === 'left' ? this.compareLeftDate : this.compareRightDate;
    const dateStr = this.formatDateToYYYYMMDD(date);

    if (side === 'left') {
      this.loadingCompareLeft = true;
      this.compareLeftImages = [];
    } else {
      this.loadingCompareRight = true;
      this.compareRightImages = [];
    }

    forkJoin({
      project: this.projectsService.getProjectById(this.camera.project!),
      developer: this.http.get<any>(`${API_CONFIG.baseUrl}/api/developers/${this.camera.developer}`)
    }).subscribe({
      next: ({ project, developer }) => {
        const projectTag = project.projectTag || '';
        const developerTag = developer.developerTag || '';
        const cameraTag = this.camera!.camera || '';

        // Store tags if not already stored
        if (!this.currentProjectTag) this.currentProjectTag = projectTag;
        if (!this.currentDeveloperTag) this.currentDeveloperTag = developerTag;
        if (!this.currentCameraTag) this.currentCameraTag = cameraTag;

        if (developerTag && projectTag && cameraTag) {
          const url = `${API_CONFIG.baseUrl}/api/camerapics-s3-test/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
          
          // For a single date, use only date1 (as per test component)
          const requestBody = { date1: dateStr };
          
          console.log(`Requesting images for ${side} on date:`, dateStr);
          console.log(`Request URL:`, url);
          console.log(`Request body:`, requestBody);
          
          this.http.post<any>(url, requestBody).subscribe({
            next: (response) => {
              console.log(`API response for ${side} on ${dateStr}:`, response);
              
              // For single date query, images are in date1Photos
              const date1Photos = response.date1Photos || [];
              const date2Photos = response.date2Photos || [];
              // Combine both arrays in case date2 was also provided
              const allPhotos = [...new Set([...date1Photos, ...date2Photos])];
              
              console.log(`date1Photos length:`, date1Photos.length);
              console.log(`date2Photos length:`, date2Photos.length);
              console.log(`Total unique photos for ${side}:`, allPhotos.length);
              
              if (side === 'left') {
                this.compareLeftImages = allPhotos.sort((a, b) => a.localeCompare(b));
                this.loadingCompareLeft = false;
                console.log(`Final left images array length:`, this.compareLeftImages.length);
                
                // Select first image by default, or closest to selected time
                if (this.compareLeftImages.length > 0) {
                  this.selectCompareImageByTime('left');
                } else {
                  // If no images, clear selection and show message
                  this.selectedComparisonImage1 = null;
                  console.warn(`No images found for date ${dateStr}. First photo: ${response.firstPhoto}, Last photo: ${response.lastPhoto}`);
                }
              } else {
                this.compareRightImages = allPhotos.sort((a, b) => a.localeCompare(b));
                this.loadingCompareRight = false;
                console.log(`Final right images array length:`, this.compareRightImages.length);
                
                // Select first image by default, or closest to selected time
                if (this.compareRightImages.length > 0) {
                  this.selectCompareImageByTime('right');
                } else {
                  // If no images, clear selection and show message
                  this.selectedComparisonImage2 = null;
                  console.warn(`No images found for date ${dateStr}. First photo: ${response.firstPhoto}, Last photo: ${response.lastPhoto}`);
                }
              }
            },
            error: (err) => {
              console.error(`Error loading compare images for ${side}:`, err);
              if (side === 'left') {
                this.loadingCompareLeft = false;
                this.compareLeftImages = [];
                this.selectedComparisonImage1 = null;
              } else {
                this.loadingCompareRight = false;
                this.compareRightImages = [];
                this.selectedComparisonImage2 = null;
              }
            }
          });
        }
      },
      error: (err) => {
        console.error('Error loading project or developer for compare:', err);
        if (side === 'left') {
          this.loadingCompareLeft = false;
        } else {
          this.loadingCompareRight = false;
        }
      }
    });
  }

  /**
   * Select comparison image by timestamp (from thumbnail)
   */
  selectComparisonImage1(timestamp: string): void {
    this.selectedComparisonImage1 = timestamp;
    // Hide thumbnail strip when image is selected
    this.showCompareLeftThumbnailStrip = false;
    // Update time to match selected image
    if (timestamp.length >= 14) {
      const hour = parseInt(timestamp.substring(8, 10), 10);
      const minute = parseInt(timestamp.substring(10, 12), 10);
      const second = parseInt(timestamp.substring(12, 14), 10);
      this.compareLeftTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    }
  }

  /**
   * Select comparison image 2
   */
  selectComparisonImage2(timestamp: string): void {
    this.selectedComparisonImage2 = timestamp;
    // Hide thumbnail strip when image is selected
    this.showCompareRightThumbnailStrip = false;
    // Update time to match selected image
    if (timestamp.length >= 14) {
      const hour = parseInt(timestamp.substring(8, 10), 10);
      const minute = parseInt(timestamp.substring(10, 12), 10);
      const second = parseInt(timestamp.substring(12, 14), 10);
      this.compareRightTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    }
  }

  /**
   * Select compare image closest to selected time
   */
  selectCompareImageByTime(side: 'left' | 'right') {
    const images = side === 'left' ? this.compareLeftImages : this.compareRightImages;
    const time = side === 'left' ? this.compareLeftTime : this.compareRightTime;
    const date = side === 'left' ? this.compareLeftDate : this.compareRightDate;
    
    if (images.length === 0) return;

    const dateStr = this.formatDateToYYYYMMDD(date);
    const timeParts = time.split(':');
    const targetHour = parseInt(timeParts[0] || '0', 10);
    const targetMinute = parseInt(timeParts[1] || '0', 10);
    const targetSecond = parseInt(timeParts[2] || '0', 10);
    const targetTimestamp = `${dateStr}${String(targetHour).padStart(2, '0')}${String(targetMinute).padStart(2, '0')}${String(targetSecond).padStart(2, '0')}`;

    // Find closest timestamp
    let closestTimestamp = images[0];
    let minDiff = Math.abs(parseInt(targetTimestamp) - parseInt(closestTimestamp));

    for (const timestamp of images) {
      const diff = Math.abs(parseInt(targetTimestamp) - parseInt(timestamp));
      if (diff < minDiff) {
        minDiff = diff;
        closestTimestamp = timestamp;
      }
    }

    // Select the closest image
    if (side === 'left') {
      this.selectComparisonImage1(closestTimestamp);
    } else {
      this.selectComparisonImage2(closestTimestamp);
    }
  }

  /**
   * Get image URL for a timestamp (for thumbnail display)
   */
  getCompareImageUrl(timestamp: string): string {
    if (!timestamp) return '';
    // Use stored tags if available, otherwise try to get from camera
    const projectTag = this.currentProjectTag || this.camera?.projectTag || '';
    const developerTag = this.currentDeveloperTag || this.camera?.developerTag || '';
    const cameraTag = this.currentCameraTag || this.camera?.camera || '';
    
    if (!developerTag || !projectTag || !cameraTag) {
      console.warn('Missing tags for image URL:', { developerTag, projectTag, cameraTag });
      return '';
    }
    
    return this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, timestamp);
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: string): string {
    if (timestamp.length === 14) {
      const year = timestamp.slice(0, 4);
      const month = timestamp.slice(4, 6);
      const day = timestamp.slice(6, 8);
      const hour = timestamp.slice(8, 10);
      const minute = timestamp.slice(10, 12);
      const second = timestamp.slice(12, 14);
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    return timestamp;
  }

  /**
   * Get comparison clip path for slider mode
   */
  getComparisonClipPath(): string {
    const percentage = this.comparisonSliderValue;
    return `inset(0 ${100 - percentage}% 0 0)`;
  }

  /**
   * Get rectangle clip path for spot mode
   */
  getRectangleClipPath(): string {
    if (this.rectangleWrapperWidth === 0 || this.rectangleWrapperHeight === 0) {
      this.rectangleWrapperWidth = 1000;
      this.rectangleWrapperHeight = 600;
    }
    
    const x = this.rectangleX;
    const y = this.rectangleY;
    
    const halfWidthPercent = (this.rectangleSize / this.rectangleWrapperWidth) * 50;
    const halfHeightPercent = (this.rectangleSize / this.rectangleWrapperHeight) * 50;
    
    const top = Math.max(0, y - halfHeightPercent);
    const right = Math.max(0, 100 - x - halfWidthPercent);
    const bottom = Math.max(0, 100 - y - halfHeightPercent);
    const left = Math.max(0, x - halfWidthPercent);
    
    return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
  }

  /**
   * Handle comparison slider drag start
   */
  onComparisonDragStart(event: MouseEvent): void {
    const wrapper = (event.currentTarget as HTMLElement);
    const rect = wrapper.getBoundingClientRect();
    
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    this.comparisonSliderValue = Math.max(0, Math.min(100, percentage));
    this.isDraggingComparison = true;
    
    const mouseMoveListener = (moveEvent: MouseEvent) => {
      if (this.isDraggingComparison) {
        const x = moveEvent.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        this.comparisonSliderValue = Math.max(0, Math.min(100, percentage));
      }
    };

    const mouseUpListener = () => {
      this.isDraggingComparison = false;
      window.removeEventListener('mousemove', mouseMoveListener);
      window.removeEventListener('mouseup', mouseUpListener);
    };

    window.addEventListener('mousemove', mouseMoveListener);
    window.addEventListener('mouseup', mouseUpListener);
    
    event.preventDefault();
  }

  /**
   * Handle rectangle drag start for spot mode
   */
  onRectangleDragStart(event: MouseEvent): void {
    event.stopPropagation();
    const rectangle = (event.currentTarget as HTMLElement);
    const wrapper = rectangle.closest('.comparison-image-wrapper') as HTMLElement;
    if (!wrapper) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const rect = rectangle.getBoundingClientRect();
    
    this.rectangleWrapperWidth = wrapperRect.width;
    this.rectangleWrapperHeight = wrapperRect.height;
    
    this.rectangleDragStartX = event.clientX - (rect.left + rect.width / 2);
    this.rectangleDragStartY = event.clientY - (rect.top + rect.height / 2);
    this.isDraggingRectangle = true;

    const mouseMoveListener = (moveEvent: MouseEvent) => {
      if (this.isDraggingRectangle) {
        const newX = moveEvent.clientX - wrapperRect.left - this.rectangleDragStartX;
        const newY = moveEvent.clientY - wrapperRect.top - this.rectangleDragStartY;
        
        const xPercent = (newX / wrapperRect.width) * 100;
        const yPercent = (newY / wrapperRect.height) * 100;
        
        const halfWidthPercent = (this.rectangleSize / wrapperRect.width) * 50;
        const halfHeightPercent = (this.rectangleSize / wrapperRect.height) * 50;
        
        this.rectangleX = Math.max(halfWidthPercent, Math.min(100 - halfWidthPercent, xPercent));
        this.rectangleY = Math.max(halfHeightPercent, Math.min(100 - halfHeightPercent, yPercent));
        
        this.rectangleWrapperWidth = wrapperRect.width;
        this.rectangleWrapperHeight = wrapperRect.height;
      }
    };

    const mouseUpListener = () => {
      this.isDraggingRectangle = false;
      window.removeEventListener('mousemove', mouseMoveListener);
      window.removeEventListener('mouseup', mouseUpListener);
    };

    window.addEventListener('mousemove', mouseMoveListener);
    window.addEventListener('mouseup', mouseUpListener);
    
    event.preventDefault();
  }

  /**
   * Format date for compare display (DD-MMM-YYYY)
   */
  formatDateForCompare(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Format time for compare display (HH:MM:SS)
   */
  formatTimeForCompare(time: string): string {
    return time;
  }

  /**
   * Handle compare date change (when calendar date is selected)
   */
  onCompareDateChange(side: 'left' | 'right', event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      const dateParts = input.value.split('-');
      const newDate = new Date(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[2], 10)
      );
      
      console.log(`Date changed for ${side}:`, input.value, '->', newDate);
      
      // Apply immediately when date is selected
      if (side === 'left') {
        this.compareLeftDate = newDate;
        this.showCompareLeftDatePicker = false;
        this.selectedComparisonImage1 = null;
        this.tempCompareLeftDate = null;
        // Clear existing images before loading new ones
        this.compareLeftImages = [];
        // Show thumbnail strip when left date is selected
        this.showCompareLeftThumbnailStrip = true;
        this.loadCompareImagesForDate('left');
      } else {
        this.compareRightDate = newDate;
        this.showCompareRightDatePicker = false;
        this.selectedComparisonImage2 = null;
        this.tempCompareRightDate = null;
        // Clear existing images before loading new ones
        this.compareRightImages = [];
        // Show thumbnail strip when right date is selected
        this.showCompareRightThumbnailStrip = true;
        this.loadCompareImagesForDate('right');
      }
    }
  }

  /**
   * Handle compare time change (when input value changes)
   */
  onCompareTimeChange(side: 'left' | 'right', event: Event) {
    const input = event.target as HTMLInputElement;
    const time = input.value ? input.value + ':00' : (side === 'left' ? this.compareLeftTime : this.compareRightTime);
    
    // Store temporarily until Apply is clicked
    if (side === 'left') {
      this.tempCompareLeftTime = time;
    } else {
      this.tempCompareRightTime = time;
    }
  }

  /**
   * Apply compare time change
   */
  applyCompareTimeChange(side: 'left' | 'right') {
    if (side === 'left' && this.tempCompareLeftTime !== null) {
      this.compareLeftTime = this.tempCompareLeftTime;
      this.showCompareLeftTimePicker = false;
      this.tempCompareLeftTime = null;
      // Find and select the closest image to the selected time
      this.selectCompareImageByTime('left');
    } else if (side === 'right' && this.tempCompareRightTime !== null) {
      this.compareRightTime = this.tempCompareRightTime;
      this.showCompareRightTimePicker = false;
      this.tempCompareRightTime = null;
      // Find and select the closest image to the selected time
      this.selectCompareImageByTime('right');
    } else {
      // If no temp time, just close
      if (side === 'left') {
        this.showCompareLeftTimePicker = false;
        this.tempCompareLeftTime = null;
      } else {
        this.showCompareRightTimePicker = false;
        this.tempCompareRightTime = null;
      }
    }
  }

  /**
   * Cancel compare time change
   */
  cancelCompareTimeChange(side: 'left' | 'right') {
    if (side === 'left') {
      this.showCompareLeftTimePicker = false;
      this.tempCompareLeftTime = null;
    } else {
      this.showCompareRightTimePicker = false;
      this.tempCompareRightTime = null;
    }
  }

  /**
   * Toggle compare date picker (inline calendar)
   */
  toggleCompareDatePicker(side: 'left' | 'right', event: Event) {
    event.stopPropagation();
    
    // Close the other picker if open
    if (side === 'left') {
      this.showCompareRightDatePicker = false;
      this.showCompareLeftDatePicker = !this.showCompareLeftDatePicker;
      if (this.showCompareLeftDatePicker) {
        this.tempCompareLeftDate = new Date(this.compareLeftDate);
      }
    } else {
      this.showCompareLeftDatePicker = false;
      this.showCompareRightDatePicker = !this.showCompareRightDatePicker;
      if (this.showCompareRightDatePicker) {
        this.tempCompareRightDate = new Date(this.compareRightDate);
      }
    }
  }

  /**
   * Toggle compare time picker (inline time input)
   */
  toggleCompareTimePicker(side: 'left' | 'right', event: Event) {
    event.stopPropagation();
    
    // Close the other picker if open
    if (side === 'left') {
      this.showCompareRightTimePicker = false;
      this.showCompareLeftTimePicker = !this.showCompareLeftTimePicker;
      if (this.showCompareLeftTimePicker) {
        this.tempCompareLeftTime = this.compareLeftTime;
      }
    } else {
      this.showCompareLeftTimePicker = false;
      this.showCompareRightTimePicker = !this.showCompareRightTimePicker;
      if (this.showCompareRightTimePicker) {
        this.tempCompareRightTime = this.compareRightTime;
      }
    }
  }

  /**
   * Get date input value for compare date picker
   */
  getCompareDateInputValue(side: 'left' | 'right'): string {
    const date = side === 'left' ? this.compareLeftDate : this.compareRightDate;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ==================== STUDIO MODAL METHODS ====================

  /**
   * Open studio modal
   */
  openStudioModal() {
    // Initialize with current image timestamp
    if (this.images.length > 0 && this.imageTimestamps.length > 0) {
      const currentTimestamp = this.imageTimestamps[this.currentImageIndex];
      if (currentTimestamp && currentTimestamp.length >= 8) {
        const year = parseInt(currentTimestamp.substring(0, 4), 10);
        const month = parseInt(currentTimestamp.substring(4, 6), 10) - 1;
        const day = parseInt(currentTimestamp.substring(6, 8), 10);
        const hour = currentTimestamp.length >= 10 ? parseInt(currentTimestamp.substring(8, 10), 10) : 0;
        const minute = currentTimestamp.length >= 12 ? parseInt(currentTimestamp.substring(10, 12), 10) : 0;
        const second = currentTimestamp.length >= 14 ? parseInt(currentTimestamp.substring(12, 14), 10) : 0;
        
        this.studioDate = new Date(year, month, day);
        this.studioTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        this.studioImageTimestamp = currentTimestamp;
      }
    }
    
    // Load current image
    if (this.images.length > 0) {
      this.studioImage = this.images[this.currentImageIndex];
    }
    
    this.studioTool = null;
    this.showStudioModal = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close studio modal
   */
  closeStudioModal(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.showStudioModal = false;
    document.body.style.overflow = '';
  }

  /**
   * Handle studio date change
   */
  onStudioDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      const dateParts = input.value.split('-');
      const newDate = new Date(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[2], 10)
      );
      this.studioDate = newDate;
      this.showStudioDatePicker = false;
      this.loadStudioImage();
    }
  }

  /**
   * Handle studio time change
   */
  onStudioTimeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const time = input.value ? input.value + ':00' : this.studioTime;
    this.studioTime = time;
    this.showStudioTimePicker = false;
    this.loadStudioImage();
  }

  /**
   * Load studio image based on selected date/time
   */
  loadStudioImage() {
    if (!this.camera) return;

    const dateStr = this.formatDateToYYYYMMDD(this.studioDate);
    const timeParts = this.studioTime.split(':');
    const targetHour = parseInt(timeParts[0] || '0', 10);
    const targetMinute = parseInt(timeParts[1] || '0', 10);
    const targetSecond = parseInt(timeParts[2] || '0', 10);
    const targetTimestamp = `${dateStr}${String(targetHour).padStart(2, '0')}${String(targetMinute).padStart(2, '0')}${String(targetSecond).padStart(2, '0')}`;

    forkJoin({
      project: this.projectsService.getProjectById(this.camera.project!),
      developer: this.http.get<any>(`${API_CONFIG.baseUrl}/api/developers/${this.camera.developer}`)
    }).subscribe({
      next: ({ project, developer }) => {
        const projectTag = project.projectTag || '';
        const developerTag = developer.developerTag || '';
        const cameraTag = this.camera!.camera || '';

        if (developerTag && projectTag && cameraTag) {
          const url = `${API_CONFIG.baseUrl}/api/camerapics-s3-test/${developerTag}/${projectTag}/${cameraTag}/pictures/`;
          
          this.http.post<any>(url, { date1: dateStr, date2: dateStr }).subscribe({
            next: (response) => {
              const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
              
              if (allPhotos.length > 0) {
                // Find closest timestamp to target
                let closestTimestamp = allPhotos[0];
                let minDiff = Math.abs(parseInt(targetTimestamp) - parseInt(closestTimestamp));
                
                for (const timestamp of allPhotos) {
                  const diff = Math.abs(parseInt(targetTimestamp) - parseInt(timestamp));
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestTimestamp = timestamp;
                  }
                }
                
                // Load the closest image
                const imageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, closestTimestamp);
                this.studioImage = imageUrl;
                this.studioImageTimestamp = closestTimestamp;
              }
            },
            error: (err) => {
              console.error('Error loading studio image:', err);
            }
          });
        }
      },
      error: (err) => {
        console.error('Error loading project or developer for studio:', err);
      }
    });
  }

  /**
   * Get studio date input value
   */
  getStudioDateInputValue(): string {
    const year = this.studioDate.getFullYear();
    const month = String(this.studioDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.studioDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Set studio tool
   */
  setStudioTool(tool: 'crop' | 'text' | 'box' | 'circle' | 'arrow' | 'image' | 'effect' | null) {
    this.studioTool = tool;
  }

  /**
   * Clear all studio edits
   */
  clearStudioAll() {
    this.studioTool = null;
    this.studioHistory = [];
    this.studioHistoryIndex = -1;
    // Add logic to clear all edits when implemented
  }

  /**
   * Undo studio action
   */
  undoStudioAction() {
    if (this.studioHistoryIndex > 0) {
      this.studioHistoryIndex--;
      // Apply the previous state
      // This will be implemented when editing functionality is added
    }
  }

  /**
   * Redo studio action
   */
  redoStudioAction() {
    if (this.studioHistoryIndex < this.studioHistory.length - 1) {
      this.studioHistoryIndex++;
      // Apply the next state
      // This will be implemented when editing functionality is added
    }
  }

  /**
   * Share studio image
   */
  shareStudioImage() {
    // Add share functionality when implemented
    console.log('Share studio image');
  }

  /**
   * Download studio image
   */
  downloadStudioImage() {
    if (this.studioImage) {
      const link = document.createElement('a');
      link.href = this.studioImage;
      link.download = `studio-image-${this.studioImageTimestamp || Date.now()}.jpg`;
      link.click();
    }
  }

  /**
   * Toggle compare left thumbnail strip
   */
  toggleCompareLeftThumbnailStrip(event: Event) {
    event.stopPropagation();
    this.showCompareLeftThumbnailStrip = !this.showCompareLeftThumbnailStrip;
  }

  /**
   * Close compare left thumbnail strip
   */
  closeCompareLeftThumbnailStrip() {
    this.showCompareLeftThumbnailStrip = false;
  }

  /**
   * Toggle compare right thumbnail strip
   */
  toggleCompareRightThumbnailStrip(event: Event) {
    event.stopPropagation();
    this.showCompareRightThumbnailStrip = !this.showCompareRightThumbnailStrip;
  }

  /**
   * Close compare right thumbnail strip
   */
  closeCompareRightThumbnailStrip() {
    this.showCompareRightThumbnailStrip = false;
  }

  /**
   * Close date/time pickers and thumbnail strip when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Close date/time pickers if clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('.compare-date-picker-part') && 
        !target.closest('.compare-time-picker-part') &&
        !target.closest('.compare-calendar-dropdown') &&
        !target.closest('.compare-time-dropdown')) {
      this.showCompareLeftDatePicker = false;
      this.showCompareRightDatePicker = false;
      this.showCompareLeftTimePicker = false;
      this.showCompareRightTimePicker = false;
    }
    
    // Close thumbnail strips if clicking outside
    if (!target.closest('.compare-slider-btn') && 
        !target.closest('.compare-thumbnail-strip')) {
      this.showCompareLeftThumbnailStrip = false;
      this.showCompareRightThumbnailStrip = false;
    }
  }
}
