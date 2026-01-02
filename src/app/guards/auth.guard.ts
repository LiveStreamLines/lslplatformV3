import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('Auth guard checking:', state.url, 'Authenticated:', authService.isAuthenticated());

  // Check if already authenticated
  if (authService.isAuthenticated()) {
    return true;
  }

  // Not authenticated - redirect to login
  console.log('Redirecting to login from:', state.url);
  router.navigate(['/login'], { 
    queryParams: { returnUrl: state.url },
    replaceUrl: true
  });
  return false;
};
