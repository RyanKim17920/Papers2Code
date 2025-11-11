// src/services/api.ts
import { Paper, AdminSettableImplementabilityStatus } from '../types/paper';
import type { ImplementationProgress, ProgressUpdateRequest } from '../types/implementation';
import type { PaperActionUserProfile, UserProfile } from '../types/user'; // Added UserProfile import
import { getCsrfToken, fetchAndStoreCsrfToken } from './auth';
import { API_BASE_URL, PAPERS_API_PREFIX } from './config';
import axios, { AxiosResponse } from 'axios';

// --- User Profile Types ---
export interface UserProfileResponse {
  userDetails: UserProfile;
  upvotedPapers: Paper[];
  contributedPapers: Paper[];
}

//TODO: need to add rest of dashboard data
// --- Dashboard Types ---
export interface DashboardData {
  trendingPapers: Paper[];
  myContributions: Paper[];
  recentlyViewed: Paper[];
  // Optional sections used by the UI when available
  personalizedPapers?: Paper[];
  followingPapers?: Paper[];
  bookmarkedPapers?: Paper[];
}
// --- End Dashboard Types ---

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
  mainStatus?: string; // Implementation status filter
  implStatus?: string; // Implementability status filter
  hasOfficialImpl?: boolean; // Filter by presence of official implementation
  hasCode?: boolean; // Filter by presence of any code
  contributorId?: string; // Filter by contributor user ID
  tags?: string[]; // Filter by specific tags
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
): Promise<{ papers: Paper[]; totalPages: number; totalCount: number; page: number; pageSize: number; hasMore: boolean }> => {
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
    if (advancedFilters.mainStatus) {
      params.append('mainStatus', advancedFilters.mainStatus);
    }
    if (advancedFilters.implStatus) {
      params.append('implStatus', advancedFilters.implStatus);
    }
    if (advancedFilters.hasOfficialImpl !== undefined) {
      params.append('hasOfficialImpl', String(advancedFilters.hasOfficialImpl));
    }
    if (advancedFilters.hasCode !== undefined) {
      params.append('hasCode', String(advancedFilters.hasCode));
    }
    if (advancedFilters.contributorId) {
      params.append('contributorId', advancedFilters.contributorId);
    }
    if (advancedFilters.tags && advancedFilters.tags.length > 0) {
      advancedFilters.tags.forEach(tag => params.append('tags', tag));
    }
  }
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/?${params.toString()}`;
  
  console.log('🌐 Final API URL:', url);
  console.log('📦 Request parameters:', {
    page,
    limit,
    searchTerm,
    sort,
    advancedFilters
  });
  
  const response = await api.get(url, { signal }); // <-- MODIFIED: Pass signal to fetch
  // MODIFIED: Use handleApiResponse with correct camelCase types for pageSize and hasMore from the backend's PaginatedPaperResponse
  const data = await handleApiResponse<{ papers: Paper[]; totalCount: number; page: number; pageSize: number; hasMore: boolean}>(response, true);
  // MODIFIED: Check for camelCase properties from the backend's PaginatedPaperResponse
  if (!data || !Array.isArray(data.papers) || typeof data.totalCount !== 'number' || typeof data.page !== 'number' || typeof data.pageSize !== 'number' || typeof data.hasMore !== 'boolean') {
    console.error("Unexpected API response structure after handleApiResponse:", data);
    throw new Error("Invalid data structure received from API after handling");
  }
  const totalPages = Math.ceil(data.totalCount / limit);
  // MODIFIED: Access camelCase properties from data, matching the backend's PaginatedPaperResponse schema (which uses alias_generator=to_camel)
  return { papers: data.papers, totalPages: totalPages, totalCount: data.totalCount, page: data.page, pageSize: data.pageSize, hasMore: data.hasMore };
};

// --- fetchPaperByIdFromApi ---
export const fetchPaperByIdFromApi = async (id: string): Promise<Paper | undefined> => {
  const response = await api.get(`${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${id}`);
  if (response.status === 404) return undefined;
  const paper =  handleApiResponse<Paper>(response, true);
  return paper;
};

export type ImplementabilityAction = 'flag' | 'confirm' | 'dispute' | 'retract';

export const flagImplementabilityInApi = async (
  paperId: string,
  action: ImplementabilityAction
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}/flag_implementability`;

  const response = await api.post(url, { action });

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

  const response = await api.post(url, { statusToSet: adminStatus });

  const updatedPaper = await handleApiResponse<Paper>(response);
  return updatedPaper;
};

export const voteOnPaperInApi = async (
  paperId: string,
  voteType: 'up' | 'none'
): Promise<Paper> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}/vote`;

  const response = await api.post(url, { vote_type: voteType });

  // MODIFIED: Use handleApiResponse
  const updatedPaper = await handleApiResponse<Paper>(response);
  return updatedPaper;
};

// --- Function to remove a paper (Owner only) ---
export const removePaperFromApi = async (paperId: string): Promise<void> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}`;

  const response = await api.delete(url);

  // MODIFIED: Use handleApiResponse. It will return null for 204 or throw for errors.
  await handleApiResponse<void>(response); 
  // Original success logging can remain if specific status codes (200, 207) are meaningful beyond just "ok"
  // but the primary success/failure is handled by handleApiResponse.
  // MODIFIED: No further action needed; handleApiResponse throws for errors.
};

