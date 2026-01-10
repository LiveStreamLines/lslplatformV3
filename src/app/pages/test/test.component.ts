import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommunitiesService } from '../../services/communities.service';
import { ProjectsService } from '../../services/projects.service';
import { CamerasService } from '../../services/cameras.service';
import { CameraPicsService } from '../../services/camera-pics.service';
import { CameraPicsCacheService } from '../../services/camera-pics-cache.service';
import { Community, DeveloperApiResponse } from '../../models/community.model';
import { Project } from '../../models/project.model';
import { Camera } from '../../models/camera.model';
import { API_CONFIG } from '../../config/api.config';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './test.component.html',
  styleUrl: './test.component.css'
})
export class TestComponent implements OnInit {
  developers: Community[] = [];
  projects: Project[] = [];
  cameras: Camera[] = [];
  
  selectedDeveloperId: string = '';
  selectedProjectId: string = '';
  selectedCameraId: string = '';
  selectedDate: string = '';
  
  availableDates: Set<string> = new Set(); // Set of dates (YYYY-MM-DD) that have images
  images: string[] = [];
  imageTimestamps: string[] = []; // Store timestamps for preloading
  loadedImages: Set<string> = new Set(); // Track which images are loaded
  isLoading: boolean = false;
  isLoadingDates: boolean = false;
  loadedImageCount: number = 0;
  totalImageCount: number = 0;
  
  developerTag: string = '';
  projectTag: string = '';
  cameraTag: string = '';
  
  // Image preloading
  private imagePreloadQueue: HTMLImageElement[] = [];
  private readonly BATCH_SIZE = 5; // Load 5 images at a time
  private readonly PRELOAD_DELAY = 100; // Delay between batches (ms)

  constructor(
    private http: HttpClient,
    private communitiesService: CommunitiesService,
    private projectsService: ProjectsService,
    private camerasService: CamerasService,
    private cameraPicsService: CameraPicsService,
    private cacheService: CameraPicsCacheService
  ) {}

  ngOnInit() {
    this.loadDevelopers();
  }

  loadDevelopers() {
    this.communitiesService.getCommunities().subscribe({
      next: (communities) => {
        this.developers = communities;
      },
      error: (err) => {
        console.error('Error loading developers:', err);
      }
    });
  }

  onDeveloperChange() {
    this.selectedProjectId = '';
    this.selectedCameraId = '';
    this.selectedDate = '';
    this.projects = [];
    this.cameras = [];
    this.availableDates.clear();
    this.images = [];
    
    if (!this.selectedDeveloperId) return;

    // Get developer tag
    this.http.get<DeveloperApiResponse>(`${API_CONFIG.baseUrl}/api/developers/${this.selectedDeveloperId}`).subscribe({
      next: (developer) => {
        this.developerTag = developer.developerTag || '';
        this.loadProjects();
      },
      error: (err) => {
        console.error('Error loading developer tag:', err);
      }
    });
  }

  loadProjects() {
    if (!this.selectedDeveloperId) return;

    this.projectsService.getProjectsByDeveloperId(this.selectedDeveloperId).subscribe({
      next: (projects) => {
        this.projects = projects;
      },
      error: (err) => {
        console.error('Error loading projects:', err);
      }
    });
  }

  onProjectChange() {
    this.selectedCameraId = '';
    this.selectedDate = '';
    this.cameras = [];
    this.availableDates.clear();
    this.images = [];
    
    if (!this.selectedProjectId) return;

    // Get project tag
    this.projectsService.getProjectById(this.selectedProjectId).subscribe({
      next: (project) => {
        this.projectTag = project.projectTag || '';
        this.loadCameras();
      },
      error: (err) => {
        console.error('Error loading project tag:', err);
      }
    });
  }

  loadCameras() {
    if (!this.selectedProjectId) return;

    this.camerasService.getCamerasByProjectId(this.selectedProjectId).subscribe({
      next: (cameras) => {
        this.cameras = cameras;
        if (cameras.length > 0) {
          // Auto-select first camera and load dates
          this.selectedCameraId = cameras[0].id;
          this.onCameraChange();
        }
      },
      error: (err) => {
        console.error('Error loading cameras:', err);
      }
    });
  }

  onCameraChange() {
    this.selectedDate = '';
    this.availableDates.clear();
    this.images = [];
    
    if (!this.selectedCameraId) return;

    const camera = this.cameras.find(c => c.id === this.selectedCameraId);
    if (!camera) return;

    this.cameraTag = camera.camera || '';
    this.loadAvailableDates();
  }

