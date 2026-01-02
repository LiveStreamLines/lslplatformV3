import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { getApiUrl } from '../config/api.config';

export interface LoginResponse {
  _id: string;
  email: string;
  name: string;
  role: string;
  authh: string; // JWT token
  [key: string]: any;
}

export interface LoginRequest {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private tokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<LoginResponse> {
    const loginUrl = getApiUrl('/api/auth/login');
    
    return this.http.post<LoginResponse>(loginUrl, { email, password }).pipe(
      tap(response => {
        if (response.authh) {
          this.setToken(response.authh);
          this.setUser(response);
        }
      }),
      catchError(error => {
        console.error('Login error:', error);
        throw error;
      })
    );
  }

  /**
   * Auto-login with default credentials
   */
  autoLogin(): Observable<boolean> {
    const email = 'amar@livestreamlines.com';
    const password = 'interQAZ@159';
    
    return this.login(email, password).pipe(
      map(() => true),
      catchError(error => {
        console.error('Auto-login failed:', error);
        return of(false);
      })
    );
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.tokenSubject.value;
  }

  /**
   * Set token and store it
   */
  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.tokenSubject.next(token);
  }

  /**
   * Get stored token from localStorage
   */
  private getStoredToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Store user data
   */
  private setUser(user: LoginResponse): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Get stored user data
   */
  getUser(): LoginResponse | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Check if user is authenticated
   * Validates that token exists and is not expired
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    
    // Basic token validation - check if it's a valid JWT format
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        // Invalid token format, clear it
        this.logout();
        return false;
      }
      
      // Decode payload to check expiration (basic check)
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp < now) {
        // Token expired, clear it
        this.logout();
        return false;
      }
      
      return true;
    } catch (error) {
      // Invalid token, clear it
      console.warn('Token validation error:', error);
      this.logout();
      return false;
    }
  }

  /**
   * Logout - clear token and user data
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.tokenSubject.next(null);
  }
}

