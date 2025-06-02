// src/services/api.ts
import { Paper, AdminSettableImplementabilityStatus } from '../types/paper'; // AdminSettableImplementabilityStatus is imported
import { getCsrfToken } from './auth'; // IMPORTED for consistent CSRF token handling

// Assuming UserProfile is defined in a types file, e.g., '../types/user'
// For this example, let\'s define it here if not already imported.
// Ideally, this UserProfile interface should be in a central types file (e.g., src/types/user.ts or src/types/paper.ts)
// RENAMED to avoid conflict with UserProfile in auth.ts
export interface PaperActionUserProfile {
  id: string;
  username: string;
  avatarUrl?: string;
  actionType?: string;  createdAt?: string;
}
// --- End UserProfile Definition ---

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
// UPDATED to use PaperActionUserProfile
export interface PaperActionUsers {
  upvotes: PaperActionUserProfile[];
  votedIsImplementable: PaperActionUserProfile[];
  votedNotImplementable: PaperActionUserProfile[];
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
  advancedFilters?: AdvancedPaperFilters,
  signal?: AbortSignal // <-- NEW: Add AbortSignal parameter
): Promise<{ papers: Paper[]; totalPages: number; page: number; pageSize: number; hasMore: boolean }> => {
  const params = new URLSearchParams();
  params.append('limit', String(limit));
  params.append('page', String(page));
  if (searchTerm && searchTerm.trim()) {
    params.append('searchQuery', searchTerm.trim()); // Changed 'search' to 'searchQuery'
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

  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers/?${params.toString()}`;
  console.log("Fetching from API:", url);
  const response = await fetch(url, { credentials: 'include', signal }); // <-- MODIFIED: Pass signal to fetch
  // MODIFIED: Use handleApiResponse with correct camelCase types for pageSize and hasMore from the backend's PaginatedPaperResponse
  const data = await handleApiResponse<{ papers: Paper[]; totalCount: number; page: number; pageSize: number; hasMore: boolean}>(response);
  console.log('fetched data: ') // Optional: keep for debugging if needed
  console.log(data);
  // console.log(data.papers) // This line can be uncommented for debugging if needed
  // MODIFIED: Check for camelCase properties from the backend's PaginatedPaperResponse
  if (!data || !Array.isArray(data.papers) || typeof data.totalCount !== 'number' || typeof data.page !== 'number' || typeof data.pageSize !== 'number' || typeof data.hasMore !== 'boolean') {
    console.error("Unexpected API response structure after handleApiResponse:", data);
    throw new Error("Invalid data structure received from API after handling");
  }
  const totalPages = Math.ceil(data.totalCount / limit);
  // MODIFIED: Access camelCase properties from data, matching the backend's PaginatedPaperResponse schema (which uses alias_generator=to_camel)
  return { papers: data.papers, totalPages: totalPages, page: data.page, pageSize: data.pageSize, hasMore: data.hasMore };
};

// --- fetchPaperByIdFromApi ---
export const fetchPaperByIdFromApi = async (id: string): Promise<Paper | undefined> => {
  const response = await fetch(`${API_BASE_URL}${PAPERS_PREFIX}/papers/${id}`, { credentials: 'include' });
  if (response.status === 404) return undefined;
  const paper =  handleApiResponse<Paper>(response);
  console.log("Fetched paper by ID:", id, paper); 
  return paper;
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
  const url = `${API_BASE_URL}${PAPERS_PREFIX}/papers/${paperId}/actions`;
  console.log("Fetching paper action users from:", url);
  const response = await fetch(url, { credentials: 'include' });

  // Use the BackendPaperActionsSummaryResponse type for the raw data
  const rawData = await handleApiResponse<BackendPaperActionsSummaryResponse>(response);
  console.log(`Fetched raw action users for paper ${paperId}: `, rawData);

  // Helper function to map backend detail to frontend PaperActionUserProfile - RENAMED and type updated
  const mapToPaperActionUserProfile = (detail: BackendPaperActionUserDetail): PaperActionUserProfile => ({
    id: detail.userId,
    username: detail.username,
    avatarUrl: detail.avatarUrl,
    actionType: detail.actionType,
    createdAt: detail.createdAt,
  });

  // Perform the transformation - UPDATED to use renamed helper
  const transformedData: PaperActionUsers = {
    upvotes: rawData.upvotes ? rawData.upvotes.map(mapToPaperActionUserProfile) : [],
    votedIsImplementable: rawData.votedIsImplementable ? rawData.votedIsImplementable.map(mapToPaperActionUserProfile) : [],
    votedNotImplementable: rawData.votedNotImplementable ? rawData.votedNotImplementable.map(mapToPaperActionUserProfile) : [],
  };

  console.log(`Transformed action users for paper ${paperId} (within fetchPaperActionUsers): `, transformedData);
  return transformedData;
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

// --- BEGIN ADDED TYPE DEFINITIONS ---
// These interfaces define the expected structure of the raw JSON response
// from the backend /actions endpoint, after camelCase conversion.

interface BackendPaperActionUserDetail {
  userId: string;
  username: string;
  avatarUrl?: string;
  actionType?: string;
  createdAt?: string; // Assuming datetime is serialized as string by the backend
}

interface BackendPaperActionsSummaryResponse {
  paperId: string;
  upvotes: BackendPaperActionUserDetail[];
  saves: BackendPaperActionUserDetail[]; // Included to match backend, even if not fully used in PaperActionUsers yet
  votedIsImplementable: BackendPaperActionUserDetail[];
  votedNotImplementable: BackendPaperActionUserDetail[];
}
// --- END ADDED TYPE DEFINITIONS ---

// --- NEW: Function to join or create implementation progress ---
export const joinOrCreateImplementationProgress = async (
  paperId: string
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_PREFIX}/implementation-progress/paper/${paperId}/join`;
  console.log(`Attempting to join or create implementation progress for paper: ${paperId}`);

  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  } else {
    console.warn("CSRF Token is missing for joinOrCreateImplementationProgress, X-CSRFToken header NOT added.");
    // Depending on backend strictness, this might still fail or succeed if CSRF is not enforced on this endpoint
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    // No body is needed for this specific endpoint as per backend definition
    credentials: 'include',
  });

  // The backend is expected to return the updated Paper document which includes the ImplementationProgress
  const updatedPaper = await handleApiResponse<Paper>(response);
  console.log(`Successfully joined or created implementation progress for paper ${paperId}.`);
  return updatedPaper;
};
// --- End NEW ---

