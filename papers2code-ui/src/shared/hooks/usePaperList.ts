import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPapersFromApi, voteOnPaperInApi, AdvancedPaperFilters, AuthenticationError, CsrfError } from '../services/api';
import { Paper } from '../types/paper';
import useDebounce from './useDebounce';
import { useModal } from '@/shared/contexts/ModalContext';

const DEBOUNCE_DELAY = 500;
const ITEMS_PER_PAGE = 12;

export type SortPreference = 'newest' | 'oldest' | 'upvotes';
const DEFAULT_SORT_PREFERENCE: SortPreference = 'newest';

const initialAdvancedFilters: AdvancedPaperFilters = {
  startDate: '',
  endDate: '',
  searchAuthors: '',
  mainStatus: '',
  implStatus: '',
  hasOfficialImpl: undefined,
};

export function usePaperList(authLoading?: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  const prevSearchParamsRef = useRef(searchParams.toString());
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(() => searchParams.get('searchQuery') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY);
  const [sortPreference, setSortPreference] = useState<SortPreference>(() => {
    const sortFromUrl = searchParams.get('sort') as SortPreference;
    return sortFromUrl && ['newest', 'oldest', 'upvotes'].includes(sortFromUrl) ? sortFromUrl : 'newest';
  });
  const [currentPage, setCurrentPage] = useState<number>(
    () => parseInt(searchParams.get('page') || '1', 10)
  );
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const { showLoginPrompt } = useModal();
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedPaperFilters>(() => ({
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    searchAuthors: searchParams.get('searchAuthors') || '',
    mainStatus: searchParams.get('mainStatus') || '',
    implStatus: searchParams.get('implStatus') || '',
    hasOfficialImpl: searchParams.get('hasOfficialImpl') ? searchParams.get('hasOfficialImpl') === 'true' : undefined,
  }));
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState<AdvancedPaperFilters>(() => ({
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    searchAuthors: searchParams.get('searchAuthors') || '',
    mainStatus: searchParams.get('mainStatus') || '',
    implStatus: searchParams.get('implStatus') || '',
    hasOfficialImpl: searchParams.get('hasOfficialImpl') ? searchParams.get('hasOfficialImpl') === 'true' : undefined,
  }));

  // New state to control data loading based on auth status
  const [readyToLoadData, setReadyToLoadData] = useState(() => authLoading === undefined || authLoading === false);

  // Effect to update readyToLoadData based on authLoading prop
  useEffect(() => {
    if (authLoading === false) {
      setReadyToLoadData(true);
    } else if (authLoading === true) {
      setReadyToLoadData(false);
      setIsLoading(true); // Show loading spinner if auth is in progress
    }
    // If authLoading is undefined, readyToLoadData's initial state handles it.
  }, [authLoading, setIsLoading]);  useEffect(() => {
    const currentSearchParamsStr = searchParams.toString();
    
    if (currentSearchParamsStr !== prevSearchParamsRef.current) {
        const queryFromUrl = searchParams.get('searchQuery') || '';
        const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);
        const sortFromUrl = searchParams.get('sort') as SortPreference;
        const mainStatusFromUrl = searchParams.get('mainStatus') || '';
        const implStatusFromUrl = searchParams.get('implStatus') || '';
        
        // Update search term if different
        if (queryFromUrl !== searchTerm) {
            setSearchTerm(queryFromUrl);
        }
        
        // Update page if different
        if (pageFromUrl !== currentPage) {
            setCurrentPage(pageFromUrl);
        }
        
        // Update sort if different and valid
        if (sortFromUrl && ['newest', 'oldest', 'upvotes'].includes(sortFromUrl) && sortFromUrl !== sortPreference) {
            setSortPreference(sortFromUrl);
        }
        
        // Auto-apply filters from URL parameters
        const filtersFromUrl = {
          startDate: searchParams.get('startDate') || '',
          endDate: searchParams.get('endDate') || '',
          searchAuthors: searchParams.get('searchAuthors') || '',
          mainStatus: mainStatusFromUrl,
          implStatus: implStatusFromUrl,
          hasOfficialImpl: searchParams.get('hasOfficialImpl') ? searchParams.get('hasOfficialImpl') === 'true' : undefined,
        };
        
        // Only update filters if they're actually different to avoid triggering the reset effect
        const filtersChanged = JSON.stringify(filtersFromUrl) !== JSON.stringify(appliedAdvancedFilters);
        if (filtersChanged) {
          setAdvancedFilters(filtersFromUrl);
          setAppliedAdvancedFilters(filtersFromUrl);
        }
        
        prevSearchParamsRef.current = currentSearchParamsStr;
    }
  }, [searchParams]); // Simplified dependencies - only listen to searchParams changes


  const isSearchInputActive = !!searchTerm; 
  const isDebouncedSearchActive = !!debouncedSearchTerm;
  const isAuthorSearchActive = !!appliedAdvancedFilters.searchAuthors;

  const uiSortValue = isSearchInputActive ? 'relevance' : sortPreference;
  const activeSortDisplay = uiSortValue; // Added for clarity, can be used directly if preferred
  
  // REMOVED: URL writing effect that caused circular dependency
  // Now components update URL directly when user interacts with them


  // Reset page to 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, appliedAdvancedFilters]);
  // API Fetching Logic
  useEffect(() => {
    const abortController = new AbortController();
    
    const loadPapers = async () => {
      setError(null); 
      try {
        const sortForAPI = isDebouncedSearchActive ? undefined : sortPreference;
        const effectivePage = currentPage;

        const response = await fetchPapersFromApi(
          effectivePage,
          ITEMS_PER_PAGE,
          isAuthorSearchActive ? undefined : debouncedSearchTerm,
          sortForAPI,
          appliedAdvancedFilters,
          abortController.signal
        );

        if (!abortController.signal.aborted) {
          setPapers(response.papers);
          setTotalPages(response.totalPages);
          setTotalCount(response.totalCount);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError' && !abortController.signal.aborted) {
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
          setTotalCount(0);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    
    if (readyToLoadData) {
      setIsLoading(true); // Set loading true right before calling loadPapers
      loadPapers();
    } else {
      // Not ready to load (e.g., authLoading is true)
      // setIsLoading(true) is handled by the other effect.
      // Clearing papers here might be too aggressive, depends on desired UX.
      // setPapers([]); 
      // setTotalPages(1);
    }

    return () => {
      abortController.abort();
    };
  }, [
    readyToLoadData, 
    debouncedSearchTerm, 
    sortPreference, 
    currentPage, 
    appliedAdvancedFilters, 
    isDebouncedSearchActive, 
    isAuthorSearchActive, 
    fetchPapersFromApi, // Added fetchPapersFromApi as a dependency
    setIsLoading, 
    setError, 
    setPapers, 
    setTotalPages
  ]);

  const handleSearchChange = useCallback((newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    // Don't update URL here - let debouncedSearchTerm drive the fetch directly
  }, []);

  const handleSortChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as SortPreference | 'relevance';
    if (isSearchInputActive) {
        return; 
    }
    if (value !== 'relevance') {
      setSortPreference(value);
      
      // Update URL with new sort
      const newParams = new URLSearchParams(searchParams);
      if (value !== DEFAULT_SORT_PREFERENCE) {
        newParams.set('sort', value);
      } else {
        newParams.delete('sort');
      }
      setSearchParams(newParams, { replace: true });
    }
  }, [isSearchInputActive, searchParams, setSearchParams]);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    
    // Update URL with new page
    const newParams = new URLSearchParams(searchParams);
    if (newPage !== 1) {
      newParams.set('page', newPage.toString());
    } else {
      newParams.delete('page');
    }
    setSearchParams(newParams, { replace: true });
    
    window.scrollTo(0, 0);
  }, [searchParams, setSearchParams]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      
      // Update URL
      const newParams = new URLSearchParams(searchParams);
      if (newPage !== 1) {
        newParams.set('page', newPage.toString());
      } else {
        newParams.delete('page');
      }
      setSearchParams(newParams, { replace: true });
      
      window.scrollTo(0,0);
    }
  }, [currentPage, searchParams, setSearchParams]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      
      // Update URL
      const newParams = new URLSearchParams(searchParams);
      newParams.set('page', newPage.toString());
      setSearchParams(newParams, { replace: true });
      
      window.scrollTo(0,0);
    }
  }, [currentPage, totalPages, searchParams, setSearchParams]);

  const handleVote = async (paperId: string, voteType: 'up' | 'none') => {
    try {
      const updatedPaper = await voteOnPaperInApi(paperId, voteType);
      setPapers(prevPapers =>
        prevPapers.map(p => (p.id === paperId ? { ...p, ...updatedPaper } : p))
      );
    } catch (error: unknown) {
      console.error('Voting error:', error);
      if (error instanceof AuthenticationError || error instanceof CsrfError) {
        showLoginPrompt();
      } else if (error instanceof Error) {
        setError(error.message || 'Failed to vote. Please try again.');
      } else {
        setError('Failed to vote. Please try again.');
      }
    }
  };

  const toggleAdvancedSearch = () => {
    setShowAdvancedSearch(prev => !prev);
  };

  const handleAdvancedFilterChange = (filterName: keyof AdvancedPaperFilters, value: string) => {
    setAdvancedFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleApplyAdvancedFilters = () => {
    setAppliedAdvancedFilters(advancedFilters);
    // setCurrentPage(1); // This is handled by the useEffect dependency on appliedAdvancedFilters
    setShowAdvancedSearch(false); 
  };

  const handleClearAdvancedFilters = () => {
    setAdvancedFilters(initialAdvancedFilters);
    setAppliedAdvancedFilters(initialAdvancedFilters);
    // setCurrentPage(1); // This is handled by the useEffect dependency on appliedAdvancedFilters
  };
  
  const resetToDefaultSort = useCallback(() => {
    if (!isSearchInputActive) { // Only reset if search is not active (which locks to relevance)
        setSortPreference(DEFAULT_SORT_PREFERENCE);
    }
  }, [isSearchInputActive]);


  return {
    papers,
    isLoading,
    error,
    searchTerm,
    debouncedSearchTerm, // Added debouncedSearchTerm
    sortPreference: uiSortValue, // Show 'relevance' in UI when searching
    activeSortDisplay, // Added activeSortDisplay
    actualSortPreference: sortPreference, // Actual sort for non-search
    currentPage,
    totalPages,
  totalCount,
    showAdvancedSearch,
    advancedFilters,
    appliedAdvancedFilters,
    isSearchActive: isDebouncedSearchActive || isAuthorSearchActive, // Combined search active state
    isAuthorSearchActive, // Expose this specifically if needed by UI
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePrev, // Added handlePrev
    handleNext, // Added handleNext
    handleVote,
    toggleAdvancedSearch,
    handleAdvancedFilterChange,
    handleApplyAdvancedFilters,
    handleClearAdvancedFilters,
    resetToDefaultSort,
    setCurrentPage, // Expose setCurrentPage for direct manipulation if ever needed
  };
}