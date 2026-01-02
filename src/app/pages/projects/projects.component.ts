import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PROJECT_IMAGE, ICONS } from '../../constants/figma-assets';
import { ProjectsService } from '../../services/projects.service';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css'
})
export class ProjectsComponent implements OnInit, OnChanges {
  @Input() selectedCategory: string = 'Dubai Hills Estate';
  @Input() developerId: string = '';
  viewMode: 'list' | 'map' = 'list';
  
  icons = ICONS;
  projects: Project[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(
    private router: Router,
    private projectsService: ProjectsService
  ) {}

  toggleView(mode: 'list' | 'map') {
    this.viewMode = mode;
  }

  getProgressPercentage(daysCompleted: number = 0, totalDays: number = 0): number {
    if (totalDays === 0) return 0;
    return (daysCompleted / totalDays) * 100;
  }

  navigateToProject(projectId: string) {
    this.router.navigate(['/project', projectId]);
  }

  navigateToAllProjects() {
    // Navigate to communities page to show all projects
    this.router.navigate(['/communities']);
  }

  ngOnInit() {
    if (this.developerId) {
      this.loadProjects();
    }
  }

  ngOnChanges() {
    if (this.developerId) {
      this.loadProjects();
    }
  }

  private loadProjects() {
    if (!this.developerId) {
      this.projects = [];
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.projectsService.getProjectsByDeveloperId(this.developerId).subscribe({
      next: (projects) => {
        // Use project image or fallback to default
        this.projects = projects.map(project => ({
          ...project,
          image: project.image || PROJECT_IMAGE
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading projects:', err);
        this.error = 'Failed to load projects. Please try again later.';
        this.isLoading = false;
        this.projects = [];
      }
    });
  }
}