  loadAvailableDates() {
    if (!this.developerTag || !this.projectTag || !this.cameraTag) return;

    this.isLoadingDates = true;
    this.availableDates.clear();

    // Use the new optimized endpoint to get all available dates in one call
    this.cameraPicsService.getAvailableDates(this.developerTag, this.projectTag, this.cameraTag).subscribe({
      next: (response) => {
        // Convert array to Set for efficient lookup
        this.availableDates = new Set(response.availableDates || []);
        this.isLoadingDates = false;
      },
      error: (err) => {
        console.error('Error loading available dates:', err);
        this.isLoadingDates = false;
      }
    });
  }

  onDateSelect(date: string) {
    if (!this.availableDates.has(date)) return;

    this.selectedDate = date;
    this.loadImagesForDate(date);
    
    // Preload images for adjacent dates in the background
    this.preloadAdjacentDates(date);
  }

  /**
   * Preload images for dates adjacent to the selected date
   * This improves performance when user navigates to nearby dates
   */
  private preloadAdjacentDates(selectedDate: string) {
    const dateArray = Array.from(this.availableDates).sort();
    const currentIndex = dateArray.indexOf(selectedDate);
    
    if (currentIndex === -1) return;

    // Preload next 2 dates
    const nextDates = dateArray.slice(currentIndex + 1, currentIndex + 3);
    nextDates.forEach(date => {
      setTimeout(() => this.preloadDateImages(date), 1000); // Delay to not interfere with current loading
    });

    // Preload previous 2 dates
    const prevDates = dateArray.slice(Math.max(0, currentIndex - 2), currentIndex).reverse();
    prevDates.forEach(date => {
      setTimeout(() => this.preloadDateImages(date), 1500);
    });
  }

  /**
   * Preload images for a specific date (background task)
   */
  private preloadDateImages(date: string) {
    if (!this.developerTag || !this.projectTag || !this.cameraTag || !date) return;

    const dateStr = date.replace(/-/g, '');
    
    this.cameraPicsService.getCameraPictures(this.developerTag, this.projectTag, this.cameraTag, dateStr, dateStr).subscribe({
      next: (response) => {
        const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        
        // Preload first 3 images only (to save bandwidth)
        allPhotos.slice(0, 3).forEach(timestamp => {
          const imageUrl = this.cameraPicsService.getProxiedImageUrl(
            this.developerTag,
            this.projectTag,
            this.cameraTag,
            timestamp
          );
          
          const img = new Image();
          img.src = imageUrl;
          // Silent preload - no error handling needed
        });
      },
      error: () => {
        // Silent fail for background preloading
      }
    });
  }

  loadImagesForDate(date: string) {
    if (!this.developerTag || !this.projectTag || !this.cameraTag || !date) {
      console.warn('Cannot load images: missing required data', {
        developerTag: this.developerTag,
        projectTag: this.projectTag,
        cameraTag: this.cameraTag,
        date: date
      });
      return;
    }

    // Check cache first
    const cached = this.cacheService.getDateImages(this.developerTag, this.projectTag, this.cameraTag, date);
    
    if (cached) {
      console.log('Loading images from cache for date:', date);
      this.images = cached.imageUrls;
      this.imageTimestamps = cached.timestamps;
      this.totalImageCount = cached.timestamps.length;
      this.loadedImageCount = cached.timestamps.length; // Assume all cached images are loaded
      this.isLoading = false;
      
      // Mark all cached images as loaded
      cached.imageUrls.forEach(url => this.loadedImages.add(url));
      
      // Still preload to ensure browser cache is warm
      this.preloadImagesProgressive();
      return;
    }

    // Clear previous preload queue
    this.clearPreloadQueue();

    this.isLoading = true;
    this.images = [];
    this.imageTimestamps = [];
    this.loadedImages.clear();
    this.loadedImageCount = 0;
    this.totalImageCount = 0;

    // Convert date from YYYY-MM-DD to YYYYMMDD
    const dateStr = date.replace(/-/g, '');
    console.log('Loading images from API for date:', date, 'Formatted:', dateStr);

    // Get images for this date using the camera pics service with date filter
    this.cameraPicsService.getCameraPictures(this.developerTag, this.projectTag, this.cameraTag, dateStr, dateStr).subscribe({
      next: (response) => {
        console.log('Received response:', response);
        
        // Combine and deduplicate photos
        const allPhotos = [...new Set([...response.date1Photos, ...response.date2Photos])];
        console.log('Total photos found:', allPhotos.length);
        
        if (allPhotos.length === 0) {
          this.isLoading = false;
          return;
        }

        // Store timestamps
        this.imageTimestamps = allPhotos;
        this.totalImageCount = allPhotos.length;
        
        // Convert timestamps to image URLs
        this.images = allPhotos.map(timestamp => 
          this.cameraPicsService.getProxiedImageUrl(this.developerTag, this.projectTag, this.cameraTag, timestamp)
        );
        
        console.log('Image URLs generated:', this.images.length);
        
        // Cache the results
        this.cacheService.setDateImages(
          this.developerTag,
          this.projectTag,
          this.cameraTag,
          date,
          allPhotos,
          this.images
        );
        console.log('Images cached for date:', date);
        
        // Start progressive preloading
        this.preloadImagesProgressive();
        
        // Mark loading as complete (images will load progressively)
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading images:', err);
        this.isLoading = false;
        this.images = [];
        this.imageTimestamps = [];
      }
    });
  }

