import { useState, useEffect, useCallback } from 'react';
import { fetchPapersFromApi } from '../services/api';
import { Paper } from '../types/paper';
import useDebounce from './useDebounce'; // Import the debounce hook

const DEBOUNCE_DELAY = 500;
const ITEMS_PER_PAGE = 12; // Define items per page here

export type DateSortPreference = 'newest' | 'oldest';

export function usePaperList() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY);

  // Sort State
  const [dateSortPreference, setDateSortPreference] = useState<DateSortPreference>('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Reset currentPage when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, dateSortPreference]);

  // API Fetching Logic
  useEffect(() => {
    const loadPapers = async () => {
      setIsLoading(true);
      setError(null);
      // Determine sort param: use date preference only if no search term exists
      const sortParamToSend = debouncedSearchTerm ? undefined : dateSortPreference;
      console.log(
        `Fetching page ${currentPage} with search: "${debouncedSearchTerm}", sort: ${sortParamToSend || 'relevance (backend default)'}`
      );

      try {
        const response = await fetchPapersFromApi(
          currentPage,
          ITEMS_PER_PAGE,
          debouncedSearchTerm,
          sortParamToSend
        );
        setPapers(response.papers);
        setTotalPages(response.totalPages);
      } catch (err) {
        console.error("Failed to fetch papers:", err);
        setError(err instanceof Error ? err.message : "Failed to load papers.");
        setPapers([]); // Clear papers on error
        setTotalPages(1); // Reset total pages on error
      } finally {
        setIsLoading(false);
      }
    };

    loadPapers();
  }, [debouncedSearchTerm, dateSortPreference, currentPage]); // Dependencies for fetching

  // Handlers
  const handleSearchChange = useCallback((newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  }, []);

  const handleSortChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setDateSortPreference(event.target.value as DateSortPreference);
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

  // Determine which sort option is effectively active for the dropdown UI
  const activeSortDisplay = debouncedSearchTerm ? 'relevance' : dateSortPreference;

  return {
    // State
    papers,
    isLoading,
    error,
    searchTerm,
    debouncedSearchTerm,
    activeSortDisplay,
    currentPage,
    totalPages,
    // Handlers
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePrev,
    handleNext,
  };
}