// NEW: Private helper function to handle API responses and 401 errors
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // Handle 401: e.g., redirect to login, clear session, throw specific error
    console.error('Authentication error (401):', await response.text().catch(() => ""));
    throw new AuthenticationError('User not authenticated or session expired.');
  }
  if (response.status === 400) {
    const errorData = await response.json().catch(() => ({ error: "Bad Request", description: "Unknown CSRF or validation error" }));
    if (errorData.error === "CSRF validation failed") {
        console.error('CSRF validation failed:', errorData.description);
        throw new CsrfError(errorData.description || 'CSRF validation failed.');
    }
    // Handle other 400 errors
    console.error(`API Error 400: ${errorData.description || 'Bad Request'}`);
    throw new Error(`API request failed with status 400: ${errorData.description || 'Bad Request'}`);
  }
  // NEW: Handle 422 Unprocessable Entity for validation errors
  if (response.status === 422) {
    const errorData = await response.json().catch(() => null);
    if (errorData && errorData.detail && Array.isArray(errorData.detail) && errorData.detail.length > 0) {
      // Extract the first validation error message
      const firstError = errorData.detail[0];
      let userMessage = firstError.msg;
      // Optionally, make the message more specific if location info is useful
      // if (firstError.loc && Array.isArray(firstError.loc) && firstError.loc.length > 1) {
      //   userMessage = `Error with field '${firstError.loc[1]}': ${userMessage}`;
      // }
      console.error('API Validation Error (422):', userMessage, errorData.detail);
      throw new Error(userMessage); // Throw with the specific validation message
    }
    // Fallback if the 422 error format is not as expected
    const errorBody = await response.text().catch(() => `Status: ${response.status}`);
    console.error(`API Validation Error (422):`, errorBody);
    throw new Error(`Validation failed: ${errorBody}`);
  }
  if (!response.ok) {
    // Handle other errors (e.g., 404, 500)
    const errorBody = await response.text().catch(() => `Status: ${response.status}`);
    console.error(`API Error ${response.status}:`, errorBody);
    throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
  }

  // Handle 204 No Content specifically, as .json() will fail
  if (response.status === 204) {
    return undefined as T; // Or null as T, depending on how you want to represent "void"
  }

  return response.json(); // response.json() already returns a Promise.
}