// --- NEW: Function to fetch users who performed actions on a paper ---
export const fetchPaperActionUsers = async (paperId: string): Promise<PaperActionUsers> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/${paperId}/actions`;
  const response = await api.get(url);

  // Use the BackendPaperActionsSummaryResponse type for the raw data
  const rawData = (await handleApiResponse<BackendPaperActionsSummaryResponse>(response, true)) || { upvotes: [], saves: [], votedIsImplementable: [], votedNotImplementable: [] };

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

  const response = await api.post(url, { status, userId });

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

  const response = await api.post(url);

  // The backend is expected to return the updated Paper document which includes the ImplementationProgress
  const updatedPaper = await handleApiResponse<Paper>(response);
  return updatedPaper;
}; 
// --- End NEW ---

// --- NEW: Function to update implementation progress ---
export const updateImplementationProgressInApi = async (
  paperId: string,
  progressData: ProgressUpdateRequest
): Promise<ImplementationProgress> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/implementation-progress/paper/${paperId}`;

  const response = await api.put(url, progressData);

  // The backend returns the updated ImplementationProgress
  const updatedProgress = await handleApiResponse<ImplementationProgress>(response);
  return updatedProgress;
};

// --- NEW: Function to automatically create GitHub repository from template and link to implementation progress ---
export const createGitHubRepositoryForPaper = async (
  paperId: string
): Promise<{ success: boolean; repository: any; progress: ImplementationProgress }> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/implementation-progress/paper/${paperId}/create-github-repo`;

  const response = await api.post(url, {});

  const result = await handleApiResponse<{ success: boolean; repository: any; progress: ImplementationProgress }>(response);
  return result;
};
// --- End NEW ---

// --- User Profile API Functions ---
export const fetchUserProfileFromApi = async (username: string): Promise<UserProfileResponse | null> => {
  try {
    const response = await api.get(`${API_BASE_URL}/api/users/${username}/profile`);
    
    if (response.status === 404) {
      return null; // User not found
    }
    
    const profileData = await handleApiResponse<UserProfileResponse>(response, true);
    return profileData;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    throw error;
  }
};

export const getUserProfileSettings = async (): Promise<UserProfileResponse | null> => {
  try {
    const url = `${API_BASE_URL}/api/users/settings`;
    const response = await api.get(url);
    
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
  showEmail?: boolean;
  showGithub?: boolean;
  preferredAvatarSource?: string;
}): Promise<UserProfile> => {
  const url = `${API_BASE_URL}/api/users/profile`;

  const response = await api.put(url, profileData);

  const updatedUser = await handleApiResponse<UserProfile>(response);
  return updatedUser;
};

export const deleteUserAccount = async (): Promise<void> => {
  const url = `${API_BASE_URL}/api/users/profile`;

  const response = await api.delete(url);

  await handleApiResponse<void>(response);
};

// --- NEW: Function to fetch user profiles by IDs ---
export const fetchUserProfilesByIds = async (userIds: string[]): Promise<UserProfile[]> => {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const url = `${API_BASE_URL}/api/users/profiles`;
  
  const response = await api.post(url, userIds);

  const userProfiles = await handleApiResponse<UserProfile[]>(response);
  return userProfiles;
};


// --- NEW: Activity Tracking API ---
export interface PaperViewData {
  paperId: string;
  cameFrom?: string;
}

export const trackPaperViewInApi = async (data: PaperViewData): Promise<void> => {
  const url = `${API_BASE_URL}/api/activity/paper-view`;
  try {
    await api.post(url, {
      paperId: data.paperId,
      metadata: {
        cameFrom: data.cameFrom || 'direct',
      },
    });
  } catch (error: any) {
    // Silently ignore 401 errors (user not logged in) - activity tracking is optional
    if (error.response && error.response.status === 401) {
      return;
    }
    console.error('Failed to track paper view:', error);
    // Non-blocking - don't throw
  }
}
// --- End NEW ---

// --- Dashboard API Functions ---
export const fetchDashboardDataFromApi = async (): Promise<DashboardData> => {
  try {
    const response = await api.get(`${API_BASE_URL}/api/dashboard/data`);
    
    const dashboardData = await handleApiResponse<DashboardData>(response, true);
    return dashboardData;
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    throw error;
  }
};
// --- End Dashboard API Functions ---


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

let _showLoginPrompt: ((message?: string) => void) | undefined;

export const setLoginPromptHandler = (handler: (message?: string) => void) => {
  _showLoginPrompt = handler;
};

// NEW: Private helper function to handle API responses and 401 errors
async function handleApiResponse<T>(response: AxiosResponse, isPublicEndpoint: boolean = false): Promise<T> {
  const { status, data } = response;

  if (status === 401) {
    console.error('Authentication error (401):', data);
    if (!isPublicEndpoint && _showLoginPrompt) {
      _showLoginPrompt('Your session has expired or you are not authenticated. Please log in again.');
    }
    throw new AuthenticationError('User not authenticated or session expired.');
  }

  if (status === 403) {
    const errorData = data || { detail: "Forbidden access" };
    if (errorData.detail && typeof errorData.detail === 'string' && 
        (errorData.detail.toLowerCase().includes('csrf') || errorData.detail.toLowerCase().includes('forbidden'))) { 
        console.error('CSRF or Forbidden error (403):', errorData.detail);
        if (_showLoginPrompt) {
          _showLoginPrompt('Your session has expired or you are not authenticated. Please log in again.');
        }
        if (errorData.detail.toLowerCase().includes('csrf')) {
            throw new CsrfError(errorData.detail);
        } else {
            throw new AuthenticationError(errorData.detail || 'Access denied. You may not have permission to perform this action.');
        }
    }
    console.error('Generic Forbidden error (403):', data);
    throw new AuthenticationError(data || 'Permission denied.');
  }

  if (status === 400) {
    const errorData = data || { error: "Bad Request", description: "Unknown CSRF or validation error" };
    if (errorData.error === "CSRF validation failed") {
        console.error('CSRF validation failed:', errorData.description);
        if (_showLoginPrompt) {
          _showLoginPrompt('Your session has expired or you are not authenticated. Please log in again.');
        }
        throw new CsrfError(errorData.description || 'CSRF validation failed.');
    }
    console.error(`API Error 400: ${errorData.description || 'Bad Request'}`);
    throw new Error(`API request failed with status 400: ${errorData.description || 'Bad Request'}`);
  }

  if (status === 422) {
    const errorData = data || null;
    
    if (errorData && errorData.detail && typeof errorData.detail === 'string') {
      console.error('API Validation Error (422):', errorData.detail);
      throw new Error(errorData.detail);
    }
    
    if (errorData && errorData.detail && Array.isArray(errorData.detail) && errorData.detail.length > 0) {
      const firstError = errorData.detail[0];
      const userMessage = firstError.msg;
      console.error('API Validation Error (422):', userMessage, errorData.detail);
      throw new Error(userMessage);
    }
    
    console.error(`API Validation Error (422):`, data);
    throw new Error(`Validation failed: ${data}`);
  }

  if (status === 500) {
    console.error('Internal Server Error (500):', data);
    const errorMessage = data?.detail || data?.message || 'Internal server error occurred';
    throw new Error(`Request failed with status code 500: ${errorMessage}`);
  }

  if (status < 200 || status >= 300) {
    console.error(`API Error ${status}:`, data);
    const errorMessage = data?.detail || data?.message || data || 'Unknown error';
    throw new Error(`Request failed with status code ${status}: ${errorMessage}`);
  }

  if (status === 204) {
    return undefined as T;
  }
  return data;
}

// --- NEW: Meta endpoints for autocomplete and filtering ---
export const fetchTagsFromApi = async (searchQuery?: string): Promise<string[]> => {
  const params = new URLSearchParams();
  if (searchQuery && searchQuery.trim()) {
    params.append('query', searchQuery.trim());
  }
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/meta/distinct_tags/?${params.toString()}`;
  const response = await api.get(url);
  return await handleApiResponse<string[]>(response, true);
};

