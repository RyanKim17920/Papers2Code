// Base URL for the backend API
// Uses environment variable in production, falls back to localhost in dev
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

// Common API route prefixes
export const AUTH_API_PREFIX = '/api/auth';
export const CSRF_API_ENDPOINT = '/api/auth/csrf-token';
export const PAPERS_API_PREFIX = '/api';
