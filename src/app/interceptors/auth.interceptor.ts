import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * HTTP Interceptor to add Authorization header to all API requests
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add token to requests going to our backend
  if (req.url.includes('lsl-platform.com/backend') || req.url.includes('/api/')) {
    const authService = inject(AuthService);
    const token = authService.getToken();
    
    if (token) {
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return next(authReq);
    }
  }
  
  return next(req);
};