export const fetchVenuesFromApi = async (): Promise<string[]> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/meta/distinct_venues/`;
  const response = await api.get(url);
  return await handleApiResponse<string[]>(response, true);
};

export const fetchAuthorsFromApi = async (): Promise<string[]> => {
  const url = `${API_BASE_URL}${PAPERS_API_PREFIX}/papers/meta/distinct_authors/`;
  const response = await api.get(url);
  return await handleApiResponse<string[]>(response, true);
};
// --- End NEW ---

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || API_BASE_URL,
  withCredentials: true,
  validateStatus: (status) => {
    return (status >= 200 && status < 300) || [400, 401, 403, 422].includes(status);
  },
});

api.interceptors.request.use(async (config) => {
  const csrfToken = getCsrfToken();
  
  // Always include CSRF token for state-changing requests
  if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
      console.debug(`🔒 CSRF token included in ${config.method?.toUpperCase()} ${config.url}`);
    } else {
      console.warn(
        `⚠️ CSRF token missing for ${config.method?.toUpperCase()} ${config.url}. ` +
        `This request may fail. Please refresh the page.`
      );
    }
  }
  
  return config;
});

// Add response interceptor to handle CSRF errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If we get a 403 with CSRF error and haven't retried yet, try to refresh the token
    if (
      error.response?.status === 403 &&
      error.response?.data?.detail?.includes('CSRF') &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      
      console.log('CSRF token error detected, attempting to refresh token...');
      
      try {
        // Fetch a fresh CSRF token
        await fetchAndStoreCsrfToken();
        
        // Update the original request with the new token
        const newToken = getCsrfToken();
        if (newToken) {
          originalRequest.headers['X-CSRFToken'] = newToken;
          console.log('CSRF token refreshed, retrying request...');
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Failed to refresh CSRF token:', refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);



