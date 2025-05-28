// src/services/api.ts
import { Paper, AdminSettableImplementabilityStatus } from '../types/paper';
import { getCsrfToken, UserProfile } from './auth';

const API_BASE_URL = 'http://localhost:5000';
const PAPERS_PREFIX = '/api'; // Prefix for paper-related API calls

// --- NEW: Custom Error Classes ---
export class AuthenticationError extends Error {
  constructor(message?: string) {
    super(message || "Authentication required.");
    this.name = "AuthenticationError";
  }
}

export class CsrfError extends Error {
  constructor(message?: string) {
    super(message || "CSRF token validation failed.");
    this.name = "CsrfError";
  }
}
// --- End NEW ---

export interface AdvancedPaperFilters {
  startDate?: string; // Expecting YYYY-MM-DD string format
  endDate?: string;   // Expecting YYYY-MM-DD string format
  searchAuthors?: string;
}

// --- NEW: Type for the response from the /actions endpoint ---
export interface PaperActionUsers {
  upvotes: UserProfile[];
  votedIsImplementable: UserProfile[];  // Users who voted "Is Implementable" (Thumbs Up)
  votedNotImplementable: UserProfile[]; // Users who voted "Not Implementable" (Thumbs Down)
}
// --- End NEW ---

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
  // MODIFIED: Use handleApiResponse
  const data = await handleApiResponse<{ papers: Paper[]; totalCount: number }>(response);
  // console.log('fetched data: ') // Optional: keep for debugging if needed
  // console.log(data);
  if (!data || !Array.isArray(data.papers) || typeof data.totalCount !== 'number') {
    console.error("Unexpected API response structure after handleApiResponse:", data);
    throw new Error("Invalid data structure received from API after handling");
  }
  const totalPages = Math.ceil(data.totalCount / limit);
  return { papers: data.papers, totalPages };
};

// --- fetchPaperByIdFromApi ---
export const fetchPaperByIdFromApi = async (id: string): Promise<Paper | undefined> => {
  const response = await fetch(`${API_BASE_URL}${PAPERS_PREFIX}/papers/${id}`, { credentials: 'include' });
  // Specific handling for 404 before global handler, if desired (e.g., return undefined directly)
  if (response.status === 404) return undefined;
  // MODIFIED: Use handleApiResponse for other cases
  return handleApiResponse<Paper>(response);
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

  // MODIFIED: Use handleApiResponse
  const updatedPaper = await handleApiResponse<Paper>(response);
  console.log(`Action '${action}' successful for paper ${paperId}. New status: ${updatedPaper.status}`);
  return updatedPaper;
};

