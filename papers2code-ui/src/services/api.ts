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
    limit: number = 10,
    searchTerm?: string,
    sort?: 'newest' | 'oldest' // <-- Add sort parameter type
): Promise<Paper[]> => {
    // Construct the query parameters string
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
    }
    // --- Add sort parameter if provided ---
    if (sort) {
        params.append('sort', sort); // <-- Add sort to params
    }
    // -------------------------------------

    // Build the final URL
    const url = `${API_BASE_URL}/papers?${params.toString()}`;
    console.log("Fetching from API:", url); // Log the URL including sort

    const response = await fetch(url);

    if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            if(errorData && errorData.error) {
                errorMsg = `API Error: ${errorData.error}`;
            }
        } catch (e) { /* Ignore if response body is not JSON */ }
        throw new Error(errorMsg);
    }

    const data: Paper[] = await response.json();
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