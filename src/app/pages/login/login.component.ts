import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  email: string = 'amar@livestreamlines.com';
  password: string = 'interQAZ@159';
  isLoading: boolean = false;
  error: string | null = null;
  showPassword: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('Login component initialized');
    // If already authenticated, redirect to communities
    if (this.authService.isAuthenticated()) {
      console.log('Already authenticated, redirecting to communities');
      this.router.navigate(['/communities']);
    } else {
      console.log('Not authenticated, showing login form');
    }
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.error = 'Please enter both email and password';
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.authh) {
          // Login successful, redirect to communities
          this.router.navigate(['/communities']);
        } else {
          this.error = 'Login failed: No token received';
        }
      },
      error: (err) => {
        this.isLoading = false;
        if (err.error && err.error.msg) {
          this.error = err.error.msg;
        } else {
          this.error = 'Login failed. Please check your credentials.';
        }
        console.error('Login error:', err);
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}
