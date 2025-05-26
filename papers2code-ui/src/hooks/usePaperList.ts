import { useState, useEffect, useCallback } from 'react';
import { fetchPapersFromApi, voteOnPaperInApi, AdvancedPaperFilters } from '../services/api'; // Import voteOnPaperInApi and AdvancedPaperFilters
import { Paper } from '../types/paper';
import useDebounce from './useDebounce';

const DEBOUNCE_DELAY = 500;
const ITEMS_PER_PAGE = 12;

export type SortPreference = 'newest' | 'oldest' | 'upvotes'; // Update sort type

const initialAdvancedFilters: AdvancedPaperFilters = {
  startDate: '',
  endDate: '',
  searchAuthors: '',
};

export function usePaperList() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY);
  const [sortPreference, setSortPreference] = useState<SortPreference>('newest'); // Use updated type
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // --- NEW: State for advanced filters and visibility ---
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedPaperFilters>(initialAdvancedFilters);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  // Use a separate state to "apply" filters, avoiding fetches on every keystroke in advanced fields
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState<AdvancedPaperFilters>(initialAdvancedFilters);
  // --- End NEW ---

  // Reset currentPage when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, sortPreference]);

  // API Fetching Logic
  useEffect(() => {
    const loadPapers = async () => {
      setIsLoading(true);
      setError(null);

      // Determine if any search (basic or advanced) is active
      const isSearchActive = !!debouncedSearchTerm ||
                             !!appliedAdvancedFilters.startDate ||
                             !!appliedAdvancedFilters.endDate ||
                             !!appliedAdvancedFilters.searchAuthors;

      // Sort param: Use preference only if no search term *and* no advanced filters are active.
      // Backend defaults to relevance if any search criteria is present.
      const sortParamToSend = isSearchActive ? undefined : sortPreference;

      console.log(
        `Fetching page ${currentPage} with:`,
        `Term="${debouncedSearchTerm}",`,
        `Sort=${sortParamToSend || 'relevance (search active)'},`,
        `Filters=${JSON.stringify(appliedAdvancedFilters)}`
      );

      try {
        const response = await fetchPapersFromApi(
          currentPage,
          ITEMS_PER_PAGE,
          debouncedSearchTerm,
          sortParamToSend,
          appliedAdvancedFilters // <-- Pass applied filters
        );
        setPapers(response.papers);
        setTotalPages(response.totalPages);
      } catch (err) {
        console.error("Failed to fetch papers:", err);
        setError(err instanceof Error ? err.message : "Failed to load papers.");
        setPapers([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    };

    loadPapers();
    // Dependencies: include appliedAdvancedFilters
  }, [debouncedSearchTerm, sortPreference, currentPage, appliedAdvancedFilters]);

  // Handlers
  const handleSearchChange = useCallback((newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  }, []);

  const handleSortChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const isAnySearchActive = !!debouncedSearchTerm ||
                              !!appliedAdvancedFilters.startDate ||
                              !!appliedAdvancedFilters.endDate ||
                              !!appliedAdvancedFilters.searchAuthors;

     if (value === 'relevance' && isAnySearchActive) {
         console.log("Relevance selected with search criteria active.");
         // Keep underlying sort preference, backend handles relevance
     } else if (value !== 'relevance') {
         setSortPreference(value as SortPreference);
     }
  }, [debouncedSearchTerm, appliedAdvancedFilters]); // Depend on applied filters too

  const toggleAdvancedSearch = useCallback(() => {
    setShowAdvancedSearch(prev => !prev);
  }, []);

  const handleAdvancedFilterChange = useCallback((filterName: keyof AdvancedPaperFilters, value: string) => {
      setAdvancedFilters((prev: AdvancedPaperFilters) => ({ ...prev, [filterName]: value }));
  }, []);

  const applyAdvancedFilters = useCallback(() => {
      // Trigger fetch by updating the applied filters state
      setAppliedAdvancedFilters(advancedFilters);
      // Optionally close the advanced search form
      // setShowAdvancedSearch(false);
  }, [advancedFilters]);

  const clearAdvancedFilters = useCallback(() => {
      setAdvancedFilters(initialAdvancedFilters);
      setAppliedAdvancedFilters(initialAdvancedFilters); // Also clear applied filters
      // Optionally close the advanced search form
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
    try {
      const updatedPaper = await voteOnPaperInApi(paperId, voteType);
      // Update the specific paper in the local state
      setPapers(currentPapers =>
        currentPapers.map(p => (p.id === paperId ? updatedPaper : p))
      );
    } catch (error) {
      console.error(`Failed to update vote for paper ${paperId}:`, error);
      // Re-throw the error so the component can handle UI feedback
      throw error;
    }
  }, []); // No dependencies needed as it uses API and setPapers

  // Determine which sort option is effectively active for the dropdown UI
  const activeSortDisplay = debouncedSearchTerm ? 'relevance' : sortPreference;

  return {
    papers,
    isLoading,
    error,
    searchTerm,
    debouncedSearchTerm,
    activeSortDisplay,
    sortPreference,
    currentPage,
    totalPages,
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePrev,
    handleNext,
    handleVote,
    // --- NEW: Expose advanced search state and handlers ---
    showAdvancedSearch,
    advancedFilters, // Current values in the form
    appliedAdvancedFilters, // Filters used for the last fetch
    toggleAdvancedSearch,
    handleAdvancedFilterChange,
    applyAdvancedFilters,
    clearAdvancedFilters,
    // --- End NEW ---
  };
}