import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ColorPickerComponent } from './components/color-picker/color-picker.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ColorPickerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Time Laps';

  constructor(private authService: AuthService) {}

  ngOnInit() {
    // Auto-login if no token is stored
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
