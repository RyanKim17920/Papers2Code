import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPapersFromApi, voteOnPaperInApi, AdvancedPaperFilters, AuthenticationError, CsrfError } from '../services/api';
import { Paper } from '../types/paper';
import useDebounce from './useDebounce';
// NEW: Import useModal hook
import { useModal } from '../context/ModalContext';

const DEBOUNCE_DELAY = 500;
const ITEMS_PER_PAGE = 12;

export type SortPreference = 'newest' | 'oldest' | 'upvotes'; // Update sort type
const DEFAULT_SORT_PREFERENCE: SortPreference = 'newest';

const initialAdvancedFilters: AdvancedPaperFilters = {
  startDate: '',
  endDate: '',
  searchAuthors: '',
  // TODO: not defined yet but eventually will
};

export function usePaperList(authLoading?: boolean) { // authLoading is optional
  const [searchParams, setSearchParams] = useSearchParams();
  const prevSearchParamsRef = useRef(searchParams.toString()); // To detect actual changes
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading true to prevent flash of "No papers"
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY);
  const [sortPreference, setSortPreference] = useState<SortPreference>('newest'); // Use updated type
  const [currentPage, setCurrentPage] = useState<number>(
    () => parseInt(searchParams.get('page') || '1', 10)
  );
  const [totalPages, setTotalPages] = useState(1);

  // NEW: Get showLoginPrompt from useModal
  const { showLoginPrompt } = useModal();

  // --- NEW: State for advanced filters and visibility ---
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedPaperFilters>(() => ({
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    searchAuthors: searchParams.get('searchAuthors') || '',
  }));
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState<AdvancedPaperFilters>(() => ({
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    searchAuthors: searchParams.get('searchAuthors') || '',
  }));


  useEffect(() => {
    const currentSearchParamsStr = searchParams.toString();

    // Only proceed if searchParams have actually changed, to avoid loops with our own setSearchParams calls
    if (currentSearchParamsStr !== prevSearchParamsRef.current) {
        const queryFromUrl = searchParams.get('searchQuery') || '';
        if (queryFromUrl !== searchTerm) {
            setSearchTerm(queryFromUrl);
        }
        prevSearchParamsRef.current = currentSearchParamsStr; // Update the ref
    }
  }, [searchParams]); // Only trigger when the searchParams object reference changes


  const isSearchInputActive = !!searchTerm; 
  const isDebouncedSearchActive = !!debouncedSearchTerm;
  const isAuthorSearchActive = !!appliedAdvancedFilters.searchAuthors; // Remains based on applied filters

  // Determines the value shown in the sort dropdown
  const uiSortValue = isSearchInputActive ? 'relevance' : sortPreference;


  useEffect(() => {
    const newParams = new URLSearchParams();
    if (debouncedSearchTerm) { // Use debounced term for URL's searchQuery
      newParams.set('searchQuery', debouncedSearchTerm);
    }
    if (currentPage !== 1) {
      newParams.set('page', currentPage.toString());
    }

    // Sort param in URL should reflect the sort that would be used by API
    // If a debounced search is active, API uses relevance (undefined sort), so don't put 'sort' in URL
    if (!isDebouncedSearchActive && sortPreference !== DEFAULT_SORT_PREFERENCE) {
      newParams.set('sort', sortPreference);
    }
    // else if (isDebouncedSearchActive && newParams.has('sort')) { // Redundant if above is correct
    //   newParams.delete('sort');
    // }


    // Add applied advanced filters to URL
    if (appliedAdvancedFilters.startDate) newParams.set('startDate', appliedAdvancedFilters.startDate);
    if (appliedAdvancedFilters.endDate) newParams.set('endDate', appliedAdvancedFilters.endDate);
    if (appliedAdvancedFilters.searchAuthors) newParams.set('searchAuthors', appliedAdvancedFilters.searchAuthors);
    /*
    TODO: Future advanced filters
    if (appliedAdvancedFilters.mainStatus) newParams.set('mainStatus', appliedAdvancedFilters.mainStatus);
    if (appliedAdvancedFilters.implStatus) newParams.set('implStatus', appliedAdvancedFilters.implStatus);
    if (appliedAdvancedFilters.hasOfficialImpl !== undefined) newParams.set('hasOfficialImpl', String(appliedAdvancedFilters.hasOfficialImpl));
    if (appliedAdvancedFilters.venue) newParams.set('venue', appliedAdvancedFilters.venue);
    if (appliedAdvancedFilters.tags && appliedAdvancedFilters.tags.length > 0) newParams.set('tags', appliedAdvancedFilters.tags.join(','));
    */
    setSearchParams(newParams, { replace: true });
  }, [debouncedSearchTerm, currentPage, sortPreference, appliedAdvancedFilters, setSearchParams, isDebouncedSearchActive]);


  // Reset currentPage when search, sort, or applied advanced filters change
  // This effect should run *after* the URL has potentially set initial values
  useEffect(() => {
    // Only reset if it's not the initial load (i.e., currentPage is already set from URL)
    // This check might need refinement based on how initial state from URL is handled.
    // For now, we assume that if any of these primary filters change, we go to page 1.
    setCurrentPage(1);
  }, [debouncedSearchTerm, sortPreference, appliedAdvancedFilters]);

  useEffect(() => {
    // Check if it's not the very first load where currentPage might be set from URL
    // This simple check might need refinement if complex initial state scenarios arise
    if (currentPage !== 1 && (debouncedSearchTerm || sortPreference !== DEFAULT_SORT_PREFERENCE || JSON.stringify(appliedAdvancedFilters) !== JSON.stringify(initialAdvancedFilters))) {
        setCurrentPage(1);
    } else if (currentPage === 1 && (debouncedSearchTerm || sortPreference !== DEFAULT_SORT_PREFERENCE || JSON.stringify(appliedAdvancedFilters) !== JSON.stringify(initialAdvancedFilters))) {
        // If already on page 1 but filters change, ensure it stays 1 (no explicit call needed unless other logic depends on it)
    }
  }, [debouncedSearchTerm, sortPreference, appliedAdvancedFilters]);  // API Fetching Logic
  useEffect(() => {
    const abortController = new AbortController();
    
    setIsLoading(true);
    
    const loadPapers = async () => {
      setError(null);
      try {
        const sortForAPI = isDebouncedSearchActive ? undefined : sortPreference;
        const effectivePage = currentPage;

        // Corrected call to fetchPapersFromApi
        const response = await fetchPapersFromApi(
          effectivePage, // page
          ITEMS_PER_PAGE, // limit
          // If author search is active, general searchTerm is not used for title/abstract by this API endpoint structure.
          // The backend /papers/ endpoint uses `searchQuery` for title/abstract and `searchAuthors` for authors.
          // `advancedFilters.searchAuthors` will be used if `isAuthorSearchActive` is true.
          // If only general search is active, `debouncedSearchTerm` is passed as `searchTerm`.
          isAuthorSearchActive ? undefined : debouncedSearchTerm, // searchTerm (for title/abstract)
          sortForAPI, // sort
          appliedAdvancedFilters, // advancedFilters (contains searchAuthors, startDate, endDate)
          abortController.signal // signal
        );

        if (!abortController.signal.aborted) {
          setPapers(response.papers);
          setTotalPages(response.totalPages);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && !abortController.signal.aborted) {
          console.error("Failed to fetch papers:", err);
          if (err instanceof AuthenticationError) {
            setError("Authentication failed. Please log in again.");
          } else if (err instanceof CsrfError) {
            setError("Session expired or invalid. Please refresh the page.");
          } else {
            setError(err.message || 'Failed to fetch papers. Please try again later.');
          }
          setPapers([]);
          setTotalPages(1);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    
    if (authLoading === false) {
      loadPapers();
    } else if (authLoading === undefined) {
      loadPapers(); 
    } else {
      // isLoading remains true if authLoading is true
    }
    return () => {
      abortController.abort();
    };
  }, [debouncedSearchTerm, sortPreference, currentPage, appliedAdvancedFilters, authLoading, isDebouncedSearchActive, isAuthorSearchActive, fetchPapersFromApi, showLoginPrompt, setIsLoading, setError, setPapers, setTotalPages]); // Added setIsLoading, setError, setPapers, setTotalPages to dependencies

  const handleSearchChange = useCallback((newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  }, []);

  const handleSortChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as SortPreference | 'relevance';
    // This check is based on immediate search input, as dropdown is disabled based on it
    if (isSearchInputActive) { // Use isSearchInputActive
        return; // Sort is locked to relevance
    }

    if (value !== 'relevance') { // User selected 'newest', 'oldest', or 'upvotes'
        setSortPreference(value as SortPreference);
    } else { // User selected 'relevance' (only possible if !isSearchInputActive && isAuthorSearchActive)
        setSortPreference(DEFAULT_SORT_PREFERENCE); // Treat 'relevance' selection as default for API
    }
  }, [isSearchInputActive]); // Dependency updated

  const toggleAdvancedSearch = useCallback(() => {
    setShowAdvancedSearch(prev => !prev);
  }, []);

  const handleAdvancedFilterChange = useCallback((filterName: keyof AdvancedPaperFilters, value: string) => {
      setAdvancedFilters((prev: AdvancedPaperFilters) => ({ ...prev, [filterName]: value }));
  }, []);

  const applyAdvancedFilters = useCallback(() => {
      // Trigger fetch by updating the applied filters state
      setAppliedAdvancedFilters(advancedFilters);
      // Optionally, close the advanced search form
      // setShowAdvancedSearch(false);
  }, [advancedFilters]);

  const clearAdvancedFilters = useCallback(() => {
      setAdvancedFilters(initialAdvancedFilters);
      setAppliedAdvancedFilters(initialAdvancedFilters); // Also clear applied filters
      // Optionally, close the advanced search form
      // setShowAdvancedSearch(false);
  }, []);

  const handlePageChange = useCallback((pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  }, [totalPages]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);

  // --- NEW: Handle Vote Update ---
  const handleVote = useCallback(async (paperId: string, voteType: 'up' | 'none') => {
    // NEW: Check for currentUser before making API call. 
    // This hook doesn't have direct access to currentUser, so the calling component (PaperCard)
    // should ideally perform this check. However, to ensure the modal is shown if an error occurs
    // even if the component doesn't check, we handle errors here.
    try {
      const updatedPaper = await voteOnPaperInApi(paperId, voteType);
      setPapers(currentPapers =>
        currentPapers.map(p => (p.id === paperId ? updatedPaper : p))
      );
    } catch (error) {
      console.error(`Failed to update vote for paper ${paperId}:`, error);
      // MODIFIED: Handle AuthenticationError and CsrfError by showing login prompt
      if (error instanceof AuthenticationError || error instanceof CsrfError) {
        showLoginPrompt("Please connect with GitHub to vote.");
        // Optionally, set a local error state if needed by the calling component
        // setError(error.message); 
      } else if (error instanceof Error) {
        setError(error.message); // Set a generic error for other issues
      } else {
        setError("An unknown error occurred while voting.");
      }
      // Do not re-throw if we handled it by showing the prompt, 
      // unless the calling component needs to do further specific error handling.
    }
  }, [showLoginPrompt]); // Added showLoginPrompt to dependencies

  return {
    papers,
    isLoading,
    error,
    searchTerm,
    debouncedSearchTerm,
    activeSortDisplay: uiSortValue, // For select value, reacts immediately to searchTerm
    sortPreference, 
    currentPage,
    totalPages,
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePrev,
    handleNext,
    handleVote,
    showAdvancedSearch,
    advancedFilters,
    appliedAdvancedFilters,
    toggleAdvancedSearch,
    handleAdvancedFilterChange,
    applyAdvancedFilters,
    clearAdvancedFilters,
    isTitleAbstractSearchActive: isSearchInputActive, // Prop for ListControls, reacts immediately
    isAuthorSearchActive,
  };
}