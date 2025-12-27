import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PROJECT_IMAGE, ICONS } from '../../constants/figma-assets';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css'
})
export class ProjectsComponent implements OnInit, OnChanges {
  @Input() selectedCategory: string = 'Dubai Hills Estate';
  viewMode: 'list' | 'map' = 'list';
  
  icons = ICONS;

  constructor(private router: Router) {}

  projects = [
    {
      id: 1,
      name: 'Hills Park',
      status: 'IN PROGRESS',
      image: PROJECT_IMAGE,
      daysCompleted: 862,
      totalDays: 1500,
      timeLapsActive: true
    },
    {
      id: 2,
      name: 'Hills Park',
      status: 'IN PROGRESS',
      image: PROJECT_IMAGE,
      daysCompleted: 862,
      totalDays: 1500,
      timeLapsActive: false
    },
    {
      id: 3,
      name: 'Hills Park',
      status: 'IN PROGRESS',
      image: PROJECT_IMAGE,
      daysCompleted: 862,
      totalDays: 1500,
      timeLapsActive: false
    },
    {
      id: 4,
      name: 'Hills Park',
      status: 'IN PROGRESS',
      image: PROJECT_IMAGE,
      daysCompleted: 862,
      totalDays: 1500,
      timeLapsActive: false
    },
    {
      id: 5,
      name: 'Hills Park',
      status: 'IN PROGRESS',
      image: PROJECT_IMAGE,
      daysCompleted: 862,
      totalDays: 1500,
      timeLapsActive: false
    }
  ];

  toggleView(mode: 'list' | 'map') {
    this.viewMode = mode;
  }

  getProgressPercentage(daysCompleted: number, totalDays: number): number {
    return (daysCompleted / totalDays) * 100;
  }

  navigateToProject(projectId: number) {
    this.router.navigate(['/project', projectId]);
  }

  ngOnInit() {
    // Initialize if needed
  }

  ngOnChanges() {
    // Update when category changes
  }
}

