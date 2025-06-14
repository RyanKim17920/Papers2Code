// src/services/api.ts
import { Paper, AdminSettableImplementabilityStatus } from '../types/paper';
import type { ImplementationProgress } from '../types/implementation';
import type { PaperActionUserProfile, UserProfile } from '../types/user'; // Added UserProfile import
import { getCsrfToken } from './auth';
import { API_BASE_URL, PAPERS_API_PREFIX } from './config';

// --- User Profile Types ---
export interface UserProfileResponse {
  userDetails: UserProfile;
  upvotedPapers: Paper[];
  contributedPapers: Paper[];
}
// --- End User Profile Types ---


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

// --- Type for the response from the /actions endpoint ---
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

  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/?${params.toString()}`;
  const response = await fetch(url, { credentials: 'include', signal }); // <-- MODIFIED: Pass signal to fetch
  // MODIFIED: Use handleApiResponse with correct camelCase types for pageSize and hasMore from the backend's PaginatedPaperResponse
  const data = await handleApiResponse<{ papers: Paper[]; totalCount: number; page: number; pageSize: number; hasMore: boolean}>(response);
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
  const response = await fetch(`${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${id}`, { credentials: 'include' });
  if (response.status === 404) return undefined;
  const paper =  handleApiResponse<Paper>(response);
  return paper;
};

export type ImplementabilityAction = 'flag' | 'confirm' | 'dispute' | 'retract';

export const flagImplementabilityInApi = async (
  paperId: string,
  action: ImplementabilityAction
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}/flag_implementability`;

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
  return updatedPaper;
};

// --- NEW: Function for owner to force set implementability ---
export const setImplementabilityInApi = async (
  paperId: string,
  adminStatus: AdminSettableImplementabilityStatus // This is 'Admin Implementable', 'Admin Not Implementable', or 'voting'
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}/set_implementability`;


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
  return updatedPaper;
};

export const voteOnPaperInApi = async (
  paperId: string,
  voteType: 'up' | 'none'
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}/vote`;

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
  return updatedPaper;
};

// --- Function to remove a paper (Owner only) ---
export const removePaperFromApi = async (paperId: string): Promise<void> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}`;

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
  // MODIFIED: No further action needed; handleApiResponse throws for errors.
};

// --- NEW: Function to fetch users who performed actions on a paper ---
export const fetchPaperActionUsers = async (paperId: string): Promise<PaperActionUsers> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}/actions`;
  const response = await fetch(url, { credentials: 'include' });

  // Use the BackendPaperActionsSummaryResponse type for the raw data
  const rawData = await handleApiResponse<BackendPaperActionsSummaryResponse>(response);

  // Helper to map backend detail to frontend PaperActionUserProfile
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

  return transformedData;
};
// --- End NEW ---

// --- NEW: Function to update paper implementation status (Owner only) ---
export const updatePaperStatusInApi = async (
  paperId: string,
  status: string,
  userId: string // Assuming backend might want to log which owner/admin performed the action
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}/status`;

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
  return updatedPaper;
};
// --- End NEW ---

// --- NEW: Function to join or create implementation progress ---
export const joinOrCreateImplementationProgress = async (
  paperId: string
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/implementation-progress/paper/${paperId}/join`;

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
  return updatedPaper;
};
// --- End NEW ---

// --- NEW: Function to update implementation progress ---
export const updateImplementationProgressInApi = async (
  paperId: string,
  progressData: ImplementationProgress
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/implementation-progress/paper/${paperId}`;

  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  } else {
    console.warn("CSRF Token is missing for updateImplementationProgressInApi, X-CSRFToken header NOT added.");
  }

  const response = await fetch(url, {
    method: 'PUT', // Assuming PUT for updates
    headers: headers,
    body: JSON.stringify(progressData),
    credentials: 'include',
  });

  // The backend is expected to return the updated Paper document
  const updatedPaper = await handleApiResponse<Paper>(response);
  return updatedPaper;
};
// --- End NEW ---

// --- User Profile API Functions ---
export const fetchUserProfileFromApi = async (username: string): Promise<UserProfileResponse | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/${username}/profile`, { 
      credentials: 'include' 
    });
    
    if (response.status === 404) {
      return null; // User not found
    }
    
    const profileData = await handleApiResponse<UserProfileResponse>(response);
    return profileData;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    throw error;
  }
};

