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
    try { 
        // The API will now return camelCase, so no transformation needed here
        const response = await api.get<UserProfile>(`${AUTH_API_PREFIX}/me`);
        const output = response.data;
        return output.id ? output : null; // Directly return data as UserProfile
    } catch (error: any) {
        if (error.response && error.response.status === 401) {
            throw new AuthenticationError('User not authenticated or session expired.');
        }
        console.error("Error checking current user:", error);
        throw error; // Re-throw other errors as well
    }
};


// Function to log out
export const logoutUser = async (): Promise<void> => {
    try {
        // CSRF token is now handled by the Axios interceptor in api.ts
        await api.post<{ message: string, csrfToken: string }>(`${AUTH_API_PREFIX}/logout`);
    } catch (error) {
        console.error("Logout failed:", error);
        throw error; // Re-throw the error
    }
};

/**
 * Get CSRF token from multiple sources (fallback chain for cross-domain compatibility)
 * Priority:
 * 1. localStorage (most reliable for cross-domain)
 * 2. Cookie (for same-domain scenarios)
 */
export const getCsrfToken = (): string | null => {
    // First, try localStorage (most reliable for cross-domain)
    const storedToken = localStorage.getItem('csrfToken');
    if (storedToken) {
        return storedToken;
    }

    // Fallback: Try reading from cookie (works for same-domain)
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrf_token_cookie') {
            const token = decodeURIComponent(value);
            // Store in localStorage for future use
            localStorage.setItem('csrfToken', token);
            return token;
        }
    }
    
    return null;
};

/**
 * Fetch CSRF token from backend and store it locally.
 * The backend sets it as a cookie AND returns it in the response body.
 * We store it in localStorage for reliable cross-domain access.
 */
export const fetchAndStoreCsrfToken = async (): Promise<string | null> => {
    try {
        const response = await api.get<{ csrfToken: string }>(CSRF_API_ENDPOINT);

        if (response.data && response.data.csrfToken) {
            const token = response.data.csrfToken;
            
            // Store in localStorage for reliable cross-domain access
            localStorage.setItem('csrfToken', token);
            
            console.log('✅ CSRF token fetched and stored successfully');
            return token;
        }
        
        console.warn('⚠️ CSRF token not found in response from', CSRF_API_ENDPOINT);
        return null;
    } catch (error: any) {
        console.error('❌ Error fetching CSRF token:', error);
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