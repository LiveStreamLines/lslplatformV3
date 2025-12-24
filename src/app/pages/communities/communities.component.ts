import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CommunityProjectsComponent } from '../community-projects/community-projects.component';
import { COMMUNITY_IMAGES } from '../../constants/figma-assets';

@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [CommonModule, RouterModule, CommunityProjectsComponent],
  templateUrl: './communities.component.html',
  styleUrl: './communities.component.css'
})
export class CommunitiesComponent {
  selectedCommunity: any = null;
  isOverlayOpen = false;

  communities = [
    {
      id: 1,
      name: 'Dubai Hills Estate',
      projectCount: 21,
      image: COMMUNITY_IMAGES['Dubai Hills Estate'],
      gradient: 'purple'
    },
    {
      id: 2,
      name: 'Dubai Creek Harbour',
      projectCount: 12,
      image: COMMUNITY_IMAGES['Dubai Creek Harbour'],
      gradient: 'blue'
    },
    {
      id: 3,
      name: 'Downtown Dubai',
      projectCount: 1,
      image: COMMUNITY_IMAGES['Downtown Dubai'],
      gradient: 'blue'
    },
    {
      id: 4,
      name: 'Emaar Beachfront',
      projectCount: 4,
      image: COMMUNITY_IMAGES['Emaar Beachfront'],
      gradient: 'green'
    },
    {
      id: 5,
      name: 'Rashid Yachts and Marina',
      projectCount: 9,
      image: COMMUNITY_IMAGES['Rashid Yachts and Marina'],
      gradient: 'blue'
    },
    {
      id: 6,
      name: 'Dubai Marina',
      projectCount: 2,
      image: COMMUNITY_IMAGES['Dubai Marina'],
      gradient: 'blue'
    }
  ];

  onCommunityClick(community: any) {
    this.selectedCommunity = community;
    this.isOverlayOpen = true;
  }

  onCloseOverlay() {
    this.isOverlayOpen = false;
    // Keep selectedCommunity for smooth transition
    setTimeout(() => {
      this.selectedCommunity = null;
    }, 400);
  }
}

