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
import { AuthService } from '../../services/auth.service';
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
  @ViewChild('thumbnailStripContainer', { static: false }) thumbnailStripContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('studioCanvas', { static: false }) studioCanvasRef!: ElementRef<HTMLCanvasElement>;
  
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
  showMainDatePicker = false;
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
  videoToDate: Date = new Date();
  videoFromHour: number = 0;
  videoToHour: number = 23;
  videoResolution: string = '720';
  videoDuration: string = '1 Minute';
  showDateInVideo: boolean = false;
  showTimeInVideo: boolean = true;
  videoOverlayType: 'text' | 'logo' | 'watermark' | null = null;
  videoTextOverlay: string = '';
  videoLogoFile: File | null = null;
  videoWatermarkFile: File | null = null;
  videoWatermarkSize: number = 1.0;
  videoWatermarkTransparency: number = 0.5;
  videoBrightness: number = 42;
  videoContrast: number = 42;
  videoSaturation: number = 42;
  isGeneratingVideo: boolean = false;
  videoGenerationError: string | null = null;
  videoGenerationSuccess: string | null = null;
  showVideoFromDatePicker: boolean = false;
  showVideoToDatePicker: boolean = false;
  showVideoFromTimePicker: boolean = false;
  showVideoToTimePicker: boolean = false;

  // Photo Generation Modal
  showPhotoGenerationModal = false;
  photoFromDate: string = ''; // YYYY-MM-DD format
  photoToDate: string = ''; // YYYY-MM-DD format
  photoHour1: number = 8;
  photoHour2: number = 9;
  showDateInPhoto: boolean = false;
  showTimeInPhoto: boolean = false;
  photoFirstDate: string = ''; // First available photo date
  photoLastDate: string = ''; // Last available photo date
  isGeneratingPhoto: boolean = false;
  photoGenerationError: string | null = null;
  photoGenerationSuccess: boolean = false;
  filteredPicsCount: number = 0;

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
  studioTool: 'text' | 'box' | 'circle' | 'arrow' | 'image' | 'effect' | null = null;
  showStudioDatePicker = false;
  showStudioTimePicker = false;
  studioHistory: string[] = []; // Canvas states for undo/redo
  studioHistoryIndex: number = -1;
  
  // Canvas drawing state
  isDrawing = false;
  startX = 0;
  startY = 0;
  currentShape: any = null;
  studioShapes: any[] = []; // Store all drawn shapes
  studioTexts: any[] = []; // Store all text elements
  
  // Tool properties
  studioStrokeColor = '#000000';
  studioFillColor = '#ffffff';
  studioStrokeWidth = 2;
  studioFontSize = 16;
  studioFontFamily = 'Arial';
  studioTextValue = '';
  studioTextColor = '#000000';
  
  // Text editing state
  selectedTextIndex: number | null = null;
  showTextInputModal = false; // Keep for easy reversion
  pendingTextX = 0;
  pendingTextY = 0;
  newTextValue = '';
  useInlineTextInput = false; // Toggle between modal and inline
  textControllerPosition: { x: number; y: number } | null = null;
  isDraggingText = false;
  textDragOffsetX = 0;
  textDragOffsetY = 0;
  
  // Canvas context
  studioCanvasContext: CanvasRenderingContext2D | null = null;
  studioCanvasReady = false; // Flag to track if canvas is ready

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private camerasService: CamerasService,
    private cameraPicsService: CameraPicsService,
    private projectsService: ProjectsService,
    private authService: AuthService
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

    // Check cache first
    const cacheService = (this.cameraPicsService as any).cacheService;
    if (cacheService) {
      const cached = cacheService.getDateImages(developerTag, projectTag, cameraTag, todayStr);
      if (cached) {
        console.log('Loading today images from cache');
        const sortedPhotos = cached.timestamps.sort((a: string, b: string) => b.localeCompare(a));
        this.imageTimestamps = sortedPhotos;
        this.loadingProgress = 100;
        this.images = cached.imageUrls;
        this.isLoading = false;
        return;
      }
    }

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
    // Check cache first - use the cache service from CameraPicsService
    const cached = this.cameraPicsService['cacheService']?.getDateImages(developerTag, projectTag, cameraTag, dateStr);
    if (cached) {
      console.log(`Loading images for ${dateStr} from cache`);
      const sortedPhotos = cached.timestamps.sort((a, b) => b.localeCompare(a));
      this.imageTimestamps = sortedPhotos;
      this.loadingProgress = 100;
      this.images = cached.imageUrls;
      this.isLoading = false;
      return;
    }

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

  toggleMainDatePicker(event: Event): void {
    event.stopPropagation();
    this.showMainDatePicker = !this.showMainDatePicker;
  }

  onMainDateChange(event: Event): void {
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
      this.showMainDatePicker = false;
      
      // Show thumbnail strip when date is selected
      this.showThumbnailStrip = true;
      
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

  getCurrentImageTime(): string {
    if (this.imageTimestamps && this.imageTimestamps.length > 0 && 
        this.currentImageIndex >= 0 && 
        this.currentImageIndex < this.imageTimestamps.length) {
      const timestamp = this.imageTimestamps[this.currentImageIndex];
      if (timestamp) {
        return this.formatTimestampToTime(timestamp);
      }
    }
    return 'Slider';
  }

  getCompareLeftImageTime(): string {
    if (this.selectedComparisonImage1) {
      return this.formatTimestampToTime(this.selectedComparisonImage1);
    }
    return 'Slider';
  }

  getCompareRightImageTime(): string {
    if (this.selectedComparisonImage2) {
      return this.formatTimestampToTime(this.selectedComparisonImage2);
    }
    return 'Slider';
  }

  /**
   * Open video generation modal
   */
  openVideoGenerationModal() {
    // Initialize with current date/time
    this.videoFromDate = new Date();
    this.videoToDate = new Date();
    this.videoFromHour = 0;
    this.videoToHour = 23;
    this.showVideoFromDatePicker = false;
    this.showVideoToDatePicker = false;
    this.videoOverlayType = null;
    this.videoTextOverlay = '';
    this.videoLogoFile = null;
    this.videoWatermarkFile = null;
    this.videoWatermarkSize = 1.0;
    this.videoWatermarkTransparency = 0.5;
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
   * Get date input value for video date picker (YYYY-MM-DD format)
   */
  getVideoDateInputValue(type: 'from' | 'to'): string {
    const date = type === 'from' ? this.videoFromDate : this.videoToDate;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }


  /**
   * Toggle video date picker
   */
  toggleVideoDatePicker(type: 'from' | 'to', event: Event) {
    event.stopPropagation();
    if (type === 'from') {
      this.showVideoFromDatePicker = !this.showVideoFromDatePicker;
      this.showVideoToDatePicker = false;
      this.showVideoFromTimePicker = false;
      this.showVideoToTimePicker = false;
    } else {
      this.showVideoToDatePicker = !this.showVideoToDatePicker;
      this.showVideoFromDatePicker = false;
      this.showVideoFromTimePicker = false;
      this.showVideoToTimePicker = false;
    }
  }

  /**
   * Toggle video time picker
   */
  toggleVideoTimePicker(type: 'from' | 'to', event: Event) {
    event.stopPropagation();
    if (type === 'from') {
      this.showVideoFromTimePicker = !this.showVideoFromTimePicker;
      this.showVideoToTimePicker = false;
      this.showVideoFromDatePicker = false;
      this.showVideoToDatePicker = false;
    } else {
      this.showVideoToTimePicker = !this.showVideoToTimePicker;
      this.showVideoFromTimePicker = false;
      this.showVideoFromDatePicker = false;
      this.showVideoToDatePicker = false;
    }
  }

  /**
   * Handle video date change
   */
  onVideoDateChange(type: 'from' | 'to', event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      const dateParts = input.value.split('-');
      const newDate = new Date(
        parseInt(dateParts[0], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[2], 10)
      );
      if (type === 'from') {
        this.videoFromDate = newDate;
        this.showVideoFromDatePicker = false;
      } else {
        this.videoToDate = newDate;
        this.showVideoToDatePicker = false;
      }
    }
  }

  /**
   * Prevent manual input in hour fields (only allow arrow keys)
   */
  preventManualHourInput(event: KeyboardEvent): void {
    const allowedKeys = ['ArrowUp', 'ArrowDown', 'Tab', 'Backspace', 'Delete'];
    if (!allowedKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  /**
   * Increment video hour
   */
  incrementVideoHour(type: 'from' | 'to'): void {
    if (type === 'from') {
      if (this.videoFromHour < 22) {
        this.videoFromHour++;
        this.videoToHour = Math.max(this.videoToHour, this.videoFromHour + 1);
      }
    } else {
      if (this.videoToHour < 23) {
        this.videoToHour++;
      }
    }
  }

  /**
   * Decrement video hour
   */
  decrementVideoHour(type: 'from' | 'to'): void {
    if (type === 'from') {
      if (this.videoFromHour > 0) {
        this.videoFromHour--;
        if (this.videoToHour <= this.videoFromHour) {
          this.videoToHour = this.videoFromHour + 1;
        }
      }
    } else {
      if (this.videoToHour > this.videoFromHour + 1) {
        this.videoToHour--;
      }
    }
  }

  /**
   * Handle logo file selection
   */
  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.videoLogoFile = input.files[0];
    }
  }

  /**
   * Handle logo drag and drop
   */
  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.videoLogoFile = event.dataTransfer.files[0];
    }
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Handle watermark file selection
   */
  onWatermarkFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.videoWatermarkFile = input.files[0];
    }
  }

  /**
   * Handle watermark drag and drop
   */
  onWatermarkDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onWatermarkDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.videoWatermarkFile = event.dataTransfer.files[0];
    }
  }

  onWatermarkDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  /**
   * Handle logo done button
   */
  onLogoDone(): void {
    // Logo is ready, can close overlay section or keep it open
    // User can change overlay type or proceed to generate
  }

  /**
   * Handle watermark done button
   */
  onWatermarkDone(): void {
    // Watermark is ready, can close overlay section or keep it open
    // User can change overlay type or proceed to generate
  }

  /**
   * Generate video with current settings
   */
  generateVideo() {
    if (!this.camera || !this.currentDeveloperTag || !this.currentProjectTag || !this.currentCameraTag) {
      this.videoGenerationError = 'Camera information is missing. Please refresh the page.';
      return;
    }

    // Reset error and success messages
    this.videoGenerationError = null;
    this.videoGenerationSuccess = null;
    this.isGeneratingVideo = true;

    // Get user info from AuthService
    const user = this.authService.getUser();
    const userId = user?._id || '';
    const userName = user?.name || user?.email || '';

    // Format dates as YYYYMMDD
    const formatDateToYYYYMMDD = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    // Format time as HH (from HH:MM:SS format) - backend expects just the hour
    const formatTimeToHH = (time: string): string => {
      // Extract hour from HH:MM:SS or HH:MM format
      const parts = time.split(':');
      if (parts.length > 0) {
        const hour = parts[0].padStart(2, '0');
        return hour;
      }
      return '00';
    };

    // Convert duration from "X Minute(s)" to seconds
    const parseDurationToSeconds = (duration: string): number => {
      const match = duration.match(/(\d+)\s*(minute|min|second|sec)/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (unit.startsWith('min')) {
          return value * 60;
        } else if (unit.startsWith('sec')) {
          return value;
        }
      }
      return 60; // Default to 1 minute
    };

    // Convert brightness/contrast/saturation from 0-100 scale to backend format
    // Backend expects strings like "1.0", "0.0", "-1.0" etc.
    // Assuming 0-100 maps to -1.0 to 1.0 (50 = 0.0)
    const convertToBackendValue = (value: number): string => {
      // Convert from 0-100 scale to -1.0 to 1.0 scale
      const normalized = ((value - 50) / 50).toFixed(1);
      return normalized;
    };

    const date1 = formatDateToYYYYMMDD(this.videoFromDate);
    const date2 = formatDateToYYYYMMDD(this.videoToDate);
    const hour1 = String(this.videoFromHour).padStart(2, '0');
    const hour2 = String(this.videoToHour).padStart(2, '0');
    const duration = parseDurationToSeconds(this.videoDuration);
    const showdate = this.showDateInVideo || this.showTimeInVideo; // Show date if either is enabled
    const showedText = this.videoOverlayType === 'text' ? this.videoTextOverlay : '';
    const resolution = this.videoResolution;
    const contrast = convertToBackendValue(this.videoContrast);
    const brightness = convertToBackendValue(this.videoBrightness);
    const saturation = convertToBackendValue(this.videoSaturation);

    // Create FormData for file uploads (logo and watermark)
    const formData = new FormData();
    formData.append('developerId', this.currentDeveloperTag);
    formData.append('projectId', this.currentProjectTag);
    formData.append('cameraId', this.currentCameraTag);
    formData.append('date1', date1);
    formData.append('date2', date2);
    formData.append('hour1', hour1);
    formData.append('hour2', hour2);
    formData.append('duration', duration.toString());
    formData.append('showdate', showdate.toString());
    formData.append('showedText', showedText);
    formData.append('resolution', resolution);
    formData.append('music', 'false');
    formData.append('musicFile', '');
    formData.append('contrast', contrast);
    formData.append('brightness', brightness);
    formData.append('saturation', saturation);
    formData.append('userId', userId);
    formData.append('userName', userName);

    // Add logo and watermark file uploads
    if (this.videoOverlayType === 'logo' && this.videoLogoFile) {
      formData.append('logo', this.videoLogoFile);
    }
    if (this.videoOverlayType === 'watermark' && this.videoWatermarkFile) {
      formData.append('showedWatermark', this.videoWatermarkFile);
    }

    // Get auth token
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Make API call
    const url = `${API_CONFIG.baseUrl}/api/video/videoGen`;
    this.http.post<any>(url, formData, { headers }).subscribe({
      next: (response) => {
        this.isGeneratingVideo = false;
        this.videoGenerationSuccess = `Video generation started successfully! ${response.filteredImageCount || 0} images will be processed.`;
        console.log('Video generation response:', response);
        
        // Close modal after a short delay
        setTimeout(() => {
          this.closeVideoGenerationModal();
          // Clear success message after closing
          setTimeout(() => {
            this.videoGenerationSuccess = null;
          }, 3000);
        }, 2000);
      },
      error: (error) => {
        this.isGeneratingVideo = false;
        this.videoGenerationError = error.error?.error || error.error?.message || error.message || 'Failed to generate video. Please try again.';
        console.error('Error generating video:', error);
      }
    });
  }

  /**
   * Open photo generation modal
   */
  openPhotoGenerationModal() {
    this.showPhotoGenerationModal = true;
    document.body.style.overflow = 'hidden';
    this.photoGenerationError = null;
    this.photoGenerationSuccess = false;
    this.setDefaultPhotoDates();
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
    this.photoGenerationError = null;
    this.photoGenerationSuccess = false;
  }

  /**
   * Set default dates for photo generation (first day of last month to last day of last month)
   */
  private setDefaultPhotoDates() {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    this.photoFromDate = this.formatDateForInput(firstDayLastMonth);
    this.photoToDate = this.formatDateForInput(lastDayLastMonth);
    
    // Get first and last photo dates from camera
    if (this.camera && this.imageTimestamps.length > 0) {
      const firstTimestamp = this.imageTimestamps[this.imageTimestamps.length - 1]; // Oldest (last in array)
      const lastTimestamp = this.imageTimestamps[0]; // Newest (first in array)
      
      if (firstTimestamp && firstTimestamp.length >= 8) {
        this.photoFirstDate = this.timestampToDateString(firstTimestamp);
      }
      if (lastTimestamp && lastTimestamp.length >= 8) {
        this.photoLastDate = this.timestampToDateString(lastTimestamp);
      }
    }
  }

  /**
   * Format date for input (YYYY-MM-DD)
   */
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert timestamp (YYYYMMDDHHMMSS) to date string (YYYY-MM-DD)
   */
  private timestampToDateString(timestamp: string): string {
    if (!timestamp || timestamp.length < 8) return '';
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  /**
   * Handle start date change - auto-adjust end date to one month later or last date
   */
  onPhotoStartDateChange() {
    if (!this.photoFromDate) return;
    
    const startDateObj = new Date(this.photoFromDate);
    const nextMonthDate = new Date(startDateObj);
    nextMonthDate.setMonth(startDateObj.getMonth() + 1);
    
    const formattedNextMonthDate = this.formatDateForInput(nextMonthDate);
    
    // Set endDate to nextMonthDate or lastDate, whichever is earlier
    if (this.photoLastDate && new Date(formattedNextMonthDate) > new Date(this.photoLastDate)) {
      this.photoToDate = this.photoLastDate;
    } else {
      this.photoToDate = formattedNextMonthDate;
    }
  }

  /**
   * Increment hour
   */
  incrementPhotoHour(fieldName: 'photoHour1' | 'photoHour2') {
    if (fieldName === 'photoHour1' && this.photoHour1 < 22) {
      this.photoHour1++;
      this.photoHour2 = Math.max(this.photoHour2, this.photoHour1 + 1);
    } else if (fieldName === 'photoHour2' && this.photoHour2 < 23) {
      this.photoHour2++;
    }
  }

  /**
   * Decrement hour
   */
  decrementPhotoHour(fieldName: 'photoHour1' | 'photoHour2') {
    if (fieldName === 'photoHour1' && this.photoHour1 > 0) {
      this.photoHour1--;
      if (this.photoHour2 <= this.photoHour1) {
        this.photoHour2 = this.photoHour1 + 1;
      }
    } else if (fieldName === 'photoHour2' && this.photoHour2 > this.photoHour1 + 1) {
      this.photoHour2--;
    }
  }

  /**
   * Prevent manual input in hour fields
   */
  preventPhotoHourInput(event: KeyboardEvent) {
    const allowedKeys = ['ArrowUp', 'ArrowDown', 'Tab', 'Backspace', 'Delete'];
    if (!allowedKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  /**
   * Format date for API (YYYYMMDD)
   */
  private formatDateForPhotoAPI(dateString: string): string {
    return dateString.replace(/-/g, '');
  }

  /**
   * Generate photo with current settings
   */
  generatePhoto() {
    if (!this.camera || !this.currentProjectTag || !this.currentDeveloperTag) {
      this.photoGenerationError = 'Camera information is missing';
      return;
    }

    // Get user info from AuthService
    const user = this.authService.getUser();
    
    if (!user) {
      this.photoGenerationError = 'User not authenticated. Please login again.';
      return;
    }

    // Check role and permissions
    const role = user.role || '';
    const permission = (user as any).canGenerateVideoAndPics || false;
    const hasAccess = role === 'Super Admin' || role === 'Admin' || permission;

    if (!hasAccess) {
      this.photoGenerationError = 'You don\'t have permission to generate photos. Contact your admin.';
      return;
    }

    this.isGeneratingPhoto = true;
    this.photoGenerationError = null;
    this.photoGenerationSuccess = false;
    const userId = user?._id || '';
    const userName = user?.name || '';

    const formData = new FormData();
    formData.append('developerId', this.currentDeveloperTag);
    formData.append('projectId', this.currentProjectTag);
    formData.append('cameraId', this.camera.camera || this.camera.name);
    formData.append('date1', this.formatDateForPhotoAPI(this.photoFromDate));
    formData.append('date2', this.formatDateForPhotoAPI(this.photoToDate));
    formData.append('hour1', this.photoHour1.toString().padStart(2, '0'));
    formData.append('hour2', this.photoHour2.toString().padStart(2, '0'));
    formData.append('userId', userId);
    formData.append('userName', userName);

    this.http.post<{ message: string; filteredImageCount: number }>(`${API_CONFIG.baseUrl}/api/video/photoGen`, formData).subscribe({
      next: (response) => {
        this.isGeneratingPhoto = false;
        this.photoGenerationSuccess = true;
        this.filteredPicsCount = response.filteredImageCount;
      },
      error: (error) => {
        this.isGeneratingPhoto = false;
        this.photoGenerationError = error.error?.error || 'Failed to generate photo request. Please try again.';
        console.error('Photo generation error:', error);
      }
    });
  }

  /**
   * Toggle thumbnail strip visibility
   */
  toggleThumbnailStrip(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showThumbnailStrip = !this.showThumbnailStrip;
    if (this.showThumbnailStrip) {
      // Calculate max scroll when strip is shown
      setTimeout(() => {
        this.updateThumbnailScroll();
      }, 100);
      // Add click outside listener (use capture phase to catch events before stopPropagation)
      setTimeout(() => {
        document.addEventListener('click', this.handleClickOutsideThumbnailStrip, true);
      }, 100);
    } else {
      // Remove click outside listener
      document.removeEventListener('click', this.handleClickOutsideThumbnailStrip, true);
    }
  }

  /**
   * Close thumbnail strip
   */
  closeThumbnailStrip() {
    this.showThumbnailStrip = false;
    document.removeEventListener('click', this.handleClickOutsideThumbnailStrip, true);
  }

  /**
   * Handle click outside thumbnail strip
   */
  private handleClickOutsideThumbnailStrip = (event: MouseEvent) => {
    if (!this.showThumbnailStrip) {
      return; // Strip is already closed
    }

    const target = event.target as HTMLElement;
    if (!target) {
      return;
    }

    // Check if click is inside thumbnail strip container using ViewChild
    if (this.thumbnailStripContainerRef?.nativeElement?.contains(target)) {
      return; // Click is inside the strip, don't close
    }
    
    // Fallback: check using querySelector
    const stripContainer = document.querySelector('.thumbnail-strip-container');
    if (stripContainer && stripContainer.contains(target)) {
      return; // Click is inside the strip, don't close
    }
    
    // Check if click is on the slider button that toggles the strip
    if (target.closest('.main-slider-btn')) {
      return; // Click is on the toggle button, let toggleThumbnailStrip handle it
    }
    
    // Check if click is on date picker elements
    if (target.closest('.new-date-picker-wrapper') || 
        target.closest('.main-calendar-dropdown') ||
        target.closest('.new-date-picker-button')) {
      return; // Click is on date picker, don't close
    }
    
    // Click is outside strip, button, and date picker - close the strip
    this.closeThumbnailStrip();
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
    // Clip from right: when slider moves left, show more of left image (image1)
    // When slider is at 0% (left), clip 100% from right (show all of image1 - left image)
    // When slider is at 100% (right), clip 0% from right (show all of image2 - right image)
    // Moving slider left → percentage decreases → clip amount increases → more of left image shows
    // Moving slider right → percentage increases → clip amount decreases → more of right image shows
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
    // Clear previous studio state
    this.studioShapes = [];
    this.studioTexts = [];
    this.studioHistory = [];
    this.studioHistoryIndex = -1;
    
    // Get current tags
    const developerTag = this.currentDeveloperTag;
    const projectTag = this.currentProjectTag;
    const cameraTag = this.currentCameraTag;
    
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
        
        // Load image using presigned URL (more reliable than proxy)
        this.cameraPicsService.getImagePresignedUrl(developerTag, projectTag, cameraTag, currentTimestamp).subscribe({
          next: (presignedUrl) => {
            if (presignedUrl) {
              this.studioImage = presignedUrl;
              console.log('Studio image loaded from presigned URL:', presignedUrl);
              this.studioTool = null;
              this.showStudioModal = true;
              document.body.style.overflow = 'hidden';
              
              // Initialize canvas after view is ready and image is set
              setTimeout(() => {
                this.initStudioCanvas();
              }, 300);
            } else {
              // Fallback to proxy URL
              console.warn('Presigned URL is empty, falling back to proxy URL');
              this.studioImage = this.images[this.currentImageIndex];
              this.studioTool = null;
              this.showStudioModal = true;
              document.body.style.overflow = 'hidden';
              setTimeout(() => {
                this.initStudioCanvas();
              }, 300);
            }
          },
          error: (err) => {
            console.error('Error getting presigned URL for studio, falling back to proxy URL:', err);
            // Fallback to proxy URL
            this.studioImage = this.images[this.currentImageIndex];
            this.studioTool = null;
            this.showStudioModal = true;
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
              this.initStudioCanvas();
            }, 300);
          }
        });
        return; // Exit early since we're handling async loading
      }
    }
    
    // Fallback: Load current image immediately if no timestamp available
    if (this.images.length > 0 && this.currentImageIndex >= 0 && this.currentImageIndex < this.images.length) {
      this.studioImage = this.images[this.currentImageIndex];
    }
    
    this.studioTool = null;
    this.showStudioModal = true;
    document.body.style.overflow = 'hidden';
    
    // Initialize canvas after view is ready and image is set
    setTimeout(() => {
      this.initStudioCanvas();
    }, 300);
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
    // Clear existing shapes when loading new image
    this.studioShapes = [];
    this.studioTexts = [];
    this.studioHistory = [];
    this.studioHistoryIndex = -1;
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
                
                // Load the closest image using presigned URL endpoint (more reliable)
                this.cameraPicsService.getImagePresignedUrl(developerTag, projectTag, cameraTag, closestTimestamp).subscribe({
                  next: (presignedUrl) => {
                    if (presignedUrl) {
                      this.studioImage = presignedUrl;
                      this.studioImageTimestamp = closestTimestamp;
                      console.log('Loading studio image from presigned URL:', presignedUrl);
                      console.log('Using timestamp:', closestTimestamp);
                      // Reinitialize canvas with new image
                      setTimeout(() => {
                        this.initStudioCanvas();
                      }, 100);
                    } else {
                      console.warn('Presigned URL is empty, falling back to proxy URL');
                      // Fallback to proxy URL
                      const imageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, closestTimestamp);
                      this.studioImage = imageUrl;
                      this.studioImageTimestamp = closestTimestamp;
                      setTimeout(() => {
                        this.initStudioCanvas();
                      }, 100);
                    }
                  },
                  error: (err) => {
                    console.error('Error getting presigned URL, falling back to proxy URL:', err);
                    // Fallback to proxy URL
                    const imageUrl = this.cameraPicsService.getProxiedImageUrl(developerTag, projectTag, cameraTag, closestTimestamp);
                    this.studioImage = imageUrl;
                    this.studioImageTimestamp = closestTimestamp;
                    setTimeout(() => {
                      this.initStudioCanvas();
                    }, 100);
                  }
                });
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
  setStudioTool(tool: 'text' | 'box' | 'circle' | 'arrow' | 'image' | 'effect' | null) {
    this.studioTool = tool;
    // Clear selection when switching tools
    this.selectedTextIndex = null;
  }

  /**
   * Clear all studio edits
   */
  clearStudioAll() {
    this.studioShapes = [];
    this.studioTexts = [];
    this.studioTool = null;
    this.studioHistory = [];
    this.studioHistoryIndex = -1;
    this.redrawStudioCanvas();
    this.saveStudioState();
  }

  /**
   * Undo studio action
   */
  undoStudioAction() {
    if (this.studioHistoryIndex > 0 && this.studioHistory.length > 0) {
      this.studioHistoryIndex--;
      this.restoreStudioState();
    }
  }

  /**
   * Redo studio action
   */
  redoStudioAction() {
    if (this.studioHistoryIndex < this.studioHistory.length - 1) {
      this.studioHistoryIndex++;
      this.restoreStudioState();
    }
  }

  /**
   * Restore canvas state from history
   */
  restoreStudioState() {
    if (!this.studioCanvasRef?.nativeElement || !this.studioCanvasContext) return;
    if (this.studioHistoryIndex < 0 || this.studioHistoryIndex >= this.studioHistory.length) return;
    
    const canvas = this.studioCanvasRef.nativeElement;
    const ctx = this.studioCanvasContext;
    const state = this.studioHistory[this.studioHistoryIndex];
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = state;
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
    if (this.studioCanvasRef?.nativeElement) {
      const canvas = this.studioCanvasRef.nativeElement;
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `studio-image-${this.studioImageTimestamp || Date.now()}.jpg`;
          link.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.95);
    } else if (this.studioImage) {
      const link = document.createElement('a');
      link.href = this.studioImage;
      link.download = `studio-image-${this.studioImageTimestamp || Date.now()}.jpg`;
      link.click();
    }
  }

  /**
   * Initialize studio canvas
   */
  initStudioCanvas() {
    if (!this.studioImage) {
      console.warn('Studio image not set');
      return;
    }
    
    // Try to find canvas element - it might not be in ViewChild yet due to *ngIf
    let canvas: HTMLCanvasElement | null = null;
    
    if (this.studioCanvasRef?.nativeElement) {
      canvas = this.studioCanvasRef.nativeElement;
    } else {
      // Try to find canvas in DOM directly
      const canvasElement = document.querySelector('.studio-canvas-element') as HTMLCanvasElement;
      if (canvasElement) {
        canvas = canvasElement;
      }
    }
    
    if (!canvas) {
      // Retry if canvas not ready yet
      if (this.showStudioModal) {
        setTimeout(() => {
          this.initStudioCanvas();
        }, 100);
      }
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2d context from canvas');
      return;
    }
    
    this.studioCanvasContext = ctx;
    
    // Load image and draw on canvas
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      if (!canvas || !ctx) {
        console.error('Canvas or context is null when image loaded');
        return;
      }
      
      console.log('Studio image loaded:', img.width, 'x', img.height);
      
      // Get container dimensions for proper scaling - use setTimeout to ensure container is rendered
      const container = canvas.parentElement;
      if (!container) {
        console.error('Canvas parent container not found');
        return;
      }
      
      // Wait for container to be fully rendered
      setTimeout(() => {
        // Re-check canvas and context are still available
        if (!canvas || !ctx) {
          console.error('Canvas or context is null in setTimeout');
          return;
        }
        
        const containerWidth = container.clientWidth || 800;
        const containerHeight = container.clientHeight || 600;
        
        console.log('Container size:', containerWidth, 'x', containerHeight);
        
        // Calculate display size maintaining aspect ratio
        const imageAspect = img.width / img.height;
        const containerAspect = containerWidth / containerHeight;
        
        let displayWidth: number;
        let displayHeight: number;
        
        if (imageAspect > containerAspect) {
          // Image is wider - fit to width
          displayWidth = containerWidth;
          displayHeight = containerWidth / imageAspect;
        } else {
          // Image is taller - fit to height
          displayHeight = containerHeight;
          displayWidth = containerHeight * imageAspect;
        }
        
        // Double the width and height as requested
        displayWidth = displayWidth * 2;
        displayHeight = displayHeight * 2;
        
        console.log('Calculated display size:', displayWidth, 'x', displayHeight);
        
        // First, wait for the background image to load and get its natural size
        const bgImage = container.querySelector('.studio-canvas-image') as HTMLImageElement;
        if (!bgImage) {
          console.warn('Background image element not found');
          return;
        }
        
        // Wait for background image to load if not already loaded
        const setupCanvasSize = () => {
          // Re-check canvas and context are still available
          if (!canvas || !ctx) {
            console.error('Canvas or context is null in setupCanvasSize');
            return;
          }
          
          // Get the actual rendered size and position of the image
          const imageRect = bgImage.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Calculate position relative to container
          const imageLeft = imageRect.left - containerRect.left;
          const imageTop = imageRect.top - containerRect.top;
          const actualImageWidth = imageRect.width;
          const actualImageHeight = imageRect.height;
          
          console.log('Container size:', containerRect.width, 'x', containerRect.height);
          console.log('Image position:', imageLeft, ',', imageTop);
          console.log('Actual rendered image size:', actualImageWidth, 'x', actualImageHeight);
          console.log('Calculated display size:', displayWidth, 'x', displayHeight);
          
          // Use fixed canvas size for testing
          const fixedCanvasWidth = 800;
          const fixedCanvasHeight = 600;
          
          // Set canvas actual size (for drawing) - use fixed size
          canvas.width = fixedCanvasWidth;
          canvas.height = fixedCanvasHeight;
          
          // Set canvas display size (CSS) - use fixed size
          canvas.style.setProperty('width', fixedCanvasWidth + 'px', 'important');
          canvas.style.setProperty('height', fixedCanvasHeight + 'px', 'important');
          canvas.style.setProperty('max-width', 'none', 'important');
          canvas.style.setProperty('max-height', 'none', 'important');
          canvas.style.setProperty('min-width', fixedCanvasWidth + 'px', 'important');
          canvas.style.setProperty('min-height', fixedCanvasHeight + 'px', 'important');
          canvas.style.margin = '0';
          canvas.style.padding = '0';
          canvas.style.position = 'absolute';
          canvas.style.left = imageLeft + 'px';
          canvas.style.top = imageTop + 'px';
          canvas.style.right = 'auto';
          canvas.style.background = 'transparent';
          canvas.style.pointerEvents = 'auto';
          canvas.style.zIndex = '10';
          
          // Clear canvas with transparent background (image is in background layer, not on canvas)
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          console.log('Canvas display size:', fixedCanvasWidth, 'x', fixedCanvasHeight);
          console.log('Canvas position:', imageLeft, ',', imageTop);
          console.log('Canvas actual size:', canvas.width, 'x', canvas.height);
          
          // Store image position for coordinate calculations
          (canvas as any).imageOffsetX = imageLeft;
          (canvas as any).imageOffsetY = imageTop;
          
          // Mark canvas as ready
          this.studioCanvasReady = true;
          
          // Save initial state (empty transparent canvas)
          this.saveStudioState();
          
          // Redraw all shapes (if any)
          this.redrawStudioCanvas();
          
          console.log('Canvas initialized successfully');
        };
        
        // Set background image to fill container, let CSS handle sizing with object-fit: contain
        bgImage.style.width = '100%';
        bgImage.style.height = '100%';
        bgImage.style.maxWidth = '100%';
        bgImage.style.maxHeight = '100%';
        bgImage.style.objectFit = 'contain';
        bgImage.style.position = 'absolute';
        bgImage.style.left = '0';
        bgImage.style.top = '0';
        
        // Wait for the image to load and render, then setup canvas to match actual rendered size
        const waitForImageRender = () => {
          // Wait a bit longer to ensure image has rendered
          setTimeout(() => {
            setupCanvasSize();
          }, 150);
        };
        
        if (bgImage.complete && bgImage.naturalWidth > 0) {
          // Image already loaded
          waitForImageRender();
        } else {
          // Wait for image to load
          bgImage.onload = () => {
            waitForImageRender();
          };
        }
      }, 100);
      
    };
    
    img.onerror = (error) => {
      console.error('Error loading studio image:', this.studioImage, error);
      
      // If this is a proxy URL and we have a timestamp, try getting presigned URL
      if (this.studioImage && this.studioImage.includes('/proxy/') && this.studioImageTimestamp) {
        const developerTag = this.currentDeveloperTag;
        const projectTag = this.currentProjectTag;
        const cameraTag = this.currentCameraTag;
        
        if (developerTag && projectTag && cameraTag) {
          console.log('Proxy URL failed, trying presigned URL...');
          this.cameraPicsService.getImagePresignedUrl(developerTag, projectTag, cameraTag, this.studioImageTimestamp).subscribe({
            next: (presignedUrl) => {
              if (presignedUrl) {
                console.log('Got presigned URL, retrying:', presignedUrl);
                this.studioImage = presignedUrl;
                // Retry canvas initialization with presigned URL
                setTimeout(() => {
                  this.initStudioCanvas();
                }, 100);
              } else {
                console.error('Presigned URL is empty');
                this.studioCanvasReady = false;
              }
            },
            error: (err) => {
              console.error('Error getting presigned URL:', err);
              // Try adding .jpg extension as last resort
              this.tryStudioImageWithExtension();
            }
          });
          return;
        }
      }
      
      // Try adding .jpg extension if URL doesn't have an extension
      this.tryStudioImageWithExtension();
    };
    
    console.log('Loading studio image:', this.studioImage);
    img.src = this.studioImage;
  }

  /**
   * Helper method to try loading image with .jpg extension
   */
  private tryStudioImageWithExtension() {
    if (this.studioImage && !this.studioImage.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const retryUrl = this.studioImage + '.jpg';
      console.log('Retrying with .jpg extension:', retryUrl);
      
      const retryImg = new Image();
      retryImg.crossOrigin = 'anonymous';
      retryImg.onload = () => {
        console.log('Image loaded successfully with .jpg extension');
        this.studioImage = retryUrl;
        // Retry canvas initialization with corrected URL
        setTimeout(() => {
          this.initStudioCanvas();
        }, 100);
      };
      retryImg.onerror = (retryError) => {
        console.error('Image still failed to load with .jpg extension:', retryUrl, retryError);
        this.studioCanvasReady = false;
      };
      retryImg.src = retryUrl;
    } else {
      // Already has extension or retry failed - just log the error
      this.studioCanvasReady = false;
    }
  }

  /**
   * Redraw canvas with all shapes
   */
  redrawStudioCanvas() {
    if (!this.studioCanvasContext) return;
    
    const ctx = this.studioCanvasContext;
    
    // Try to find canvas element
    let canvas: HTMLCanvasElement | null = null;
    if (this.studioCanvasRef?.nativeElement) {
      canvas = this.studioCanvasRef.nativeElement;
    } else {
      const canvasElement = document.querySelector('.studio-canvas-element') as HTMLCanvasElement;
      if (canvasElement) {
        canvas = canvasElement;
      }
    }
    
    if (!canvas) return;
    
    // Clear canvas and redraw only shapes/text (image is in background layer)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw all shapes
    this.studioShapes.forEach(shape => {
      this.drawShape(ctx, shape);
    });
    
    // Redraw all texts
    this.studioTexts.forEach((text, index) => {
      this.drawText(ctx, text, index);
    });
  }

  /**
   * Draw a shape on canvas
   */
  drawShape(ctx: CanvasRenderingContext2D, shape: any) {
    ctx.strokeStyle = shape.strokeColor || this.studioStrokeColor;
    ctx.fillStyle = shape.fillColor || this.studioFillColor;
    ctx.lineWidth = shape.strokeWidth || this.studioStrokeWidth;
    
    const { type, x, y, width, height, startX, startY, endX, endY } = shape;
    
    switch (type) {
      case 'box':
        ctx.strokeRect(x, y, width, height);
        break;
      case 'circle':
        const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case 'arrow':
        this.drawArrow(ctx, startX, startY, endX, endY);
        break;
    }
  }

  /**
   * Draw arrow
   */
  drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const headlen = 10;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  /**
   * Draw text on canvas
   */
  drawText(ctx: CanvasRenderingContext2D, text: any, index?: number) {
    const isSelected = index !== undefined && this.selectedTextIndex === index;
    ctx.fillStyle = text.color || this.studioTextColor;
    ctx.font = `${text.fontSize || this.studioFontSize}px ${text.fontFamily || this.studioFontFamily}`;
    ctx.fillText(text.value || '', text.x || 0, text.y || 0);
    
    // Draw selection indicator if text is selected
    if (isSelected) {
      const metrics = ctx.measureText(text.value || '');
      ctx.strokeStyle = '#5621d2';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        (text.x || 0) - 2,
        (text.y || 0) - (text.fontSize || this.studioFontSize) - 2,
        metrics.width + 4,
        (text.fontSize || this.studioFontSize) + 4
      );
      ctx.setLineDash([]);
    }
  }

  /**
   * Save current canvas state for undo/redo
   */
  saveStudioState() {
    if (!this.studioCanvasRef?.nativeElement) return;
    
    const canvas = this.studioCanvasRef.nativeElement;
    const state = canvas.toDataURL();
    
    // Remove any states after current index (when new action after undo)
    this.studioHistory = this.studioHistory.slice(0, this.studioHistoryIndex + 1);
    
    // Add new state
    this.studioHistory.push(state);
    this.studioHistoryIndex = this.studioHistory.length - 1;
    
    // Limit history size
    if (this.studioHistory.length > 50) {
      this.studioHistory.shift();
      this.studioHistoryIndex--;
    }
  }

  /**
   * Handle canvas mouse down
   */
  onStudioCanvasMouseDown(event: MouseEvent) {
    // Try to find canvas element
    let canvas: HTMLCanvasElement | null = null;
    if (this.studioCanvasRef?.nativeElement) {
      canvas = this.studioCanvasRef.nativeElement;
    } else {
      const canvasElement = document.querySelector('.studio-canvas-element') as HTMLCanvasElement;
      if (canvasElement) {
        canvas = canvasElement;
      }
    }
    
    if (!canvas || !this.studioCanvasContext) {
      console.warn('Canvas or context not available');
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factor between display size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get mouse position relative to canvas
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Ensure coordinates are within canvas bounds
    if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) {
      console.log('Mouse outside canvas bounds:', mouseX, mouseY, 'Canvas size:', rect.width, rect.height);
      return;
    }
    
    // Scale to canvas coordinates
    const canvasX = mouseX * scaleX;
    const canvasY = mouseY * scaleY;
    
    console.log('Mouse down - Canvas rect:', rect.left, rect.top, rect.width, rect.height);
    console.log('Mouse down - Event position:', event.clientX, event.clientY);
    console.log('Mouse down - Relative position:', mouseX, mouseY);
    console.log('Mouse down - Canvas coordinates:', canvasX, canvasY);
    
    // Check if clicking on existing text (for text tool)
    if (this.studioTool === 'text') {
      // Check if clicking on an existing text element
      const clickedTextIndex = this.findTextAtPosition(canvasX, canvasY);
      
      if (clickedTextIndex !== null) {
        // Select and start dragging this text
        this.selectedTextIndex = clickedTextIndex;
        const text = this.studioTexts[clickedTextIndex];
        this.textDragOffsetX = canvasX - (text.x || 0);
        this.textDragOffsetY = canvasY - (text.y || 0);
        this.isDraggingText = true;
        // Update controller position
        this.updateTextControllerPosition();
        this.redrawStudioCanvas();
        return;
      } else {
        // Deselect if clicking elsewhere
        this.selectedTextIndex = null;
        // Add new text at click position
        if (this.useInlineTextInput) {
          // Inline approach: Add text immediately with default value
          this.addStudioText(canvasX, canvasY, 'New Text');
          // Update controller position after text is added
          setTimeout(() => {
            this.updateTextControllerPosition();
          }, 0);
        } else {
          // Modal approach: Store position and show modal
          this.pendingTextX = canvasX;
          this.pendingTextY = canvasY;
          this.newTextValue = '';
          this.showTextInputModal = true;
        }
      }
    } else if (this.studioTool) {
      // For other tools, start drawing
      this.startX = canvasX;
      this.startY = canvasY;
      this.isDrawing = true;
      this.selectedTextIndex = null; // Deselect text when using other tools
    }
  }
  
  /**
   * Find text at given position
   */
  findTextAtPosition(x: number, y: number): number | null {
    if (!this.studioCanvasContext) return null;
    
    for (let i = this.studioTexts.length - 1; i >= 0; i--) {
      const text = this.studioTexts[i];
      const textX = text.x || 0;
      const textY = text.y || 0;
      const fontSize = text.fontSize || this.studioFontSize;
      
      // Measure text width
      this.studioCanvasContext.font = `${fontSize}px ${text.fontFamily || this.studioFontFamily}`;
      const metrics = this.studioCanvasContext.measureText(text.value || '');
      const textWidth = metrics.width;
      const textHeight = fontSize;
      
      // Check if click is within text bounds
      if (x >= textX - 5 && x <= textX + textWidth + 5 &&
          y >= textY - textHeight - 5 && y <= textY + 5) {
        return i;
      }
    }
    return null;
  }

  /**
   * Handle canvas mouse move
   */
  onStudioCanvasMouseMove(event: MouseEvent) {
    // Try to find canvas element
    let canvas: HTMLCanvasElement | null = null;
    if (this.studioCanvasRef?.nativeElement) {
      canvas = this.studioCanvasRef.nativeElement;
    } else {
      const canvasElement = document.querySelector('.studio-canvas-element') as HTMLCanvasElement;
      if (canvasElement) {
        canvas = canvasElement;
      }
    }
    
    if (!canvas || !this.studioCanvasContext) return;
    
    const rect = canvas.getBoundingClientRect();
    // Calculate scale factor between display size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get mouse position relative to canvas
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Clamp coordinates to canvas bounds
    const clampedX = Math.max(0, Math.min(mouseX, rect.width));
    const clampedY = Math.max(0, Math.min(mouseY, rect.height));
    
    // Scale to canvas coordinates
    const currentX = clampedX * scaleX;
    const currentY = clampedY * scaleY;
    
    // Handle text dragging
    if (this.isDraggingText && this.selectedTextIndex !== null) {
      const text = this.studioTexts[this.selectedTextIndex];
      text.x = currentX - this.textDragOffsetX;
      text.y = currentY - this.textDragOffsetY;
      // Update controller position while dragging
      this.updateTextControllerPosition();
      this.redrawStudioCanvas();
      return;
    }
    
    // Handle shape drawing
    if (!this.isDrawing || !this.studioTool || this.studioTool === 'text') return;
    
    // Redraw canvas and show preview
    this.redrawStudioCanvas();
    
    // Draw preview shape
    const ctx = this.studioCanvasContext;
    ctx.strokeStyle = this.studioStrokeColor;
    ctx.fillStyle = this.studioFillColor;
    ctx.lineWidth = this.studioStrokeWidth;
    
    switch (this.studioTool) {
      case 'box':
        ctx.strokeRect(
          Math.min(this.startX, currentX),
          Math.min(this.startY, currentY),
          Math.abs(currentX - this.startX),
          Math.abs(currentY - this.startY)
        );
        break;
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(currentX - this.startX, 2) + Math.pow(currentY - this.startY, 2)
        );
        ctx.beginPath();
        ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case 'arrow':
        this.drawArrow(ctx, this.startX, this.startY, currentX, currentY);
        break;
    }
  }

  /**
   * Handle canvas mouse up
   */
  onStudioCanvasMouseUp(event: MouseEvent) {
    // Handle text drag end
    if (this.isDraggingText) {
      this.isDraggingText = false;
      this.saveStudioState();
      return;
    }
    
    if (!this.isDrawing) return;
    
    // Try to find canvas element
    let canvas: HTMLCanvasElement | null = null;
    if (this.studioCanvasRef?.nativeElement) {
      canvas = this.studioCanvasRef.nativeElement;
    } else {
      const canvasElement = document.querySelector('.studio-canvas-element') as HTMLCanvasElement;
      if (canvasElement) {
        canvas = canvasElement;
      }
    }
    
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    // Calculate scale factor between display size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get mouse position relative to canvas
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Scale to canvas coordinates
    const endX = mouseX * scaleX;
    const endY = mouseY * scaleY;
    
    // Save shape
    const shape: any = {
      type: this.studioTool,
      startX: this.startX,
      startY: this.startY,
      endX: endX,
      endY: endY,
      x: Math.min(this.startX, endX),
      y: Math.min(this.startY, endY),
      width: endX - this.startX,
      height: endY - this.startY,
      strokeColor: this.studioStrokeColor,
      fillColor: this.studioFillColor,
      strokeWidth: this.studioStrokeWidth
    };
    
    this.studioShapes.push(shape);
    this.saveStudioState();
    this.isDrawing = false;
  }

  /**
   * Add text to canvas
   */
  confirmTextInput() {
    if (this.newTextValue.trim()) {
      this.addStudioText(this.pendingTextX, this.pendingTextY, this.newTextValue.trim());
    }
    this.closeTextInputModal();
  }

  closeTextInputModal() {
    this.showTextInputModal = false;
    this.newTextValue = '';
    this.pendingTextX = 0;
    this.pendingTextY = 0;
  }

  addStudioText(x: number, y: number, text: string) {
    const newText = {
      x,
      y,
      value: text,
      color: this.studioTextColor,
      fontSize: this.studioFontSize,
      fontFamily: this.studioFontFamily
    };
    this.studioTexts.push(newText);
    this.selectedTextIndex = this.studioTexts.length - 1; // Select the newly added text
    this.studioTextValue = text; // Update the text value for inline editing
    this.redrawStudioCanvas();
    this.saveStudioState();
  }

  updateTextControllerPosition() {
    if (this.selectedTextIndex === null || !this.studioCanvasRef?.nativeElement) {
      this.textControllerPosition = null;
      return;
    }
    
    const selectedText = this.studioTexts[this.selectedTextIndex];
    if (!selectedText) {
      this.textControllerPosition = null;
      return;
    }

    const canvas = this.studioCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Calculate controller position relative to canvas
    const textHeight = selectedText.fontSize || this.studioFontSize;
    const controllerX = selectedText.x / scaleX;
    const controllerY = (selectedText.y / scaleY) + textHeight + 10; // Offset below text

    this.textControllerPosition = {
      x: controllerX,
      y: controllerY
    };
  }

  updateSelectedText() {
    if (this.selectedTextIndex !== null) {
      const selectedText = this.studioTexts[this.selectedTextIndex];
      selectedText.value = this.studioTextValue;
      selectedText.color = this.studioTextColor;
      selectedText.fontSize = this.studioFontSize;
      selectedText.fontFamily = this.studioFontFamily;
      this.redrawStudioCanvas();
      this.saveStudioState();
    }
  }

  deleteSelectedText() {
    if (this.selectedTextIndex !== null) {
      this.studioTexts.splice(this.selectedTextIndex, 1);
      this.selectedTextIndex = null;
      this.textControllerPosition = null;
      this.redrawStudioCanvas();
      this.saveStudioState();
    }
  }
  
  /**
   * Update selected text color
   */
  updateSelectedTextColor() {
    if (this.selectedTextIndex !== null && this.studioTexts[this.selectedTextIndex]) {
      this.studioTexts[this.selectedTextIndex].color = this.studioTextColor;
      this.redrawStudioCanvas();
      this.saveStudioState();
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
    const target = event.target as HTMLElement;
    
    // Close video date/time pickers if clicking outside
    if (!target.closest('.video-date-picker-part') && !target.closest('.video-time-picker-part') && 
        !target.closest('.compare-calendar-dropdown') && !target.closest('.compare-time-dropdown')) {
      this.showVideoFromDatePicker = false;
      this.showVideoToDatePicker = false;
      this.showVideoFromTimePicker = false;
      this.showVideoToTimePicker = false;
    }
    
    // Close date/time pickers if clicking outside
    if (!target.closest('.compare-date-picker-part') && 
        !target.closest('.compare-time-picker-part') &&
        !target.closest('.compare-calendar-dropdown') &&
        !target.closest('.compare-time-dropdown')) {
      this.showCompareLeftDatePicker = false;
      this.showCompareRightDatePicker = false;
      this.showCompareLeftTimePicker = false;
      this.showCompareRightTimePicker = false;
    }
    
    // Close main date picker if clicking outside
    if (!target.closest('.new-date-picker-button') && 
        !target.closest('.main-calendar-dropdown')) {
      this.showMainDatePicker = false;
    }
    
    // Close thumbnail strips if clicking outside
    if (!target.closest('.compare-slider-btn') && 
        !target.closest('.compare-thumbnail-strip')) {
      this.showCompareLeftThumbnailStrip = false;
      this.showCompareRightThumbnailStrip = false;
    }
    
    // Close main thumbnail strip if clicking outside
    if (this.showThumbnailStrip) {
      const isInsideStrip = target.closest('.thumbnail-strip-container');
      const isOnSliderBtn = target.closest('.main-slider-btn');
      const isOnDatePicker = target.closest('.new-date-picker-wrapper') || 
                            target.closest('.main-calendar-dropdown') ||
                            target.closest('.new-date-picker-button');
      
      // Close if clicking outside strip, button, and date picker
      if (!isInsideStrip && !isOnSliderBtn && !isOnDatePicker) {
        this.closeThumbnailStrip();
      }
    }
  }
}
