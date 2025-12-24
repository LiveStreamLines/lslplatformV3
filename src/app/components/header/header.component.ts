import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { USER_AVATAR, EMAAR_LOGO, NAV_ICONS } from '../../constants/figma-assets';

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

  emaarLogo = EMAAR_LOGO;
  searchIcon = NAV_ICONS.search;
  
  navItems = [
    { label: 'Home', route: '/communities', icon: NAV_ICONS.home, active: false },
    { label: 'Projects', route: '/projects', icon: NAV_ICONS.home, active: false },
    { label: 'Monitor', route: '/monitor', icon: NAV_ICONS.monitor, active: false },
    { label: 'Chat', route: '/chat', icon: NAV_ICONS.chat, active: false },
    { label: 'Contact', route: '/contact', icon: NAV_ICONS.contact, active: false },
    { label: 'Settings', route: '/settings', icon: NAV_ICONS.settings, active: false }
  ];

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

