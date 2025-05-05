// src/services/api.ts
import { Paper } from '../types/paper';
import { getCsrfToken } from './auth'; // Import the helper function

const API_BASE_URL = 'http://localhost:5000';
const PAPERS_PREFIX = '/api'; // Prefix for paper-related API calls

export interface AdvancedPaperFilters {
  startDate?: string; // Expecting YYYY-MM-DD string format
  endDate?: string;   // Expecting YYYY-MM-DD string format
  searchAuthors?: string;
}

/**
 * Fetches papers from the backend API.
 * @param limit - The maximum number of papers to fetch.
 * @param searchTerm - Optional search term to filter results on the backend.
 * @param sort - Optional sort order ('newest' or 'oldest').
 * @returns A promise that resolves to an array of Paper objects.
 */
export const fetchPapersFromApi = async (
  page: number = 1,
  limit: number = 12,
  searchTerm?: string,
  sort?: 'newest' | 'oldest' | 'upvotes',
  advancedFilters?: AdvancedPaperFilters
): Promise<{ papers: Paper[]; totalPages: number }> => {
  const params = new URLSearchParams();
  params.append('limit', String(limit));
  params.append('page', String(page));
  if (searchTerm && searchTerm.trim()) {
    params.append('search', searchTerm.trim());
  }
  if (sort) {
    params.append('sort', sort);
  }

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

  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers?${params.toString()}`;
  console.log("Fetching from API:", url);
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = `API Error: ${errorData.error}`;
      }
    } catch (e) { console.error("Failed to parse error response:", e); }
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
  const response = await fetch(`${API_BASE_URL}${PAPERS_PREFIX}/papers/${id}`, { credentials: 'include' });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
  const data: Paper = await response.json();
  return data;
};

// --- Placeholder update functions ---
export const updateStepStatusInApi = async (
  // paperId: string, // Parameter unused
  // stepId: number, // Parameter unused
  // newStatus: Paper['implementationSteps'][0]['status'] // Parameter unused
): Promise<Paper | undefined> => {
  console.warn('updateStepStatusInApi: Backend endpoint not implemented yet.');
  throw new Error("Backend update not implemented");
};

export type ImplementabilityAction = 'flag' | 'confirm' | 'dispute' | 'retract';

export const flagImplementabilityInApi = async (
  paperId: string,
  action: ImplementabilityAction
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers/${paperId}/flag_implementability`;
  console.log(`Attempting action '${action}' on implementability for paper:`, url);

  const csrfToken = getCsrfToken(); // Get token
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-CSRFToken': csrfToken }) // Add token header if available
    },
    body: JSON.stringify({ action }),
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = `API Error (${response.status}): ${errorData.error}`;
      }
    } catch (e) { console.error("Failed to parse error response:", e); }
    console.error(`Failed action '${action}' on implementability:`, errorMsg);
    throw new Error(errorMsg);
  }

  const updatedPaper: Paper = await response.json();
  console.log(`Action '${action}' successful for paper ${paperId}. New status: ${updatedPaper.nonImplementableStatus}`);
  return updatedPaper;
};

// --- NEW: Function for owner to force set implementability ---
export const setImplementabilityInApi = async (
  paperId: string,
  isImplementable: boolean
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers/${paperId}/set_implementability`;
  console.log(`Owner setting implementability to ${isImplementable} for paper:`, url);

  const csrfToken = getCsrfToken(); // Get token
  console.log("CSRF Token retrieved for setImplementabilityInApi:", csrfToken);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
    console.log("X-CSRFToken header added to request.");
  } else {
    console.warn("CSRF Token is missing, X-CSRFToken header NOT added.");
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ isImplementable }),
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = `API Error (${response.status}): ${errorData.error}`;
      }
    } catch (e) { console.error("Failed to parse error response:", e); }
    console.error(`Failed owner action setImplementability:`, errorMsg);
    throw new Error(errorMsg);
  }

  const updatedPaper: Paper = await response.json();
  console.log(`Owner action setImplementability successful for paper ${paperId}.`);
  return updatedPaper;
};

export const voteOnPaperInApi = async (
  paperId: string,
  voteType: 'up' | 'none'
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers/${paperId}/vote`;
  console.log(`Attempting to ${voteType}vote paper:`, url);

  const csrfToken = getCsrfToken(); // Get token
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-CSRFToken': csrfToken }) // Add token header if available
    },
    body: JSON.stringify({ voteType }),
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = `API Error (${response.status}): ${errorData.error}`;
      }
    } catch (e) { console.error("Failed to parse error response:", e); }
    console.error("Failed to vote on paper:", errorMsg);
    throw new Error(errorMsg);
  }

  const updatedPaper: Paper = await response.json();
  console.log(`Vote successful for paper ${paperId}. New count: ${updatedPaper.upvoteCount}, Your vote: ${updatedPaper.currentUserVote}`);
  return updatedPaper;
};

// --- Function to remove a paper (Owner only) ---
export const removePaperFromApi = async (paperId: string): Promise<void> => {
  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers/${paperId}`;
  console.log("Attempting to remove paper:", url);

  const csrfToken = getCsrfToken(); // Get token
  const response = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...(csrfToken && { 'X-CSRFToken': csrfToken }) // Add token header if available
    },
  });

  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = `API Error (${response.status}): ${errorData.error}`;
      }
    } catch (e) { console.error("Failed to parse error response:", e); }
    console.error("Failed to remove paper:", errorMsg);
    throw new Error(errorMsg);
  }

  if (response.status === 200 || response.status === 204 || response.status === 207) {
    console.log(`Paper ${paperId} removed successfully.`);
    return;
  } else {
    console.warn(`Unexpected success status code ${response.status} during paper removal.`);
    throw new Error(`Unexpected status code ${response.status} after removing paper.`);
  }
};

// --- fetchAuthStatus (This seems redundant if checkCurrentUser exists in auth.ts) ---
// Consider removing fetchAuthStatus if checkCurrentUser provides the needed info.
/*
export const fetchAuthStatus = async (): Promise<{ isAuthenticated: boolean; user: any | null }> => {
  const url = `${API_BASE_URL}${AUTH_PREFIX}/status`; // Needs AUTH_PREFIX if kept
  console.log("Fetching auth status from:", url);
  try {
      const response = await fetch(url, {
          credentials: 'include',
      });
      if (!response.ok) {
          if (response.status === 401) {
               console.log("Auth status check: Not authenticated (401)");
               return { isAuthenticated: false, user: null };
          }
          console.error(`Auth status check failed: ${response.status} ${response.statusText}`);
          return { isAuthenticated: false, user: null };
      }
      const data = await response.json();
      console.log("Auth status received:", data);
      return data;
  } catch (error) {
      console.error("Error fetching auth status:", error);
      return { isAuthenticated: false, user: null };
  }
};
*/

// --- redirectToGitHubLogin (This seems redundant if it exists in auth.ts) ---
// Consider removing this if the one in auth.ts is used.
/*
export const redirectToGitHubLogin = () => {
  const loginUrl = `${API_BASE_URL}${AUTH_PREFIX}/github/login`; // Needs AUTH_PREFIX if kept
  console.log("Redirecting to GitHub login:", loginUrl);
  window.location.href = loginUrl;
};
*/