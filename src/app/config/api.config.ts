/**
 * API Configuration
 */
export const API_CONFIG = {
  baseUrl: 'https://lsl-platform.com/backend',
  endpoints: {
    developers: '/api/developers',
    communities: '/api/communities',
    projects: '/api/projects',
    cameras: '/api/cameras'
  }
};

/**
 * Authentication Token
 * @deprecated Token is now managed by AuthService. Use AuthService.getToken() instead.
 * This constant is kept for backward compatibility but should not be used directly.
 */
export const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFtYXJAbGl2ZXN0cmVhbWxpbmVzLmNvbSIsInJvbGUiOiJTdXBlciBBZG1pbiIsImlhdCI6MTc2Njk5MDU5MSwiZXhwIjoxNzY3MDc2OTkxfQ.1Fbn3_OnbvC3SbtHsjtCQB5sVESWty2pW810CD-7OA0';

/**
 * Helper function to build full API URLs
 */
export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`;
}