  /**
   * Preload images progressively in batches
   * This improves perceived performance by loading images in the background
   */
  private preloadImagesProgressive() {
    if (this.imageTimestamps.length === 0) return;

    let currentIndex = 0;

    const loadBatch = () => {
      const batchEnd = Math.min(currentIndex + this.BATCH_SIZE, this.imageTimestamps.length);
      
      for (let i = currentIndex; i < batchEnd; i++) {
        const timestamp = this.imageTimestamps[i];
        const imageUrl = this.cameraPicsService.getProxiedImageUrl(
          this.developerTag,
          this.projectTag,
          this.cameraTag,
          timestamp
        );

        // Preload image
        const img = new Image();
        img.src = imageUrl;
        
        img.onload = () => {
          this.loadedImages.add(imageUrl);
          this.loadedImageCount++;
          console.log(`Preloaded image ${this.loadedImageCount}/${this.totalImageCount}`);
        };

        img.onerror = () => {
          console.warn(`Failed to preload image: ${imageUrl}`);
          // Still count as "loaded" to avoid infinite retries
          this.loadedImages.add(imageUrl);
          this.loadedImageCount++;
        };

        this.imagePreloadQueue.push(img);
      }

      currentIndex = batchEnd;

      // Continue loading next batch if there are more images
      if (currentIndex < this.imageTimestamps.length) {
        setTimeout(loadBatch, this.PRELOAD_DELAY);
      }
    };

    // Start loading first batch immediately
    loadBatch();
  }

  /**
   * Clear preload queue
   */
  private clearPreloadQueue() {
    this.imagePreloadQueue.forEach(img => {
      img.src = ''; // Cancel loading
    });
    this.imagePreloadQueue = [];
  }

  /**
   * Check if an image is preloaded
   */
  isImagePreloaded(imageUrl: string): boolean {
    return this.loadedImages.has(imageUrl);
  }

  /**
   * Get loading progress percentage
   */
  getLoadingProgress(): number {
    if (this.totalImageCount === 0) return 0;
    return Math.round((this.loadedImageCount / this.totalImageCount) * 100);
  }

  /**
   * Check if a date's images are cached
   */
  isCached(date: string): boolean {
    if (!this.developerTag || !this.projectTag || !this.cameraTag || !date) return false;
    return this.cacheService.hasDateImages(this.developerTag, this.projectTag, this.cameraTag, date);
  }

  isDateAvailable(date: Date): boolean {
    const dateStr = this.formatDate(date);
    return this.availableDates.has(dateStr);
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getCalendarDays(): Date[] {
    const days: Date[] = [];
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1); // 3 months back
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of next month

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return days;
  }

  getMonthName(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getDaysInMonth(date: Date): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add empty cells for days before the first day of the month
    const firstDayOfWeek = firstDay.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(new Date(year, month, -i)); // Placeholder dates
    }

    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }

  getMonths(): Date[] {
    const months: Date[] = [];
    const today = new Date();
    
    for (let i = -2; i <= 1; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push(date);
    }

    return months;
  }

  onImageError(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
      console.error('Failed to load image:', target.src);
    }
  }

  onImageLoad(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.opacity = '1';
      // Mark as loaded if not already
      if (target.src) {
        this.loadedImages.add(target.src);
      }
    }
  }
}

