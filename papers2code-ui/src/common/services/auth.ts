// src/services/auth.ts
import axios from 'axios';
import { API_BASE_URL, AUTH_API_PREFIX, CSRF_API_ENDPOINT } from './config';
import type { UserProfile } from '../types/user';
import { useState, useEffect } from 'react';


// Create an Axios instance for API calls
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // Important for sending cookies
});

// Function to initiate login - simply redirect to backend endpoint
export const redirectToGitHubLogin = () => {
    window.location.href = `${API_BASE_URL}${AUTH_API_PREFIX}/github/login`;
};

// Function to check current user status
export const checkCurrentUser = async (): Promise<UserProfile | null> => {
    try {
        // The API will now return camelCase, so no transformation needed here
        const response = await apiClient.get<UserProfile>(`${AUTH_API_PREFIX}/me`);
        return response.data; // Directly return data as UserProfile
    } catch (error: unknown) { 
        if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
            return null; // Not authenticated
        }
        console.error("Error checking current user:", error);
        return null;
    }
};

// Function to log out
export const logoutUser = async (): Promise<void> => {
    try {
        let csrfToken = getCsrfToken(); // Get from localStorage

        if (!csrfToken) {
            console.warn("CSRF token not found in localStorage for logout. Attempting to fetch a new one.");
            await fetchAndStoreCsrfToken(); // Attempt to fetch and store
            csrfToken = getCsrfToken(); // Try getting it again
        }

        if (!csrfToken) {
            console.error("CSRF token still not available after attempting to fetch. Logout may fail or be rejected by the server if CSRF protection is enforced.");
            // Proceeding as original code did, but the backend will likely reject if CSRF is enforced and token is missing.
        }

        // MODIFIED: Use apiClient and set X-CSRFToken header        
        await apiClient.post<{ message: string, csrfToken: string }>(`${AUTH_API_PREFIX}/logout`, {}, { // Send empty object as data if no body needed
            headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
        });
        // Note: The new CSRF token is automatically set as a cookie by the backend,
        // so we don't need to manually store it in localStorage anymore
    } catch (error) {
        console.error("Logout failed:", error);
        // Handle logout error (e.g., show a message)
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
        const response = await apiClient.get<{ csrfToken: string }>(CSRF_API_ENDPOINT);

        // The backend automatically sets the CSRF token as a cookie
        // We just need to verify it was received correctly
        if (response.data && response.data.csrfToken) {
            // The token should now be available in the cookie
            return response.data.csrfToken;
        }
        console.warn('CSRF token not found in response data from ' + CSRF_API_ENDPOINT + '. Actual response data:', response.data);
        return null;
    } catch (error: unknown) {
        console.error('Error fetching CSRF token from ' + CSRF_API_ENDPOINT + ':', error);
        if (axios.isAxiosError(error)) { // Ensure error is an AxiosError before accessing its properties
            console.error('Axios error details:', {
                message: error.message,
                config: error.config,
                code: error.code,
                request: error.request ? 'Exists' : 'Does not exist',
                response: error.response ? {
                    data: error.response.data,
                    status: error.response.status,
                    headers: error.response.headers,
                } : 'No response object',
            });
            if (error.response) {
                console.error('Error response data specifically:', error.response.data);
            }
        } else {
            // Handle non-Axios errors or log them differently
            console.error('An unexpected error occurred:', error);
        }
        return null;
    }
};

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ... logic to check current user
  }, []);

  const login = () => {
    // ... login logic
  };

  const logout = () => {
    // ... logout logic
  };

  return { user, loading, login, logout };
}