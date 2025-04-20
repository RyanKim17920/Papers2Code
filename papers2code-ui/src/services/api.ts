// src/services/api.ts
import { Paper } from '../types/paper';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Fetches papers from the backend API.
 * @param limit - The maximum number of papers to fetch.
 * @param searchTerm - Optional search term to filter results on the backend.
 * @param sort - Optional sort order ('newest' or 'oldest'). // <-- Add sort parameter
 * @returns A promise that resolves to an array of Paper objects.
 */
export const fetchPapersFromApi = async (
    page: number = 1,
    limit: number = 12,
    searchTerm?: string,
    sort?: 'newest' | 'oldest'
  ): Promise<{ papers: Paper[]; totalPages: number }> => {
    // Build query parameters
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    params.append('page', String(page));
    if (searchTerm && searchTerm.trim()) {
      params.append('search', searchTerm.trim());
    }
    if (sort) {
      params.append('sort', sort);
    }
    const url = `${API_BASE_URL}/papers?${params.toString()}`;
    console.log("Fetching from API:", url);
    const response = await fetch(url);
    if (!response.ok) {
      let errorMsg = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMsg = `API Error: ${errorData.error}`;
        }
      } catch (e) { }
      throw new Error(errorMsg);
    }
    // Expecting the backend to return an object with 'papers' and 'totalPages'
    const data = await response.json();
    return data;
  };

// --- fetchPaperByIdFromApi (keep as is) ---
export const fetchPaperByIdFromApi = async (id: string): Promise<Paper | undefined> => {
    // ... (no changes needed here) ...
     const response = await fetch(`${API_BASE_URL}/papers/${id}`);
     if (response.status === 404) return undefined;
     if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
     const data: Paper = await response.json();
     return data;
};


// --- Placeholder update functions (keep as is or implement backend first) ---
export const updateStepStatusInApi = async (
    paperId: string,
    stepId: number,
    newStatus: Paper['implementationSteps'][0]['status']
): Promise<Paper | undefined> => {
    console.warn('updateStepStatusInApi: Backend endpoint not implemented yet.');
    throw new Error("Backend update not implemented");
};

export const flagPaperImplementabilityInApi = async (
    paperId: string,
    isImplementable: boolean
): Promise<Paper | undefined> => {
    console.warn('flagPaperImplementabilityInApi: Backend endpoint not implemented yet.');
    throw new Error("Backend update not implemented");
};

// --- NEW: Function to remove a paper (Owner only) ---
export const removePaperFromApi = async (paperId: string): Promise<void> => {
    const url = `${API_BASE_URL}/papers/${paperId}`;
    console.log("Attempting to remove paper:", url);

    const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include', // Important for session/owner check
        // Add CSRF token header if your backend requires it for DELETE
        // headers: {
        //     'X-CSRF-Token': getCsrfToken(), // You'd need a function to get the token
        // },
    });

    if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
                errorMsg = `API Error (${response.status}): ${errorData.error}`;
            }
        } catch (e) { /* Ignore if response is not JSON */ }
        console.error("Failed to remove paper:", errorMsg);
        throw new Error(errorMsg);
    }

    // Check for 200 OK or 204 No Content (or even 207 if backend uses it)
    if (response.status === 200 || response.status === 204 || response.status === 207) {
        console.log(`Paper ${paperId} removed successfully.`);
        // No content to return, resolve the promise
        return;
    } else {
        // Handle unexpected success status codes if necessary
        console.warn(`Unexpected success status code ${response.status} during paper removal.`);
        throw new Error(`Unexpected status code ${response.status} after removing paper.`);
    }
};