import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { PROJECT_IMAGE } from '../../constants/figma-assets';

@Component({
  selector: 'app-camera-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './camera-detail.component.html',
  styleUrl: './camera-detail.component.css'
})
export class CameraDetailComponent implements OnInit {
  cameraId: string | null = null;
  cameraName = 'Camera 1';
  cameraStatus: 'Active' | 'Error' | 'Maintenance' = 'Active';
  selectedDate = '20-Dec-2025';
  selectedTime = '14:52:37';
  humidity = '50%';
  temperature = '24°C';
  currentImageIndex = 0;
  
  images = [
    PROJECT_IMAGE,
    PROJECT_IMAGE,
    PROJECT_IMAGE,
    PROJECT_IMAGE,
    PROJECT_IMAGE
  ];

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.cameraId = this.route.snapshot.paramMap.get('cameraId');
    // Load camera data based on ID
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
