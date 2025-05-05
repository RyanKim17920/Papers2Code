// src/services/auth.ts

// Define the expected user structure based on backend session data
export interface UserProfile {
    id: number;
    username: string;
    avatarUrl?: string | null;
    name?: string | null;
    isOwner?: boolean; // <-- Keep this for potential future use
    isAdmin?: boolean; // <-- Add this line for admin privileges
}

const API_BASE_URL = 'http://localhost:5000'; // Use root URL
const AUTH_API_PREFIX = '/api/auth'; // Specific prefix for auth routes
const CSRF_API_ENDPOINT = '/api/csrf-token'; // Specific endpoint for CSRF token

// Function to initiate login - simply redirect to backend endpoint
export const redirectToGitHubLogin = () => {
    window.location.href = `${API_BASE_URL}${AUTH_API_PREFIX}/github/login`;
};

// Function to check current user status
export const checkCurrentUser = async (): Promise<UserProfile | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}${AUTH_API_PREFIX}/me`, {
            // Include credentials (cookies) in the request
            credentials: 'include',
        });

        if (response.status === 401) {
            return null; // Not authenticated
        }
        if (!response.ok) {
            // Handle other errors (e.g., server error on backend)
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        const userData: UserProfile = await response.json();
        return userData;
    } catch (error) {
        console.error("Error checking current user:", error);
        // Depending on how you want to handle errors, you might return null
        // or re-throw the error to be caught by the calling component.
        return null;
    }
};

// Function to log out
export const logoutUser = async (): Promise<void> => {
    try {
        // Get CSRF token
        const csrfToken = getCsrfToken(); // Use helper function
        const response = await fetch(`${API_BASE_URL}${AUTH_API_PREFIX}/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
        });
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        console.log("Logout successful");
    } catch (error) {
        console.error("Logout failed:", error);
        // Handle logout error (e.g., show a message)
        // Even if API call fails, we might want to clear frontend state
    }
};

// --- NEW: Helper function to get CSRF token from localStorage ---
export const getCsrfToken = (): string | null => {
    return localStorage.getItem('csrfToken');
};

// Function to fetch and store CSRF token
export const fetchAndStoreCsrfToken = async (): Promise<string | null> => {
    try {
        // --- FIX: Use correct endpoint --- 
        const response = await fetch(`${API_BASE_URL}${CSRF_API_ENDPOINT}`, {
            credentials: 'include',
        });
        // --- END FIX ---
        if (!response.ok) throw new Error('Failed to fetch CSRF token');
        const data = await response.json();
        if (data.csrfToken) {
            localStorage.setItem('csrfToken', data.csrfToken);
            console.log("CSRF Token fetched and stored."); // Added log
            return data.csrfToken;
        }
        return null;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        return null;
    }
};