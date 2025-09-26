// src/services/auth.ts
import { api, AuthenticationError } from './api';
import { API_BASE_URL, AUTH_API_PREFIX, CSRF_API_ENDPOINT } from './config';
import type { UserProfile } from '../types/user';
import { useState, useEffect } from 'react';

// Function to initiate login - simply redirect to backend endpoint
export const redirectToGitHubLogin = () => {
    // Always redirect to /dashboard after login
    const next = encodeURIComponent("/dashboard");
    window.location.href = `${API_BASE_URL}${AUTH_API_PREFIX}/github/login?next=${next}`;
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
export const logoutUser = async (currentPage?: string): Promise<string | null> => {
    try {
        // Send current page information to backend for redirect logic
        const requestBody = currentPage ? { currentPage } : {};
        
        const response = await api.post<{ 
            message: string, 
            csrfToken: string,
            redirectTo?: string 
        }>(`${AUTH_API_PREFIX}/logout`, requestBody);
        
        // Return the redirect path suggested by backend, or null if no redirect needed
        return response.data.redirectTo || null;
    } catch (error) {
        console.error("Logout failed:", error);
        throw error; // Re-throw the error
    }
};

// --- NEW: Helper function to get CSRF token from cookie ---
export const getCsrfToken = (): string | null => {
    // Read CSRF token from cookie instead of localStorage to match backend expectations
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrf_token_cookie') {
            return decodeURIComponent(value);
        }
    }
    return null;
};

// Function to fetch CSRF token (it will be automatically set as a cookie by the backend)
export const fetchAndStoreCsrfToken = async (): Promise<string | null> => {
    try {
        const response = await api.get<{ csrfToken: string }>(CSRF_API_ENDPOINT);

        // The backend automatically sets the CSRF token as a cookie
        // We just need to verify it was received correctly
        if (response.data && response.data.csrfToken) {
            // The token should now be available in the cookie
            return response.data.csrfToken;
        }
        console.warn('CSRF token not found in response data from ' + CSRF_API_ENDPOINT + '. Actual response data:', response.data);
        return null;
    } catch (error: any) {
        console.error('Error fetching CSRF token from ' + CSRF_API_ENDPOINT + ':', error);
        // handleApiResponse will throw errors, so catch them here if specific error handling is needed
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