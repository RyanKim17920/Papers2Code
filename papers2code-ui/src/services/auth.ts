// src/services/auth.ts
import axios from 'axios';
import { API_BASE_URL, AUTH_API_PREFIX, CSRF_API_ENDPOINT } from './config';
import type { UserProfile } from '../types/user';


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
        await apiClient.post(`${AUTH_API_PREFIX}/logout`, {}, { // Send empty object as data if no body needed
            headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
        });
        // Clear CSRF token from localStorage after successful logout
        localStorage.removeItem('csrfToken');
    } catch (error) {
        console.error("Logout failed:", error);
        // Handle logout error (e.g., show a message)
    }
};

// --- NEW: Helper function to get CSRF token from localStorage ---
export const getCsrfToken = (): string | null => {
    return localStorage.getItem('csrfToken');
};

// Function to fetch and store CSRF token
export const fetchAndStoreCsrfToken = async (): Promise<string | null> => {
    try {
        const response = await apiClient.get<{ csrfToken: string }>(CSRF_API_ENDPOINT);

        // MODIFIED: Check for csrfToken (camelCase) based on observed log
        if (response.data && response.data.csrfToken) {
            localStorage.setItem('csrfToken', response.data.csrfToken);
            return response.data.csrfToken;
        }
        // This log indicates the expected property was not found.
        // The property name in response.data might be different (e.g. case or underscore)
        console.warn('CSRF token not found using key \'csrfToken\' in response data from ' + CSRF_API_ENDPOINT + '. Actual response data:', response.data);
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