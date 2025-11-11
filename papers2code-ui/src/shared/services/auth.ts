// src/services/auth.ts
import { api, AuthenticationError } from './api';
import { API_BASE_URL, AUTH_API_PREFIX, CSRF_API_ENDPOINT } from './config';
import type { UserProfile } from '../types/user';
import { useState, useEffect } from 'react';

// Function to initiate GitHub login - simply redirect to backend endpoint
export const redirectToGitHubLogin = () => {
    // Always redirect to /dashboard after login
    const next = encodeURIComponent("/dashboard");
    window.location.href = `${API_BASE_URL}${AUTH_API_PREFIX}/github/login?next=${next}`;
};

// Function to initiate Google login - simply redirect to backend endpoint
export const redirectToGoogleLogin = () => {
    // Always redirect to /dashboard after login
    const next = encodeURIComponent("/dashboard");
    window.location.href = `${API_BASE_URL}${AUTH_API_PREFIX}/google/login?next=${next}`;
};

// Function to check current user status
export const checkCurrentUser = async (): Promise<UserProfile | null> => {
    // Check if user has ever logged in (localStorage flag)
    const hasSession = localStorage.getItem('has_session') === 'true';
    
    // If no session flag exists, skip the API call to avoid 401 errors in console
    if (!hasSession) {
        return null;
    }
    
    try { 
        // The API will now return camelCase, so no transformation needed here
        const response = await api.get<UserProfile>(`${AUTH_API_PREFIX}/me`);
        const output = response.data;
        
        if (output.id) {
            // Ensure session flag is set
            localStorage.setItem('has_session', 'true');
            return output;
        }
        
        return null;
    } catch (error: any) {
        if (error.response && error.response.status === 401) {
            // User not authenticated - clear session flag and return null
            localStorage.removeItem('has_session');
            return null;
        }
        console.error("Error checking current user:", error);
        throw error; // Re-throw other errors (network issues, etc.)
    }
};


// Function to log out
export const logoutUser = async (): Promise<void> => {
    try {
        // CSRF token is now handled by the Axios interceptor in api.ts
        const response = await api.post<{ message: string, csrfToken: string }>(`${AUTH_API_PREFIX}/logout`);
        
        // Backend returns a new CSRF token after logout - store it in memory
        if (response.data && response.data.csrfToken) {
            csrfTokenCache = response.data.csrfToken;
            console.log('✅ New CSRF token received after logout');
        }
    } catch (error) {
        console.error("Logout failed:", error);
        throw error; // Re-throw the error
    }
};

// In-memory storage for CSRF token (XSS-safe alternative to localStorage)
let csrfTokenCache: string | null = null;

/**
 * Get CSRF token from in-memory cache.
 * 
 * SECURITY: We store the token in memory instead of localStorage to prevent XSS attacks.
 * The token is also set as an HttpOnly cookie by the backend, which provides the
 * double-submit pattern for CSRF protection while being immune to XSS theft.
 * 
 * This approach:
 * - Prevents XSS attacks (no localStorage/cookie access from malicious scripts)
 * - Enables cross-domain requests (token sent in X-CSRFToken header)
 * - Works with HttpOnly cookies (backend validates cookie matches header)
 */
export const getCsrfToken = (): string | null => {
    return csrfTokenCache;
};

/**
 * Fetch CSRF token from backend and store it in memory.
 * 
 * The backend:
 * 1. Sets token as HttpOnly cookie (secure from XSS)
 * 2. Returns token in response body (for X-CSRFToken header)
 * 
 * We store the response body token in memory to send in request headers.
 * The HttpOnly cookie is automatically sent by the browser.
 * Backend validates both match for CSRF protection.
 * 
 * This function will retry up to 3 times if it fails to ensure reliability.
 */
export const fetchAndStoreCsrfToken = async (retryCount = 0): Promise<string | null> => {
    const MAX_RETRIES = 3;
    
    try {
        const response = await api.get<{ csrfToken: string }>(CSRF_API_ENDPOINT);

        if (response.data && response.data.csrfToken) {
            const token = response.data.csrfToken;
            
            // Store in memory only (XSS-safe)
            csrfTokenCache = token;
            
            console.log('✅ CSRF token fetched and cached in memory');
            return token;
        }
        
        console.warn('⚠️ CSRF token not found in response from', CSRF_API_ENDPOINT);
        
        // Retry if token not in response and we haven't exceeded retries
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying CSRF token fetch (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1))); // Exponential backoff
            return fetchAndStoreCsrfToken(retryCount + 1);
        }
        
        return null;
    } catch (error: any) {
        console.error('❌ Error fetching CSRF token:', error);
        
        // Retry on network errors
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying CSRF token fetch after error (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1))); // Exponential backoff
            return fetchAndStoreCsrfToken(retryCount + 1);
        }
        
        return null;
    } 
};

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const currentUser = await checkCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to verify user on mount:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  const login = () => {
    // ... login logic
  };

  const logout = () => {
    // ... logout logic
  };

  return { user, loading, login, logout };
}