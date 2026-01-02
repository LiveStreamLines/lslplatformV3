import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { USER_AVATAR, NAV_ICONS } from '../../constants/figma-assets';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {
  currentUser = {
    name: 'Amar Omer',
    role: 'Client Admin',
    avatar: USER_AVATAR
  };

  lslLogo = 'assets/images/lsl.svg';
  chevronIcon = 'assets/images/icons/chevron-down.svg';
  searchIcon = NAV_ICONS.search;
  navIcons = NAV_ICONS;
  
  navItems = [
    { label: 'Clients', route: '/communities', iconKey: 'home', active: false },
    { label: 'Monitor', route: '/monitor', iconKey: 'monitor', active: false },
    { label: 'Chat', route: '/chat', iconKey: 'chat', active: false },
    { label: 'Contact', route: '/contact', iconKey: 'contact', active: false },
    { label: 'Settings', route: '/settings', iconKey: 'settings', active: false }
  ];

  getIconUrl(iconKey: string, isActive: boolean): string {
    const icon = this.navIcons[iconKey as keyof typeof NAV_ICONS];
    if (typeof icon === 'string') {
      return icon; // For search icon
    }
    return isActive ? icon.filled : icon.outline;
  }

  constructor(private router: Router) {}

  ngOnInit() {
    // Update active state based on current route
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateActiveState(event.url);
      });

    // Set initial active state
    this.updateActiveState(this.router.url);
  }

  private updateActiveState(url: string) {
    this.navItems.forEach(item => {
      // Home (communities) is active for root path or /communities
      if (item.route === '/communities') {
        item.active = url === '/' || url === '/communities' || url.startsWith('/communities/');
      } else {
        item.active = url === item.route || url.startsWith(item.route + '/');
      }
    });
  }
}

