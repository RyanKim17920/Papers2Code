import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPapersFromApi, voteOnPaperInApi, AdvancedPaperFilters, AuthenticationError, CsrfError } from '../services/api';
import { Paper } from '../types/paper';
import useDebounce from './useDebounce';
import { useModal } from '../context/ModalContext';

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
  const [sortPreference, setSortPreference] = useState<SortPreference>('newest');
  const [currentPage, setCurrentPage] = useState<number>(
    () => parseInt(searchParams.get('page') || '1', 10)
  );
  const [totalPages, setTotalPages] = useState(1);
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
    console.log('🔍 URL params changed:', currentSearchParamsStr);
    
    if (currentSearchParamsStr !== prevSearchParamsRef.current) {
        const queryFromUrl = searchParams.get('searchQuery') || '';
        const mainStatusFromUrl = searchParams.get('mainStatus') || '';
        const implStatusFromUrl = searchParams.get('implStatus') || '';
        
        console.log('📥 Reading from URL:', {
          searchQuery: queryFromUrl,
          mainStatus: mainStatusFromUrl,
          implStatus: implStatusFromUrl
        });
        
        if (queryFromUrl !== searchTerm) {
            console.log('📝 Setting searchTerm:', queryFromUrl);
            setSearchTerm(queryFromUrl);
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
        
        console.log('🔧 Auto-applying filters from URL:', filtersFromUrl);
        
        // Update both filter states when URL changes
        setAdvancedFilters(filtersFromUrl);
        setAppliedAdvancedFilters(filtersFromUrl);
        
        prevSearchParamsRef.current = currentSearchParamsStr;
    }
  }, [searchParams]); // Remove searchTerm from dependencies to avoid circular updates


  const isSearchInputActive = !!searchTerm; 
  const isDebouncedSearchActive = !!debouncedSearchTerm;
  const isAuthorSearchActive = !!appliedAdvancedFilters.searchAuthors;

  const uiSortValue = isSearchInputActive ? 'relevance' : sortPreference;
  const activeSortDisplay = uiSortValue; // Added for clarity, can be used directly if preferred
  useEffect(() => {
    const newParams = new URLSearchParams();
    
    // Always preserve searchQuery if it exists (either from current state or URL)
    const currentSearchQuery = debouncedSearchTerm || searchParams.get('searchQuery');
    if (currentSearchQuery) {
      newParams.set('searchQuery', currentSearchQuery);
    }
    
    if (currentPage !== 1) {
      newParams.set('page', currentPage.toString());
    }
    if (!isDebouncedSearchActive && sortPreference !== DEFAULT_SORT_PREFERENCE) {
      newParams.set('sort', sortPreference);
    }
    
    // Preserve all advanced filter parameters
    if (appliedAdvancedFilters.startDate) newParams.set('startDate', appliedAdvancedFilters.startDate);
    if (appliedAdvancedFilters.endDate) newParams.set('endDate', appliedAdvancedFilters.endDate);
    if (appliedAdvancedFilters.searchAuthors) newParams.set('searchAuthors', appliedAdvancedFilters.searchAuthors);
    if (appliedAdvancedFilters.mainStatus) newParams.set('mainStatus', appliedAdvancedFilters.mainStatus);
    if (appliedAdvancedFilters.implStatus) newParams.set('implStatus', appliedAdvancedFilters.implStatus);
    if (appliedAdvancedFilters.hasOfficialImpl !== undefined) newParams.set('hasOfficialImpl', String(appliedAdvancedFilters.hasOfficialImpl));
    
    // Check if newParams are different from current searchParams before setting
    // to avoid unnecessary re-renders and effect runs.
    if (newParams.toString() !== searchParams.toString()) {
        setSearchParams(newParams, { replace: true });
    }
  }, [debouncedSearchTerm, currentPage, sortPreference, appliedAdvancedFilters, setSearchParams, isDebouncedSearchActive, searchParams]);


  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, sortPreference, appliedAdvancedFilters]);
  // API Fetching Logic
  useEffect(() => {
    const abortController = new AbortController();
    
    const loadPapers = async () => {
      setError(null); 
      try {
        const sortForAPI = isDebouncedSearchActive ? undefined : sortPreference;
        const effectivePage = currentPage;

        console.log('🚀 Making API call with:', {
          page: effectivePage,
          limit: ITEMS_PER_PAGE,
          searchTerm: isAuthorSearchActive ? undefined : debouncedSearchTerm,
          sort: sortForAPI,
          appliedAdvancedFilters: appliedAdvancedFilters
        });

        const response = await fetchPapersFromApi(
          effectivePage,
          ITEMS_PER_PAGE,
          isAuthorSearchActive ? undefined : debouncedSearchTerm,
          sortForAPI,
          appliedAdvancedFilters,
          abortController.signal
        );

        console.log('✅ API response received:', {
          totalPapers: response.papers.length,
          totalPages: response.totalPages
        });

        if (!abortController.signal.aborted) {
          setPapers(response.papers);
          setTotalPages(response.totalPages);
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
  }, []);

  const handleSortChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as SortPreference | 'relevance';
    if (isSearchInputActive) {
        return; 
    }
    if (value !== 'relevance') {
      setSortPreference(value);
    }
  }, [isSearchInputActive]);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  }, []);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo(0,0);
    }
  }, [currentPage]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo(0,0);
    }
  }, [currentPage, totalPages]);

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