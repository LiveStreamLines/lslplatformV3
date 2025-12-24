import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectsComponent } from '../projects/projects.component';

@Component({
  selector: 'app-community-projects',
  standalone: true,
  imports: [CommonModule, ProjectsComponent],
  templateUrl: './community-projects.component.html',
  styleUrl: './community-projects.component.css'
})
export class CommunityProjectsComponent implements OnInit, OnChanges {
  @Input() community: any = null;
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();

  selectedCategory = '';

  ngOnInit() {
    if (this.community) {
      this.selectedCategory = this.community.name;
    }
  }

  ngOnChanges() {
    if (this.community) {
      this.selectedCategory = this.community.name;
    }
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay-backdrop')) {
      this.onClose();
    }
  }
}

