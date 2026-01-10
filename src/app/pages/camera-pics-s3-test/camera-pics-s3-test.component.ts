import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { API_CONFIG, getApiUrl } from '../../config/api.config';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
// import { StudioTestComponent } from '../studio-test/studio-test.component'; // TODO: Add StudioTestComponent if needed

interface CameraPicturesResponse {
  firstPhoto: string;
  lastPhoto: string;
  date1Photos: string[];
  date2Photos: string[];
  path: string;
  error?: string;
}

interface CameraPreviewResponse {
  weeklyImages: string[];
  path: string;
  error?: string;
}

interface VideoResponse {
  message: string;
  videoPath: string;
  error?: string;
}

interface SlideshowResponse {
  images: string[];
  count: number;
  rangeType: string;
  description: string;
  error?: string;
}

@Component({
  selector: 'app-camera-pics-s3-test',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatTabsModule,
    MatListModule,
    MatChipsModule,
    MatSliderModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule
    // StudioTestComponent // TODO: Add when StudioTestComponent is created
  ],
  templateUrl: './camera-pics-s3-test.component.html',
  styleUrl: './camera-pics-s3-test.component.css'
})
export class CameraPicsS3TestComponent implements OnInit, OnDestroy {
  // Expose Math to template
  Math = Math;
  
  ngOnDestroy() {
    // Clean up slideshow interval when component is destroyed
    if (this.slideshowInterval) {
      clearInterval(this.slideshowInterval);
      this.slideshowInterval = null;
    }
  }
  // Common inputs
  developerId: string = 'cscec';
  projectId: string = 'rta';
  cameraId: string = 'camera1';
  date1: string = '';
  date2: string = '';

  // Loading states
  loadingPictures: boolean = false;
  loadingPreview: boolean = false;
  loadingVideo: boolean = false;
  loadingSlideshow: boolean = false;

  // Error states
  picturesError: string = '';
  previewError: string = '';
  videoError: string = '';
  slideshowError: string = '';

  // Responses
  picturesResponse: CameraPicturesResponse | null = null;
  previewResponse: CameraPreviewResponse | null = null;
  videoResponse: VideoResponse | null = null;
  slideshowResponse: SlideshowResponse | null = null;

  // Selected images for gallery view
  selectedDate1Image: string | null = null;
  selectedDate2Image: string | null = null;

  // Slideshow state
  slideshowImages: string[] = [];
  currentSlideshowIndex: number = 0;
  selectedRangeType: string = '';
  isSlideshowPlaying: boolean = false;
  slideshowInterval: any = null;
  slideshowIntervalDelay: number = 250; // 0.25 seconds between images
  slideshowSpeed: number = 250; // Current speed in milliseconds
  availableSpeeds: { label: string; value: number }[] = [
    { label: '0.5x', value: 500 },
    { label: '1x', value: 250 },
    { label: '2x', value: 125 },
    { label: '4x', value: 62.5 },
    { label: '8x', value: 31.25 }
  ];

  // Presentation mode
  isPresentationMode: boolean = false;
  presentationSpeed: number = 2000; // independent of regular speed (default 2s/image)
  availablePresentationSpeeds: { label: string; value: number }[] = [
    { label: '1s', value: 1000 },
    { label: '2s', value: 2000 },
    { label: '3s', value: 3000 },
    { label: '5s', value: 5000 }
  ];

  // Presentation effect: cross-fade ONLY
  presentationTransition: 'fade' = 'fade';
  presentationImageClass: string = ''; // kept for backwards compatibility; not used by cross-fade UI
  private transitionTimeouts: ReturnType<typeof setTimeout>[] = []; // Store transition timeouts for cancellation

  // Cross-fade layer state (two stacked images)
  presentationActiveLayer: 'a' | 'b' = 'a';
  presentationLayerAUrl: string = '';
  presentationLayerBUrl: string = '';

  // Image filters
  imageSaturation: number = 200; // 200% saturation
  imageContrast: number = 150; // 150% contrast
  filtersEnabled: boolean = true; // Toggle for filters

  // Studio image source
  studioImageSrc: string = '';
  selectedHour: number = 12; // Default hour (0-23)

  // Image Comparison state
  comparisonImages1: string[] = [];
  comparisonImages2: string[] = [];
  selectedComparisonImage1: string | null = null;
  selectedComparisonImage2: string | null = null;
  comparisonSliderValue: number = 50; // 0-100, 50 is middle
  loadingComparison: boolean = false;
  comparisonError: string = '';
  isDraggingComparison: boolean = false;
  comparisonMode: 'slider' | 'rectangle' = 'slider';
  rectangleX: number = 50; // percentage from left
  rectangleY: number = 50; // percentage from top
  rectangleSize: number = 400; // size in pixels
  isDraggingRectangle: boolean = false;
  rectangleDragStartX: number = 0;
  rectangleDragStartY: number = 0;
  rectangleWrapperWidth: number = 1000; // will be updated dynamically
  rectangleWrapperHeight: number = 600; // will be updated dynamically

  // Performance testing
  performanceMetrics: {
    directS3: { startTime: number; endTime: number; duration: number; loaded: number } | null;
    proxied: { startTime: number; endTime: number; duration: number; loaded: number } | null;
  } = {
    directS3: null,
    proxied: null
  };

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Set default date to today
    const today = new Date();
    this.date1 = this.formatDate(today);
    this.date2 = this.formatDate(today);
    
