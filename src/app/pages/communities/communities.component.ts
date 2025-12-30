import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CommunityProjectsComponent } from '../community-projects/community-projects.component';
import { CommunitiesService } from '../../services/communities.service';
import { Community } from '../../models/community.model';
import { COMMUNITY_IMAGES } from '../../constants/figma-assets';

@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [CommonModule, RouterModule, CommunityProjectsComponent],
  templateUrl: './communities.component.html',
  styleUrl: './communities.component.css'
})
export class CommunitiesComponent implements OnInit {
  selectedCommunity: Community | null = null;
  isOverlayOpen = false;
  communities: Community[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private communitiesService: CommunitiesService) {}

  ngOnInit() {
    this.loadCommunities();
  }

  loadCommunities() {
    this.isLoading = true;
    this.error = null;

    this.communitiesService.getCommunities().subscribe({
      next: (data) => {
        // Map API response to include image URLs from local assets as fallback
        this.communities = data.map(community => ({
          ...community,
          // If API doesn't provide image URL, use local asset mapping
          image: community.image || COMMUNITY_IMAGES[community.name as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '',
          // Set default projectCount if not provided (you may want to fetch this separately)
          projectCount: community.projectCount || 0
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading communities:', err);
        this.error = 'Failed to load communities. Please try again later.';
        this.isLoading = false;
        
        // Fallback to local data if API fails (for development)
        this.loadFallbackData();
      }
    });
  }

  private loadFallbackData() {
    // Fallback data in case API is not available
    this.communities = [
      {
        id: '1',
        name: 'Dubai Hills Estate',
        projectCount: 21,
        image: COMMUNITY_IMAGES['Dubai Hills Estate'],
        gradient: 'purple'
      },
      {
        id: '2',
        name: 'Dubai Creek Harbour',
        projectCount: 12,
        image: COMMUNITY_IMAGES['Dubai Creek Harbour'],
        gradient: 'blue'
      },
      {
        id: '3',
        name: 'Downtown Dubai',
        projectCount: 1,
        image: COMMUNITY_IMAGES['Downtown Dubai'],
        gradient: 'blue'
      },
      {
        id: '4',
        name: 'Emaar Beachfront',
        projectCount: 4,
        image: COMMUNITY_IMAGES['Emaar Beachfront'],
        gradient: 'green'
      },
      {
        id: '5',
        name: 'Rashid Yachts and Marina',
        projectCount: 9,
        image: COMMUNITY_IMAGES['Rashid Yachts and Marina'],
        gradient: 'blue'
      },
      {
        id: '6',
        name: 'Dubai Marina',
        projectCount: 2,
        image: COMMUNITY_IMAGES['Dubai Marina'],
        gradient: 'blue'
      }
    ];
  }

  onCommunityClick(community: Community) {
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

  retry() {
    this.loadCommunities();
  }
}

