// src/services/auth.ts

// Define the expected user structure based on backend session data
export interface UserProfile {
    id: number;
    username: string;
    avatarUrl?: string | null;
    name?: string | null;
    isOwner?: boolean; // <-- Add this line
}

const API_BASE_URL = 'http://localhost:5000/api'; // Ensure this matches

// Function to initiate login - simply redirect to backend endpoint
export const redirectToGitHubLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/github/login`;
};

// Function to check current user status
export const checkCurrentUser = async (): Promise<UserProfile | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
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
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST', // Use POST as defined in backend
            credentials: 'include', // Send cookies
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