    // Initialize rectangle wrapper dimensions (will be updated on first drag)
    // Use approximate values based on typical wrapper size
    this.rectangleWrapperWidth = 1000;
    this.rectangleWrapperHeight = 600;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  getAuthHeaders(): HttpHeaders {
    const authToken = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': authToken ? `Bearer ${authToken}` : '',
      'Content-Type': 'application/json'
    });
  }

  // Test 1: Get Camera Pictures
  getCameraPictures() {
    this.loadingPictures = true;
    this.picturesError = '';
    this.picturesResponse = null;

    const url = `${getApiUrl('/api/camerapics-s3-test')}/${this.developerId}/${this.projectId}/${this.cameraId}/pictures/`;
    const body: any = {};
    
    if (this.date1) {
      body.date1 = this.date1;
    }
    if (this.date2) {
      body.date2 = this.date2;
    }

    this.http.post<CameraPicturesResponse>(url, body, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        this.picturesResponse = response;
        this.loadingPictures = false;
        console.log('Camera Pictures Response:', response);
        
        // Pre-fetch presigned URLs using /image endpoint (faster than proxy, proper S3 authentication!)
        // This endpoint returns: https://s3.ap-southeast-1.idrivee2.com/camera-pictures/upload/.../large/timestamp.jpg?[auth]
        const allPhotos = [...new Set([
          response.firstPhoto,
          response.lastPhoto,
          ...(response.date1Photos || []), 
          ...(response.date2Photos || [])
        ].filter(Boolean))];
        
        if (allPhotos.length > 0) {
          console.log(`✓ Fetching presigned URLs for ${allPhotos.length} images using /image endpoint (faster than proxy!)`);
          
          // Batch fetch presigned URLs for all images
          this.fetchPresignedUrlsForBatch(allPhotos, response.date1Photos || [], response.date2Photos || []);
        }
        
        // Set first images as selected by default
        if (response.date1Photos && response.date1Photos.length > 0) {
          this.selectedDate1Image = response.date1Photos[0];
        }
        if (response.date2Photos && response.date2Photos.length > 0) {
          this.selectedDate2Image = response.date2Photos[0];
        }
      },
      error: (err) => {
        this.loadingPictures = false;
        this.picturesError = err.error?.error || err.message || 'Failed to load camera pictures';
        console.error('Error loading camera pictures:', err);
      }
    });
  }

  // Test 2: Get Camera Preview (Weekly Images)
  getCameraPreview() {
    this.loadingPreview = true;
    this.previewError = '';
    this.previewResponse = null;

    const url = `${getApiUrl('/api/camerapics-s3-test')}/preview/${this.developerId}/${this.projectId}/${this.cameraId}/`;

    this.http.get<CameraPreviewResponse>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        this.previewResponse = response;
        this.loadingPreview = false;
        console.log('Camera Preview Response:', response);
        
        // Pre-fetch presigned URLs using /image endpoint (faster than proxy!)
        if (response.weeklyImages && response.weeklyImages.length > 0) {
          console.log(`✓ Fetching presigned URLs for ${response.weeklyImages.length} preview images using /image endpoint...`);
          // Batch fetch presigned URLs for all preview images
          this.fetchPresignedUrlsForBatch(response.weeklyImages, [], []);
        }
      },
      error: (err) => {
        this.loadingPreview = false;
        this.previewError = err.error?.error || err.message || 'Failed to load camera preview';
        console.error('Error loading camera preview:', err);
      }
    });
  }

  // Test 3: Generate Weekly Video
  generateWeeklyVideo() {
    this.loadingVideo = true;
    this.videoError = '';
    this.videoResponse = null;

    const url = `${getApiUrl('/api/camerapics-s3-test')}/preview-video/${this.developerId}/${this.projectId}/${this.cameraId}/`;

    this.http.get<VideoResponse>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        this.videoResponse = response;
        this.loadingVideo = false;
        console.log('Video Response:', response);
      },
      error: (err) => {
        this.loadingVideo = false;
        this.videoError = err.error?.error || err.message || 'Failed to generate video';
        console.error('Error generating video:', err);
      }
    });
  }


  // Helper methods for displaying images
  // Cache for presigned URLs to avoid multiple requests
  private imageUrlCache: Map<string, string> = new Map();
  // Pre-loaded Image objects for instant display
  private preloadedImages: Map<string, HTMLImageElement> = new Map();
  // Current image URL for direct binding (optimized for speed)
  currentImageUrl: string = '';

  /**
   * Batch fetch presigned URLs for multiple images (much faster than one-by-one)
   * Uses the /image endpoint which returns presigned S3 URLs with authentication
   */
  fetchPresignedUrlsForBatch(
    allPhotos: string[], 
    date1Photos: string[], 
    date2Photos: string[]
  ): void {
    const startTime = performance.now();
    let loadedCount = 0;
    const totalCount = allPhotos.length;
    
    console.log(`🚀 Batch fetching ${totalCount} presigned URLs using /image endpoint...`);

    // Fetch presigned URLs for all images in parallel (with slight staggering to avoid overwhelming)
    allPhotos.forEach((timestamp, index) => {
      const cacheKey = `${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;
      
      // Skip if already cached
      if (this.imageUrlCache.has(cacheKey)) {
        loadedCount++;
        if (loadedCount === totalCount) {
          const duration = performance.now() - startTime;
          console.log(`✅ Batch fetch complete: ${loadedCount}/${totalCount} URLs in ${duration.toFixed(2)}ms`);
        }
        return;
      }

      // Use the /image endpoint to get presigned URL
      // This returns: https://s3.ap-southeast-1.idrivee2.com/camera-pictures/upload/.../large/timestamp.jpg?[auth]
      const url = `${getApiUrl('/api/camerapics-s3-test')}/image/${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;

      // Stagger requests slightly to avoid overwhelming the server
      setTimeout(() => {
        this.http.get<{ url: string; key: string; expiresIn: number }>(url, { headers: this.getAuthHeaders() }).subscribe({
          next: (response) => {
            // Cache the presigned URL
            this.imageUrlCache.set(cacheKey, response.url);
            
            // Pre-load the image into browser cache for instant display
            const img = new Image();
            img.onload = () => {
              loadedCount++;
              
              // Update slideshow if needed
              const currentImage = this.getCurrentSlideshowImage();
              if (currentImage === timestamp) {
                this.updateCurrentImageUrl();
                this.cdr.markForCheck();
                this.cdr.detectChanges();
              }
              
              // Log completion
              if (loadedCount === totalCount) {
                const duration = performance.now() - startTime;
                console.log(`✅ Batch fetch complete: ${loadedCount}/${totalCount} presigned URLs fetched and images preloaded in ${duration.toFixed(2)}ms`);
                console.log(`   Average: ${(duration / loadedCount).toFixed(2)}ms per image`);
              }
            };
            img.onerror = () => {
              loadedCount++;
              console.warn(`Failed to preload image for ${timestamp}`);
              if (loadedCount === totalCount) {
                const duration = performance.now() - startTime;
                console.log(`⚠️ Batch fetch complete with errors: ${loadedCount}/${totalCount} URLs in ${duration.toFixed(2)}ms`);
              }
            };
            img.src = response.url;
            this.preloadedImages.set(timestamp, img);
          },
          error: (err) => {
            loadedCount++;
            console.error(`Error fetching presigned URL for ${timestamp}:`, err);
            this.imageUrlCache.set(cacheKey, '');
            if (loadedCount === totalCount) {
              const duration = performance.now() - startTime;
              console.log(`⚠️ Batch fetch complete with errors: ${loadedCount}/${totalCount} URLs in ${duration.toFixed(2)}ms`);
            }
          }
        });
      }, index * 50); // 50ms stagger to avoid overwhelming
    });
  }

  // Fetch presigned URL for an image and pre-load it (single image)
  fetchImageUrl(timestamp: string): void {
    const cacheKey = `${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;
    
    // If already cached, skip
    if (this.imageUrlCache.has(cacheKey)) {
      return;
    }

    // Use the /image endpoint to get presigned URL
    // This returns: https://s3.ap-southeast-1.idrivee2.com/camera-pictures/upload/.../large/timestamp.jpg?[auth]
    const url = `${getApiUrl('/api/camerapics-s3-test')}/image/${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;

    this.http.get<{ url: string; key: string; expiresIn: number }>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        this.imageUrlCache.set(cacheKey, response.url);
        
        // Pre-load the image into browser cache for instant display
        this.preloadImage(response.url, timestamp);
        
        // Only trigger change detection if this is the currently displayed image
        const currentImage = this.getCurrentSlideshowImage();
        if (currentImage === timestamp) {
          this.updateCurrentImageUrl();
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error fetching presigned URL:', err);
        // Set a placeholder or error image
        this.imageUrlCache.set(cacheKey, '');
      }
    });
  }

  // Pre-load image into browser cache for instant display
  private preloadImage(url: string, timestamp: string): void {
    if (this.preloadedImages.has(timestamp)) {
      return; // Already pre-loaded
    }
    
    const img = new Image();
    img.src = url;
    this.preloadedImages.set(timestamp, img);
  }

  // Update current image URL directly (optimized for speed)
  private updateCurrentImageUrl(): void {
    const currentImage = this.getCurrentSlideshowImage();
    if (currentImage) {
      this.currentImageUrl = this.getImageUrlWithFetch(currentImage);
    } else {
      this.currentImageUrl = '';
    }
  }

  // Get image URL with automatic fetching - optimized for instant access
  // Uses presigned URLs from /image endpoint (faster than proxy, proper S3 authentication)
  getImageUrlWithFetch(timestamp: string): string {
    if (!timestamp) return '';
    
    const cacheKey = `${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;
    
    // Return cached presigned URL immediately if available
    if (this.imageUrlCache.has(cacheKey)) {
      return this.imageUrlCache.get(cacheKey) || '';
    }
    
    // If not cached, fetch presigned URL using /image endpoint
    // This will return: https://s3.ap-southeast-1.idrivee2.com/camera-pictures/upload/.../large/timestamp.jpg?[auth]
    this.fetchImageUrl(timestamp);
    return '';
  }

  // Get current slideshow image URL directly from cache for instant access
  getCurrentSlideshowImageUrl(): string {
    const currentImage = this.getCurrentSlideshowImage();
    if (!currentImage) return '';
    const url = this.getImageUrlWithFetch(currentImage);
    // Debug: log if URL is not ready
    if (!url && currentImage) {
      const cacheKey = `${this.developerId}/${this.projectId}/${this.cameraId}/${currentImage}`;
      console.log('Image URL not ready for:', currentImage, 'Cache has:', this.imageUrlCache.has(cacheKey));
    }
    return url;
  }

  // Check if image URL is available (presigned URL from /image endpoint)
  hasImageUrl(timestamp: string): boolean {
    if (!timestamp) return false;
    
    // Check presigned URL cache (from /image endpoint)
    const cacheKey = `${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;
    return this.imageUrlCache.has(cacheKey) && !!this.imageUrlCache.get(cacheKey);
  }

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

  openVideo() {
    if (this.videoResponse?.videoPath) {
      window.open(this.videoResponse.videoPath, '_blank');
    }
  }

  // Handle image error by hiding the image
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  // Select image from date1 gallery
  selectDate1Image(timestamp: string): void {
    this.selectedDate1Image = timestamp;
  }

  // Select image from date2 gallery
  selectDate2Image(timestamp: string): void {
    this.selectedDate2Image = timestamp;
  }

  // Slideshow methods
  loadSlideshow(rangeType: string) {
    // Pause any running slideshow
    this.pauseSlideshow();
    
    this.loadingSlideshow = true;
    this.slideshowError = '';
    this.slideshowResponse = null;
    this.slideshowImages = [];
    this.currentSlideshowIndex = 0;
    this.selectedRangeType = rangeType;

    const url = `${getApiUrl('/api/camerapics-s3-test')}/slideshow/${rangeType}/${this.developerId}/${this.projectId}/${this.cameraId}`;

    this.http.get<SlideshowResponse>(url, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        this.slideshowResponse = response;
        this.slideshowImages = response.images || [];
        this.loadingSlideshow = false;
        this.currentSlideshowIndex = 0;
        
        // Pre-fetch presigned URLs immediately for video-like scrubbing
        // Use /image endpoint to get presigned S3 URLs (faster than proxy, proper authentication!)
        if (this.slideshowImages.length > 0) {
          console.log(`✓ Fetching presigned URLs for ${this.slideshowImages.length} slideshow images using /image endpoint...`);
          
          // Batch fetch presigned URLs for all slideshow images
          this.fetchPresignedUrlsForBatch(this.slideshowImages, [], []);
          
          // Update current image URL after initial load
          setTimeout(() => {
            this.updateCurrentImageUrl();
          }, 100);
        }
        
        console.log('Slideshow Response:', response);
      },
      error: (err) => {
        this.loadingSlideshow = false;
        this.slideshowError = err.error?.error || err.message || 'Failed to load slideshow images';
        console.error('Error loading slideshow:', err);
      }
    });
  }


  // Navigate slideshow
  previousImage(): void {
    if (this.currentSlideshowIndex > 0) {
      this.currentSlideshowIndex--;
      this.updateCurrentImageUrl();
      this.onSlideshowIndexChange();
    }
  }

  nextImage(): void {
    if (this.currentSlideshowIndex < this.slideshowImages.length - 1) {
      this.currentSlideshowIndex++;
      this.updateCurrentImageUrl();
      this.onSlideshowIndexChange();
    }
  }

  // Navigate with transition support
  navigateImage(direction: 'next' | 'prev'): void {
    if (this.isPresentationMode) {
      if (direction === 'next') {
        this.nextImageWithTransition();
      } else {
        this.previousImageWithTransition();
      }
    } else {
      if (direction === 'next') {
        this.nextImage();
      } else {
        this.previousImage();
      }
    }
  }

  // Handle slider change - optimized for video-like scrubbing
  onSlideshowSliderChange(event: any): void {
    // Extract the value from the event
    // mat-slider input event can provide value as number or via event.target.value
    let newIndex: number;
    
    if (typeof event === 'number') {
      newIndex = Math.round(event);
    } else if (typeof event === 'string') {
      newIndex = Math.round(parseFloat(event));
    } else if (event?.value !== undefined) {
      newIndex = Math.round(event.value);
    } else if (event?.target?.value !== undefined) {
      newIndex = Math.round(parseFloat(event.target.value));
    } else {
      return;
    }
    
    // Clamp the index to valid range
    newIndex = Math.max(0, Math.min(newIndex, this.slideshowImages.length - 1));
    
    // Update the index if it changed
    if (newIndex !== this.currentSlideshowIndex) {
      this.currentSlideshowIndex = newIndex;
      // Update image URL immediately (synchronous, no async operations)
      this.updateCurrentImageUrl();
      // Force immediate change detection for instant image update (video-like scrubbing)
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }
  }

  // Handle slideshow index change (for button navigation)
  onSlideshowIndexChange(): void {
    // Force immediate change detection
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  // Handle image load
  onImageLoad(): void {
    // Image loaded successfully, trigger change detection
    this.cdr.detectChanges();
  }

  // Get current slideshow image
  getCurrentSlideshowImage(): string {
    if (this.slideshowImages.length > 0 && this.currentSlideshowIndex < this.slideshowImages.length) {
      return this.slideshowImages[this.currentSlideshowIndex];
    }
    return '';
  }

  // Check if can go previous
  canGoPrevious(): boolean {
    return this.currentSlideshowIndex > 0;
  }

  // Check if can go next
  canGoNext(): boolean {
    return this.currentSlideshowIndex < this.slideshowImages.length - 1;
  }

  // Toggle slideshow play/pause
  toggleSlideshowPlay(): void {
    if (this.isSlideshowPlaying) {
      this.pauseSlideshow();
    } else {
      this.playSlideshow();
    }
  }

  // Start automatic slideshow
  playSlideshow(): void {
    if (this.slideshowImages.length <= 1) return;
    
    this.isSlideshowPlaying = true;
    
    // Clear any existing interval
    if (this.slideshowInterval) {
      clearInterval(this.slideshowInterval);
    }
    
    // Set up interval to automatically advance using appropriate speed
    // Use presentation speed if in presentation mode, otherwise use regular speed
    const speed = this.isPresentationMode ? this.presentationSpeed : this.slideshowSpeed;
    this.slideshowInterval = setInterval(() => {
      if (this.currentSlideshowIndex < this.slideshowImages.length - 1) {
        this.nextImageWithTransition();
      } else {
        // Reached the end, loop back to the beginning
        // Set index to 0 and update directly to avoid skipping the first image
        if (this.isPresentationMode) {
          this.currentSlideshowIndex = 0;
          this.updateCurrentImageUrl();
          this.onSlideshowIndexChange();
          this.queueCrossFadeToCurrent();
        } else {
          this.currentSlideshowIndex = 0;
          this.updateCurrentImageUrl();
          this.onSlideshowIndexChange();
        }
      }
    }, speed);
  }

  // Navigate to next image with transition
  nextImageWithTransition(): void {
    if (this.isPresentationMode) {
      // Keep old layer visible; load new URL into inactive layer, then swap active for cross-fade
      const before = this.currentImageUrl;
      this.nextImage(); // updates currentSlideshowIndex + currentImageUrl
      if (this.currentImageUrl && this.currentImageUrl !== before) {
        this.queueCrossFadeToCurrent();
      }
    } else {
      this.nextImage();
    }
  }

  // Navigate to previous image with transition
  previousImageWithTransition(): void {
    if (this.isPresentationMode) {
      const before = this.currentImageUrl;
      this.previousImage();
      if (this.currentImageUrl && this.currentImageUrl !== before) {
        this.queueCrossFadeToCurrent();
      }
    } else {
      this.previousImage();
    }
  }

  private cancelPendingTransitions(): void {
    this.transitionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.transitionTimeouts = [];
  }

  private initPresentationCrossFade(): void {
    this.presentationActiveLayer = 'a';
    this.presentationLayerAUrl = this.currentImageUrl || '';
    this.presentationLayerBUrl = this.currentImageUrl || '';
    this.cancelPendingTransitions();
  }

  private queueCrossFadeToCurrent(): void {
    if (!this.isPresentationMode) return;
    if (!this.currentImageUrl) return;

    const nextLayer: 'a' | 'b' = this.presentationActiveLayer === 'a' ? 'b' : 'a';
    if (nextLayer === 'a') {
      this.presentationLayerAUrl = this.currentImageUrl;
    } else {
      this.presentationLayerBUrl = this.currentImageUrl;
    }

    // Swap active layer on the next tick so the browser applies the opacity transition
    const timeoutId = setTimeout(() => {
      this.presentationActiveLayer = nextLayer;
      const idx = this.transitionTimeouts.indexOf(timeoutId);
      if (idx > -1) this.transitionTimeouts.splice(idx, 1);
    }, 0);
    this.transitionTimeouts.push(timeoutId);
  }

  // Toggle presentation mode
  togglePresentationMode(): void {
    // Always enforce cross-fade effect for presentation mode
    this.presentationTransition = 'fade';

    // Cancel any pending transition timeouts when toggling mode
    this.cancelPendingTransitions();
    this.presentationImageClass = '';

    this.isPresentationMode = !this.isPresentationMode;
    if (this.isPresentationMode) {
      this.initPresentationCrossFade();
    }
    // If slideshow is playing, restart it with the appropriate speed for the current mode
    if (this.isSlideshowPlaying) {
      this.pauseSlideshow();
      this.playSlideshow();
    }
  }

  changePresentationSpeed(speed: number): void {
    this.presentationSpeed = speed;
    // If presentation is currently playing, restart with new speed (presentation speed is independent)
    if (this.isPresentationMode && this.isSlideshowPlaying) {
      this.pauseSlideshow();
      this.playSlideshow();
    }
  }

  // Change slideshow speed
  changeSlideshowSpeed(speed: number): void {
    this.slideshowSpeed = speed;
    // If slideshow is currently playing, restart it with new speed
    if (this.isSlideshowPlaying) {
      this.pauseSlideshow();
      this.playSlideshow();
    }
  }

  // Pause automatic slideshow
  pauseSlideshow(): void {
    this.isSlideshowPlaying = false;
    if (this.slideshowInterval) {
      clearInterval(this.slideshowInterval);
      this.slideshowInterval = null;
    }
    // Cancel any pending transition timeouts to prevent transitions from continuing after pause
    this.cancelPendingTransitions();
    // Reset presentation image class to clear any ongoing transition
    if (this.isPresentationMode) {
      this.presentationImageClass = '';
    }
  }

  // Image Comparison methods
  loadComparisonImages() {
    if (!this.date1 || !this.date2) {
      this.comparisonError = 'Please select both dates (Date 1 and Date 2) in the "Get Camera Pictures" tab first';
      return;
    }

    this.loadingComparison = true;
    this.comparisonError = '';
    this.comparisonImages1 = [];
    this.comparisonImages2 = [];
    this.selectedComparisonImage1 = null;
    this.selectedComparisonImage2 = null;
    this.comparisonSliderValue = 50;

    // Load images for date1
    const url1 = `${getApiUrl('/api/camerapics-s3-test')}/${this.developerId}/${this.projectId}/${this.cameraId}/pictures/`;
    const body1 = { date1: this.date1 };

    this.http.post<CameraPicturesResponse>(url1, body1, { headers: this.getAuthHeaders() }).subscribe({
      next: (response1) => {
        if (response1.date1Photos && response1.date1Photos.length > 0) {
          this.comparisonImages1 = response1.date1Photos;
          this.selectedComparisonImage1 = response1.date1Photos[0];
          // Pre-fetch presigned URLs using /image endpoint
          console.log(`✓ Fetching presigned URLs for ${response1.date1Photos.length} comparison images (date1) using /image endpoint...`);
          this.fetchPresignedUrlsForBatch(response1.date1Photos, response1.date1Photos, []);
        }

        // Load images for date2
        const url2 = `${getApiUrl('/api/camerapics-s3-test')}/${this.developerId}/${this.projectId}/${this.cameraId}/pictures/`;
        const body2 = { date1: this.date2 };

        this.http.post<CameraPicturesResponse>(url2, body2, { headers: this.getAuthHeaders() }).subscribe({
          next: (response2) => {
            if (response2.date1Photos && response2.date1Photos.length > 0) {
              this.comparisonImages2 = response2.date1Photos;
              this.selectedComparisonImage2 = response2.date1Photos[0];
              // Pre-fetch presigned URLs using /image endpoint
              console.log(`✓ Fetching presigned URLs for ${response2.date1Photos.length} comparison images (date2) using /image endpoint...`);
              this.fetchPresignedUrlsForBatch(response2.date1Photos, [], response2.date1Photos);
            }
            this.loadingComparison = false;
            // Update wrapper dimensions after images load
            setTimeout(() => this.updateRectangleWrapperDimensions(), 100);
          },
          error: (err) => {
            this.loadingComparison = false;
            this.comparisonError = err.error?.error || err.message || 'Failed to load comparison images for date 2';
            console.error('Error loading comparison images for date 2:', err);
          }
        });
      },
      error: (err) => {
        this.loadingComparison = false;
        this.comparisonError = err.error?.error || err.message || 'Failed to load comparison images for date 1';
        console.error('Error loading comparison images for date 1:', err);
      }
    });
  }

  updateRectangleWrapperDimensions(): void {
    // Find the wrapper element and update dimensions
    const wrapper = document.querySelector('.comparison-image-wrapper.rectangle-mode') as HTMLElement;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      this.rectangleWrapperWidth = rect.width;
      this.rectangleWrapperHeight = rect.height;
      this.cdr.markForCheck();
    }
  }

  selectComparisonImage1(timestamp: string): void {
    this.selectedComparisonImage1 = timestamp;
  }

  selectComparisonImage2(timestamp: string): void {
    this.selectedComparisonImage2 = timestamp;
  }

  // Get CSS filter string for images
  getImageFilter(): string {
    if (!this.filtersEnabled) {
      return ''; // No filter when toggled off
    }
    const saturation = this.imageSaturation / 100;
    const contrast = this.imageContrast / 100;
    return `saturate(${saturation}) contrast(${contrast})`;
  }

  // Toggle filters on/off
  toggleFilters(): void {
    this.filtersEnabled = !this.filtersEnabled;
  }

  // Studio methods
  loadImageForStudio(): void {
    // Image will be loaded automatically by the studio component when studioImageSrc changes
  }

  setStudioImageFromSlideshow(): void {
    const currentImage = this.getCurrentSlideshowImage();
    if (currentImage) {
      this.studioImageSrc = this.getImageUrlWithFetch(currentImage);
    }
  }

  setStudioImageFromComparison(): void {
    if (this.selectedComparisonImage1) {
      this.studioImageSrc = this.getImageUrlWithFetch(this.selectedComparisonImage1);
    }
  }

  setStudioImageFromDate1(): void {
    if (this.selectedDate1Image) {
      this.studioImageSrc = this.getImageUrlWithFetch(this.selectedDate1Image);
    }
  }

  setStudioImageFromDate2(): void {
    if (this.selectedDate2Image) {
      this.studioImageSrc = this.getImageUrlWithFetch(this.selectedDate2Image);
    }
  }

  // Get image by hour from date1
  getImageByHour(): void {
    if (!this.date1 || !this.picturesResponse) {
      return;
    }

    // Search in date1Photos for the closest image to the target hour
    let closestImage: string | null = null;
    let minDifference = Infinity;

    if (this.picturesResponse.date1Photos && this.picturesResponse.date1Photos.length > 0) {
      this.picturesResponse.date1Photos.forEach((photo: string) => {
        // Photo is in format YYYYMMDDHHMMSS
        if (photo.startsWith(this.date1)) {
          const photoHour = parseInt(photo.slice(8, 10)); // Extract hour from timestamp
          const difference = Math.abs(photoHour - this.selectedHour);
          
          if (difference < minDifference) {
            minDifference = difference;
            closestImage = photo;
          }
        }
      });
    }

    if (closestImage) {
      this.studioImageSrc = this.getImageUrlWithFetch(closestImage);
      // Pre-fetch the image URL if not already cached
      if (!this.hasImageUrl(closestImage)) {
        this.fetchImageUrl(closestImage);
      }
    } else {
      // If no image found in date1Photos, try to fetch from API with specific hour
      this.fetchImageByHourFromAPI();
    }
  }

  // Fetch image by hour from API
  private fetchImageByHourFromAPI(): void {
    if (!this.date1) return;

    const hourStr = String(this.selectedHour).padStart(2, '0');
    const time1 = `${hourStr}0000`; // HHMMSS format
    const time2 = `${hourStr}5959`; // End of the same hour

    const url = `${getApiUrl('/api/camerapics-s3-test')}/${this.developerId}/${this.projectId}/${this.cameraId}/pictures/`;
    const body = {
      date1: this.date1,
      time1: time1,
      time2: time2
    };

    this.http.post<any>(url, body, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        if (response.images && response.images.length > 0) {
          // Get the first image from that hour (or closest to the start of the hour)
          const selectedImage = response.images[0];
          this.studioImageSrc = this.getImageUrlWithFetch(selectedImage);
          // Pre-fetch the image URL
          this.fetchImageUrl(selectedImage);
        } else {
          console.warn(`No images found for hour ${this.selectedHour} on date ${this.date1}`);
        }
      },
      error: (err) => {
        console.error('Error fetching image by hour:', err);
      }
    });
  }

  onComparisonSliderChange(event: any): void {
    let newValue: number;
    
    if (typeof event === 'number') {
      newValue = Math.round(event);
    } else if (typeof event === 'string') {
      newValue = Math.round(parseFloat(event));
    } else if (event?.value !== undefined) {
      newValue = Math.round(event.value);
    } else if (event?.target?.value !== undefined) {
      newValue = Math.round(parseFloat(event.target.value));
    } else {
      return;
    }
    
    this.comparisonSliderValue = Math.max(0, Math.min(100, newValue));
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  getComparisonClipPath(): string {
    // When slider is at 50, both images are 50% visible
    // When slider moves right (>50), image1 shows more (clip-path increases)
    // When slider moves left (<50), image2 shows more (clip-path decreases)
    const percentage = this.comparisonSliderValue;
    return `inset(0 ${100 - percentage}% 0 0)`;
  }

  getRectangleClipPath(): string {
    // Calculate the clip path for image2 based on rectangle position
    // The rectangle is positioned at rectangleX% and rectangleY% (center position)
    // We need to clip image2 to show only the rectangle area at that position
    
    if (this.rectangleWrapperWidth === 0 || this.rectangleWrapperHeight === 0) {
      // If dimensions not set yet, use approximate values
      this.rectangleWrapperWidth = 1000;
      this.rectangleWrapperHeight = 600;
    }
    
    const x = this.rectangleX; // center X position in percentage
    const y = this.rectangleY; // center Y position in percentage
    
    // Calculate half-size in percentage
    const halfWidthPercent = (this.rectangleSize / this.rectangleWrapperWidth) * 50;
    const halfHeightPercent = (this.rectangleSize / this.rectangleWrapperHeight) * 50;
    
    // Calculate clip-path insets (top, right, bottom, left)
    const top = Math.max(0, y - halfHeightPercent);
    const right = Math.max(0, 100 - x - halfWidthPercent);
    const bottom = Math.max(0, 100 - y - halfHeightPercent);
    const left = Math.max(0, x - halfWidthPercent);
    
    return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
  }

  // Rectangle overlay drag handlers
  onRectangleDragStart(event: MouseEvent): void {
    event.stopPropagation();
    const rectangle = (event.currentTarget as HTMLElement);
    const wrapper = rectangle.closest('.comparison-image-wrapper') as HTMLElement;
    if (!wrapper) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const rect = rectangle.getBoundingClientRect();
    
    // Store wrapper dimensions for clip-path calculation
    this.rectangleWrapperWidth = wrapperRect.width;
    this.rectangleWrapperHeight = wrapperRect.height;
    
    // Calculate initial offset from mouse to rectangle center
    this.rectangleDragStartX = event.clientX - (rect.left + rect.width / 2);
    this.rectangleDragStartY = event.clientY - (rect.top + rect.height / 2);
    this.isDraggingRectangle = true;

    // Set up mouse move and mouse up listeners
    const mouseMoveListener = (moveEvent: MouseEvent) => {
      if (this.isDraggingRectangle) {
        const newX = moveEvent.clientX - wrapperRect.left - this.rectangleDragStartX;
        const newY = moveEvent.clientY - wrapperRect.top - this.rectangleDragStartY;
        
        // Calculate percentage positions
        const xPercent = (newX / wrapperRect.width) * 100;
        const yPercent = (newY / wrapperRect.height) * 100;
        
        // Constrain to wrapper bounds
        const halfWidthPercent = (this.rectangleSize / wrapperRect.width) * 50;
        const halfHeightPercent = (this.rectangleSize / wrapperRect.height) * 50;
        
        this.rectangleX = Math.max(halfWidthPercent, Math.min(100 - halfWidthPercent, xPercent));
        this.rectangleY = Math.max(halfHeightPercent, Math.min(100 - halfHeightPercent, yPercent));
        
        // Update wrapper dimensions in case of resize
        this.rectangleWrapperWidth = wrapperRect.width;
        this.rectangleWrapperHeight = wrapperRect.height;
        
        this.cdr.markForCheck();
        this.cdr.detectChanges();
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

  // Direct drag handlers for comparison slider
  onComparisonDragStart(event: MouseEvent): void {
    const wrapper = (event.currentTarget as HTMLElement);
    const rect = wrapper.getBoundingClientRect();
    
    // Update immediately on click
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    this.comparisonSliderValue = Math.max(0, Math.min(100, percentage));
    this.isDraggingComparison = true;
    
    // Set up mouse move and mouse up listeners
    const mouseMoveListener = (moveEvent: MouseEvent) => {
      if (this.isDraggingComparison) {
        const x = moveEvent.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        this.comparisonSliderValue = Math.max(0, Math.min(100, percentage));
        this.cdr.markForCheck();
        this.cdr.detectChanges();
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
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  /**
   * Test performance: Load images using presigned URLs (/image endpoint) vs proxied URLs
   */
  testPresignedUrlPerformance() {
    if (!this.picturesResponse) {
      alert('Please load camera pictures first!');
      return;
    }

    const timestamps = [...new Set([...this.picturesResponse.date1Photos || [], ...this.picturesResponse.date2Photos || []])];
    if (timestamps.length === 0) {
      alert('No timestamps available to test!');
      return;
    }

    // Reset metrics
    this.performanceMetrics.directS3 = null;
    this.performanceMetrics.proxied = null;
    this.cdr.detectChanges();

    // Test presigned URLs from /image endpoint (faster, proper S3 authentication)
    this.testPresignedUrls(timestamps);
    
    // Test proxied URLs after a delay (actually also uses /image endpoint, just for comparison)
    setTimeout(() => {
      this.testProxiedUrls(timestamps);
    }, 3000);
  }

  /**
   * Test presigned URLs from /image endpoint
   * These URLs look like: https://s3.ap-southeast-1.idrivee2.com/camera-pictures/upload/.../large/timestamp.jpg?[auth]
   */
  private testPresignedUrls(timestamps: string[]) {
    console.log('🧪 Testing Presigned URLs from /image endpoint...');
    const startTime = performance.now();
    let loadedCount = 0;
    const totalCount = timestamps.length;

    this.performanceMetrics.directS3 = {
      startTime,
      endTime: 0,
      duration: 0,
      loaded: 0
    };

    // Clear existing cache for these timestamps to force fresh fetch
    timestamps.forEach(timestamp => {
      const cacheKey = `${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;
      this.imageUrlCache.delete(cacheKey);
    });

    // Fetch presigned URLs and load images
    timestamps.forEach((timestamp, index) => {
      const url = `${getApiUrl('/api/camerapics-s3-test')}/image/${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;

      // Stagger requests slightly
      setTimeout(() => {
        this.http.get<{ url: string; key: string; expiresIn: number }>(url, { headers: this.getAuthHeaders() }).subscribe({
          next: (response) => {
            const presignedUrl = response.url;
            const cacheKey = `${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;
            this.imageUrlCache.set(cacheKey, presignedUrl);
            
            // Load the image
            const img = new Image();
            img.onload = () => {
              loadedCount++;
              
              if (loadedCount === totalCount) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                this.performanceMetrics.directS3 = {
                  startTime,
                  endTime,
                  duration,
                  loaded: loadedCount
                };
                console.log(`✅ Presigned URLs (/image endpoint): Loaded ${loadedCount}/${totalCount} images in ${duration.toFixed(2)}ms`);
                console.log(`   Average: ${(duration / loadedCount).toFixed(2)}ms per image`);
                this.cdr.detectChanges();
              }
            };
            
            img.onerror = () => {
              loadedCount++;
              console.warn(`❌ Presigned URL failed for ${timestamp}: ${presignedUrl}`);
              if (loadedCount === totalCount) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                this.performanceMetrics.directS3 = {
                  startTime,
                  endTime,
                  duration,
                  loaded: loadedCount
                };
                this.cdr.detectChanges();
              }
            };
            
            img.src = presignedUrl;
          },
          error: (err) => {
            loadedCount++;
            console.error(`Error fetching presigned URL for ${timestamp}:`, err);
            if (loadedCount === totalCount) {
              const endTime = performance.now();
              const duration = endTime - startTime;
              this.performanceMetrics.directS3 = {
                startTime,
                endTime,
                duration,
                loaded: loadedCount
              };
              this.cdr.detectChanges();
            }
          }
        });
      }, index * 50); // Stagger by 50ms
    });
  }

  private testProxiedUrls(timestamps: string[]) {
    console.log('🧪 Testing Proxied URLs (using same /image endpoint for comparison)...');
    const startTime = performance.now();
    let loadedCount = 0;
    const totalCount = timestamps.length;

    this.performanceMetrics.proxied = {
      startTime,
      endTime: 0,
      duration: 0,
      loaded: 0
    };

    // First, fetch all presigned URLs, then load images (simulating proxied behavior)
    const urlFetches = timestamps.map((timestamp, index) => {
      return new Promise<string | null>((resolve) => {
        const cacheKey = `${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;
        
        // If already cached, use it
        if (this.imageUrlCache.has(cacheKey)) {
          resolve(this.imageUrlCache.get(cacheKey)!);
          return;
        }
        
        // Fetch presigned URL from /image endpoint
        const url = `${getApiUrl('/api/camerapics-s3-test')}/image/${this.developerId}/${this.projectId}/${this.cameraId}/${timestamp}`;
        this.http.get<{ url: string; key: string; expiresIn: number }>(url, { headers: this.getAuthHeaders() }).subscribe({
          next: (response) => {
            this.imageUrlCache.set(cacheKey, response.url);
            resolve(response.url);
          },
          error: (err) => {
            console.warn(`Failed to fetch presigned URL for ${timestamp}:`, err);
            resolve(null);
          }
        });
      });
    });

    // Wait for all URLs to be fetched, then load images
    Promise.all(urlFetches).then((urls) => {
      urls.forEach((presignedUrl, index) => {
        if (!presignedUrl) {
          loadedCount++;
          this.checkProxiedTestComplete(startTime, totalCount, loadedCount);
          return;
        }
        
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          this.checkProxiedTestComplete(startTime, totalCount, loadedCount);
        };
        img.onerror = () => {
          loadedCount++;
          console.warn(`Failed to load image for ${timestamps[index]}`);
          this.checkProxiedTestComplete(startTime, totalCount, loadedCount);
        };
        
        // Stagger requests slightly
        setTimeout(() => {
          img.src = presignedUrl;
        }, index * 10);
      });
    });
  }

  private checkProxiedTestComplete(startTime: number, totalCount: number, loadedCount: number) {
    if (loadedCount === totalCount) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.performanceMetrics.proxied = {
        startTime,
        endTime,
        duration,
        loaded: loadedCount
      };
      console.log(`✅ Proxied URLs: Loaded ${loadedCount}/${totalCount} images in ${duration.toFixed(2)}ms`);
      console.log(`   Average: ${(duration / loadedCount).toFixed(2)}ms per image`);
      
      // Show performance comparison
      if (this.performanceMetrics.directS3 && this.performanceMetrics.proxied && this.performanceMetrics.proxied.duration > 0) {
        const speedup = ((this.performanceMetrics.proxied.duration - this.performanceMetrics.directS3.duration) / this.performanceMetrics.proxied.duration * 100).toFixed(1);
        console.log(`📊 Performance Comparison:`);
        console.log(`   Presigned URLs: ${this.performanceMetrics.directS3.duration.toFixed(2)}ms`);
        console.log(`   Proxied (comparison): ${this.performanceMetrics.proxied.duration.toFixed(2)}ms`);
        if (this.performanceMetrics.directS3.duration < this.performanceMetrics.proxied.duration) {
          console.log(`   ⚡ Speedup: ${speedup}% faster with presigned URLs!`);
        } else {
          console.log(`   ⚠️ Presigned URLs are ${speedup}% slower (possibly network/CORS issues)`);
        }
        
        // Force change detection to update UI
        this.cdr.detectChanges();
      }
    }
  }
}