// --- NEW: Function for owner to force set implementability ---
export const setImplementabilityInApi = async (
  paperId: string,
  adminStatus: AdminSettableImplementabilityStatus // This is 'Admin Implementable', 'Admin Not Implementable', or 'voting'
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers/${paperId}/set_implementability`;

  console.log(`Owner setting implementability to ${adminStatus} for paper:`, url);

  const csrfToken = getCsrfToken(); 
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ statusToSet: adminStatus }), // Send adminStatus directly
    credentials: 'include',
  });

  const updatedPaper = await handleApiResponse<Paper>(response);
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
      ...(csrfToken && { 'X-CSRFToken': csrfToken })    },
    body: JSON.stringify({ vote_type: voteType }), // MODIFIED: Changed voteType to vote_type
    credentials: 'include',
  });

  // MODIFIED: Use handleApiResponse
  const updatedPaper = await handleApiResponse<Paper>(response);
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

  // MODIFIED: Use handleApiResponse. It will return null for 204 or throw for errors.
  await handleApiResponse<void>(response); 
  // Original success logging can remain if specific status codes (200, 207) are meaningful beyond just "ok"
  // but the primary success/failure is handled by handleApiResponse.
  // MODIFIED: Check response.ok instead of specific statuses, as handleApiResponse now throws for non-ok responses.
  if (response.ok) { 
      console.log(`Paper ${paperId} removed successfully or request accepted.`);
  }
  // No need for an else to throw error, as handleApiResponse does that.
};

// --- NEW: Function to fetch users who performed actions on a paper ---
export const fetchPaperActionUsers = async (paperId: string): Promise<PaperActionUsers> => {
  const url = `${API_BASE_URL}/api/papers/${paperId}/actions`; // Ensure PAPERS_PREFIX is used if intended
  console.log("Fetching paper action users from:", url);
  // try/catch block is fine here if you want to add specific logging for this call before re-throwing
  try {
      const response = await fetch(url, {
          credentials: 'include',
      });
      // MODIFIED: Use handleApiResponse
      const rawData = await handleApiResponse<any>(response); // Get raw data first
      console.log(`Fetched raw action users for paper ${paperId}:`, rawData);

      // Transform rawData into PaperActionUsers
      const transformedData: PaperActionUsers = {
        upvotes: [],
        votedIsImplementable: [],
        votedNotImplementable: [],
      };

      if (rawData.upvotes && Array.isArray(rawData.upvotes)) {
        transformedData.upvotes = rawData.upvotes.map((action: any) => ({
          id: action.userId,
          username: action.username,
          avatarUrl: action.avatarUrl,
          // Add other UserProfile fields if necessary, mapping from action
        }));
      }

      if (rawData.implementabilityFlags && Array.isArray(rawData.implementabilityFlags)) {
        rawData.implementabilityFlags.forEach((action: any) => {
          const userProfile: UserProfile = {
            id: action.userId,
            username: action.username,
            avatarUrl: action.avatarUrl,
            // Add other UserProfile fields if necessary
          };
          // ADD THIS LOG:
          console.log(`Processing actionType: '${action.actionType}' for user ${action.username}`);
          if (action.actionType === 'Implementable') { // User voted "Is Implementable"
            transformedData.votedIsImplementable.push(userProfile);
          } else if (action.actionType === 'Not Implementable') { // User voted "Not Implementable"
            transformedData.votedNotImplementable.push(userProfile);
          }
        });
      }
      
      console.log(`Transformed action users for paper ${paperId}:`, transformedData);
      return transformedData;
  } catch (error) {
      console.error(`Error fetching action users for paper ${paperId} (caught in function):`, error);
      throw error; // Re-throw to be handled by the calling component/hook
  }
};
// --- End NEW ---

// --- NEW: Function to update paper implementation status (Owner only) ---
export const updatePaperStatusInApi = async (
  paperId: string,
  status: string,
  userId: string // Assuming backend might want to log which owner/admin performed the action
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers/${paperId}/status`;
  console.log(`Owner ${userId} updating paper ${paperId} implementation status to: ${status}`);

  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  } else {
    console.warn("CSRF Token is missing for updatePaperStatusInApi, X-CSRFToken header NOT added.");
  }

  const response = await fetch(url, {
    method: 'POST', // Or PUT, depending on backend API design
    headers: headers,
    body: JSON.stringify({ status, userId }), // Sending userId in case backend needs it
    credentials: 'include',
  });

  // MODIFIED: Use handleApiResponse
  const updatedPaper = await handleApiResponse<Paper>(response);
  console.log(`Paper ${paperId} implementation status updated successfully to ${status}.`);
  return updatedPaper;
};
// --- End NEW ---

// NEW: Private helper function to handle API responses and 401 errors
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    console.warn('API request unauthorized (401).');
    // Throw an error to stop further processing in the calling function
    // MODIFIED: Throw AuthenticationError instead of generic Error and remove automatic redirection/logout
    throw new AuthenticationError('Unauthorized. Please log in.'); 
  }
  // NEW: Handle 403 specifically for CSRF or other permission issues
  if (response.status === 403) {
    let errorMsg = `API Forbidden: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && (errorData.detail || errorData.error)) {
        errorMsg = `API Forbidden (${response.status}): ${errorData.detail || errorData.error}`;
        // Assuming CSRF errors might include a specific message in 'detail'
        if (errorData.detail && errorData.detail.toLowerCase().includes('csrf')) {
          throw new CsrfError(errorMsg);
        }
      }
    } catch (e) {
      // If parsing errorData fails, or if it's not a CsrfError, throw a generic CsrfError or rethrow
      if (e instanceof CsrfError) throw e;
      console.error("Failed to parse 403 error response JSON or not a CSRF error:", e);
    }
    // If it wasn't identified as a CsrfError specifically, throw a generic error for 403
    throw new Error(errorMsg); 
  }
  if (!response.ok) {
    let errorMsg = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      // FastAPI often uses 'detail' for error messages
      if (errorData && (errorData.detail || errorData.error)) { 
        errorMsg = `API Error (${response.status}): ${errorData.detail || errorData.error}`;
      }
    } catch (e) {
      // If parsing errorData fails, stick with the original errorMsg
      console.error("Failed to parse error response JSON:", e);
    }
    throw new Error(errorMsg);
  }
  // Handle cases like 204 No Content where response.json() would fail
  if (response.status === 204) {
    return null as T; // Or an appropriate empty value based on expected type T
  }
  return response.json() as Promise<T>; // Parse and return JSON for other successful responses
}