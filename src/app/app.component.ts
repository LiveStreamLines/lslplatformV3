import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ColorPickerComponent } from './components/color-picker/color-picker.component';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ColorPickerComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Time Laps';
  isLoginPage = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Track current route to hide header on login page
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.isLoginPage = event.url.includes('/login');
    });

    // Check initial route
    this.isLoginPage = this.router.url.includes('/login');

    // Auto-login on app initialization if not authenticated
    if (!this.authService.isAuthenticated()) {
      this.authService.autoLogin().subscribe({
        next: (success) => {
          if (success) {
            console.log('Auto-login successful');
          } else {
            console.warn('Auto-login failed');
          }
        },
        error: (error) => {
          console.error('Auto-login error:', error);
        }
      });
    }
  }
}
