// src/services/auth.ts
import axios from 'axios';

export interface UserProfile {
    id: string;
    username: string;
    avatarUrl?: string | null;
    name?: string | null;
    isOwner?: boolean;
    isAdmin?: boolean;
}

const API_BASE_URL = 'http://localhost:5000/api'; // Ensure this is your backend URL
const AUTH_API_PREFIX = '/auth'; // Specific prefix for auth routes
const CSRF_API_ENDPOINT = '/auth/csrf-token'; // Specific endpoint for CSRF token

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
        const csrfToken = getCsrfToken();
        if (!csrfToken) {
            console.error("CSRF token not found for logout.");
            // Optionally, try to fetch it again or alert the user
            // For now, we'll proceed, but the backend will likely reject if CSRF is enforced
        }

        // MODIFIED: Use apiClient and set X-CSRFToken header
        await apiClient.post(`${AUTH_API_PREFIX}/logout`, {}, { // Send empty object as data if no body needed
            headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
        });
        console.log("Logout successful");
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
        const response = await apiClient.get<{ csrf_token: string }>(CSRF_API_ENDPOINT);
        if (response.data && response.data.csrf_token) {
            localStorage.setItem('csrfToken', response.data.csrf_token);
            console.log('CSRF token fetched and stored:', response.data.csrf_token);
            return response.data.csrf_token;
        }
        return null;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        return null;
    }
};