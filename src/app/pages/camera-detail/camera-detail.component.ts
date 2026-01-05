import { Component, OnInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
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
export class CameraDetailComponent implements OnInit, AfterViewChecked {
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
    }
  }

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
}
