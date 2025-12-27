import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PROJECT_IMAGE } from '../../constants/figma-assets';

interface Camera {
  id: number;
  name: string;
  image: string;
  thumbnail?: string;
  status: 'Active' | 'Error' | 'Maintenance';
  installedDate: string;
  lastPhotoDate: string;
  lastPhotoTime?: string;
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css'
})
export class ProjectDetailComponent implements OnInit {
  projectName = 'GOLF GRAND';
  communityName = 'Dubai Hills Estate';
  daysCompleted = 696;
  totalDays = 1500;
  progressPercentage = 55;
  bannerImage = PROJECT_IMAGE;
  
  activeTab: 'timelaps' | 'live' | 'satellite' | 'gallery' = 'timelaps';
  viewMode: 'list' | 'map' | 'slideshow' = 'list';
  
  cameras: Camera[] = [
    {
      id: 1,
      name: 'Camera 1',
      image: PROJECT_IMAGE,
      thumbnail: PROJECT_IMAGE,
      status: 'Active',
      installedDate: '08/07/2024',
      lastPhotoDate: '20-Dec-2025',
      lastPhotoTime: '14:52:37'
    },
    {
      id: 2,
      name: 'Camera 1',
      image: PROJECT_IMAGE,
      thumbnail: PROJECT_IMAGE,
      status: 'Active',
      installedDate: '08/07/2024',
      lastPhotoDate: '20-Dec-2025',
      lastPhotoTime: '14:52:37'
    },
    {
      id: 3,
      name: 'Camera 1',
      image: PROJECT_IMAGE,
      thumbnail: PROJECT_IMAGE,
      status: 'Active',
      installedDate: '08/07/2024',
      lastPhotoDate: '20-Dec-2025',
      lastPhotoTime: '14:52:37'
    },
    {
      id: 4,
      name: 'Camera 1',
      image: PROJECT_IMAGE,
      thumbnail: PROJECT_IMAGE,
      status: 'Error',
      installedDate: '08/07/2024',
      lastPhotoDate: '20-Dec-2025',
      lastPhotoTime: '14:52:37'
    },
    {
      id: 5,
      name: 'Camera 1',
      image: PROJECT_IMAGE,
      thumbnail: PROJECT_IMAGE,
      status: 'Active',
      installedDate: '08/07/2024',
      lastPhotoDate: '20-Dec-2025',
      lastPhotoTime: '14:52:37'
    },
    {
      id: 6,
      name: 'Camera 1',
      image: PROJECT_IMAGE,
      thumbnail: PROJECT_IMAGE,
      status: 'Maintenance',
      installedDate: '08/07/2024',
      lastPhotoDate: '20-Dec-2025',
      lastPhotoTime: '14:52:37'
    }
  ];

  hoveredCameraId: number | null = null;
  quickViewCamera: Camera | null = null;
  isQuickViewOpen = false;
  currentCameraIndex: number = 0;

  ngOnInit() {
    this.progressPercentage = Math.round((this.daysCompleted / this.totalDays) * 100);
  }

  setActiveTab(tab: 'timelaps' | 'live' | 'satellite' | 'gallery') {
    this.activeTab = tab;
  }

  setViewMode(mode: 'list' | 'map' | 'slideshow') {
    this.viewMode = mode;
  }

  onCameraHover(cameraId: number) {
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
    const progressPercentage = (this.daysCompleted / this.totalDays);
    return progressPercentage * 220;
  }
}

