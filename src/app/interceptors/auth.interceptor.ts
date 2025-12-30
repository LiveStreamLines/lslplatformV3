import { HttpInterceptorFn } from '@angular/common/http';
import { AUTH_TOKEN } from '../config/api.config';

/**
 * HTTP Interceptor to add Authorization header to all API requests
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add token to requests going to our backend
  if (req.url.includes('lsl-platform.com/backend')) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${AUTH_TOKEN}`
      }
    });
    return next(authReq);
  }
  
  return next(req);
};