export const getUserProfileSettings = async (): Promise<UserProfileResponse | null> => {
  try {
    const url = `${API_BASE_URL}/api/users/settings`;
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (response.status === 401) {
      return null; // Not authenticated
    }
    
    if (response.status === 404) {
      return null; // User not found
    }
    
    const userDetails = await handleApiResponse<UserProfile>(response);
    
    // Convert UserSchema to UserProfileResponse for consistency with SettingsPage
    const userProfileResponse: UserProfileResponse = {
      userDetails: userDetails,
      upvotedPapers: [],
      contributedPapers: []
    };
    
    return userProfileResponse;
  } catch (error) {
    console.error('Failed to fetch user settings:', error);
    throw error;
  }
};

// --- User Profile Management Functions ---
export const updateUserProfile = async (profileData: {
  name?: string;
  bio?: string;
  websiteUrl?: string;
  twitterProfileUrl?: string;
  linkedinProfileUrl?: string;
  blueskyUsername?: string;
  huggingfaceUsername?: string;
}): Promise<UserProfile> => {
  const url = `${API_BASE_URL}/api/users/profile`;

  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: headers,
    body: JSON.stringify(profileData),
    credentials: 'include',
  });

  const updatedUser = await handleApiResponse<UserProfile>(response);
  return updatedUser;
};

export const deleteUserAccount = async (): Promise<void> => {
  const url = `${API_BASE_URL}/api/users/profile`;

  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {};
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }

  const response = await fetch(url, {
    method: 'DELETE',
    headers: headers,
    credentials: 'include',
  });

  await handleApiResponse<void>(response);
};


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

// NEW: Private helper function to handle API responses and 401 errors
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // Handle 401: e.g., redirect to login, clear session, throw specific error
    console.error('Authentication error (401):', await response.text().catch(() => ""));
    throw new AuthenticationError('User not authenticated or session expired.');
  }

  // MODIFIED: Add specific handling for 403 CSRF/Forbidden errors
  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({ detail: "Forbidden access" }));
    // Check if the detail specifically mentions CSRF, as 403 is generic "Forbidden"
    // Backend uses "CSRF token mismatch or missing."
    if (errorData.detail && typeof errorData.detail === 'string' && 
        (errorData.detail.toLowerCase().includes('csrf') || errorData.detail.toLowerCase().includes('forbidden'))) { 
        console.error('CSRF or Forbidden error (403):', errorData.detail);
        if (errorData.detail.toLowerCase().includes('csrf')) {
            throw new CsrfError(errorData.detail);
        } else {
            // For a general "Forbidden" that isn't CSRF, it's likely a permission issue.
            throw new AuthenticationError(errorData.detail || 'Access denied. You may not have permission to perform this action.');
        }
    }
    // For other 403 errors not matching the CSRF/Forbidden detail pattern (e.g. if response wasn't JSON)
    const errorText = await response.text().catch(() => "Forbidden access");
    console.error('Generic Forbidden error (403):', errorText);
    throw new AuthenticationError(errorText || 'Permission denied.');
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
  }  // NEW: Handle 422 Unprocessable Entity for validation errors
  if (response.status === 422) {
    const errorData = await response.json().catch(() => null);
    
    // Check if it's a simple detail string (our custom validation errors)
    if (errorData && errorData.detail && typeof errorData.detail === 'string') {
      console.error('API Validation Error (422):', errorData.detail);
      throw new Error(errorData.detail); // Throw with the specific validation message
    }
    
    // Handle FastAPI's default validation error format (array of validation errors)
    if (errorData && errorData.detail && Array.isArray(errorData.detail) && errorData.detail.length > 0) {
      // Extract the first validation error message
      const firstError = errorData.detail[0];
      const userMessage = firstError.msg;
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