// src/services/api.ts
import { Paper } from '../types/paper';

const API_BASE_URL = 'http://localhost:5000/api';

export interface AdvancedPaperFilters {
  startDate?: string; // Expecting YYYY-MM-DD string format
  endDate?: string;   // Expecting YYYY-MM-DD string format
  searchAuthors?: string;
}

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
  sort?: 'newest' | 'oldest' | 'upvotes',
  advancedFilters?: AdvancedPaperFilters // <-- Add advanced filters parameter
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

  // --- NEW: Add advanced filter params ---
  if (advancedFilters) {
    if (advancedFilters.startDate) {
      params.append('startDate', advancedFilters.startDate);
    }
    if (advancedFilters.endDate) {
      params.append('endDate', advancedFilters.endDate);
    }
    if (advancedFilters.searchAuthors && advancedFilters.searchAuthors.trim()) {
      params.append('searchAuthors', advancedFilters.searchAuthors.trim());
    }
  }
  // --- End NEW ---

  const url = `${API_BASE_URL}/papers?${params.toString()}`;
  console.log("Fetching from API:", url); // Log includes new params now
  const response = await fetch(url, { credentials: 'include' });
  // ... rest of the function remains the same ...
  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = `API Error: ${errorData.error}`;
      }
    } catch (e) { console.log(e)}
    throw new Error(errorMsg);
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.papers) || typeof data.totalPages !== 'number') {
      console.error("Unexpected API response structure:", data);
      throw new Error("Invalid data structure received from API");
  }
  return data;
};

// --- fetchPaperByIdFromApi ---
export const fetchPaperByIdFromApi = async (id: string): Promise<Paper | undefined> => {
   const response = await fetch(`${API_BASE_URL}/papers/${id}`, { credentials: 'include' }); // Include credentials for user vote status
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

export type ImplementabilityAction = 'flag' | 'confirm' | 'dispute' | 'retract';

export const flagImplementabilityInApi = async (
    paperId: string,
    action: ImplementabilityAction
): Promise<Paper> => {
    const url = `${API_BASE_URL}/papers/${paperId}/flag_implementability`;
    console.log(`Attempting action '${action}' on implementability for paper:`, url);

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'include', // Crucial for sending session cookie
    });

    if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
                errorMsg = `API Error (${response.status}): ${errorData.error}`;
            }
        } catch (e) { /* Ignore if response is not JSON */ }
        console.error(`Failed action '${action}' on implementability:`, errorMsg);
        throw new Error(errorMsg);
    }

    const updatedPaper: Paper = await response.json(); // Includes updated status/votes
    console.log(`Action '${action}' successful for paper ${paperId}. New status: ${updatedPaper.nonImplementableStatus}`);
    return updatedPaper;
};


// --- NEW: Function for owner to force set implementability ---
export const setImplementabilityInApi = async (
    paperId: string,
    isImplementable: boolean // true or false
): Promise<Paper> => {
    const url = `${API_BASE_URL}/papers/${paperId}/set_implementability`;
    console.log(`Owner setting implementability to ${isImplementable} for paper:`, url);

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isImplementable }),
        credentials: 'include', // Crucial for owner check
    });

     if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
                errorMsg = `API Error (${response.status}): ${errorData.error}`;
            }
        } catch (e) { /* Ignore if response is not JSON */ }
        console.error(`Failed owner action setImplementability:`, errorMsg);
        throw new Error(errorMsg);
    }

    const updatedPaper: Paper = await response.json(); // Includes updated status
    console.log(`Owner action setImplementability successful for paper ${paperId}.`);
    return updatedPaper;
};

export const voteOnPaperInApi = async (
  paperId: string,
  voteType: 'up' | 'none' // Currently only supporting upvote or removing vote
): Promise<Paper> => {
  const url = `${API_BASE_URL}/papers/${paperId}/vote`;
  console.log(`Attempting to ${voteType}vote paper:`, url);

  const response = await fetch(url, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          // Include CSRF token header if needed by backend (Flask-WTF might require it)
          // 'X-CSRFToken': getCsrfToken(), // Example: You'd need a function to get this
      },
      body: JSON.stringify({ voteType }), // Send 'up' or 'none'
      credentials: 'include', // Crucial for sending session cookie
  });

  if (!response.ok) {
      let errorMsg = `API Error: ${response.status} ${response.statusText}`;
      try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
              errorMsg = `API Error (${response.status}): ${errorData.error}`;
          }
      } catch (e) { /* Ignore if response is not JSON */ }
      console.error("Failed to vote on paper:", errorMsg);
      throw new Error(errorMsg);
  }

  // Expect the updated paper object in the response
  const updatedPaper: Paper = await response.json();
  console.log(`Vote successful for paper ${paperId}. New count: ${updatedPaper.upvoteCount}, Your vote: ${updatedPaper.currentUserVote}`);
  return updatedPaper;
};

// --- Function to remove a paper (Owner only) ---
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