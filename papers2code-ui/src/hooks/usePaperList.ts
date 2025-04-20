import { useState, useEffect, useCallback } from 'react';
import { fetchPapersFromApi, voteOnPaperInApi } from '../services/api'; // Import voteOnPaperInApi
import { Paper } from '../types/paper';
import useDebounce from './useDebounce';

const DEBOUNCE_DELAY = 500;
const ITEMS_PER_PAGE = 12;

export type SortPreference = 'newest' | 'oldest' | 'upvotes'; // Update sort type

export function usePaperList() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY);
  const [sortPreference, setSortPreference] = useState<SortPreference>('newest'); // Use updated type
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Reset currentPage when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, sortPreference]);

  // API Fetching Logic
  useEffect(() => {
    const loadPapers = async () => {
      setIsLoading(true);
      setError(null);

      // Determine sort param: use preference only if no search term exists
      // If search term exists, backend defaults to relevance. If 'upvotes' is selected without search, use it.
      const sortParamToSend = debouncedSearchTerm ? undefined : sortPreference;
      console.log(
        `Fetching page ${currentPage} with search: "${debouncedSearchTerm}", sort: ${sortParamToSend || 'relevance (search active)'}`
      );

      try {
        const response = await fetchPapersFromApi(
          currentPage,
          ITEMS_PER_PAGE,
          debouncedSearchTerm,
          sortParamToSend // Pass the determined sort param
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
  }, [debouncedSearchTerm, sortPreference, currentPage]); // Dependencies for fetching

  // Handlers
  const handleSearchChange = useCallback((newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  }, []);

  const handleSortChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    // Allow 'relevance' from dropdown if search is active, otherwise handle date/upvotes sort
    const value = event.target.value;
     if (value === 'relevance' && debouncedSearchTerm) {
         // While 'relevance' is selected, the actual sort param sent depends on search term presence
         // We don't set sortPreference to 'relevance', keep the underlying date/upvote preference
         // The UI display logic handles showing 'Relevance' correctly.
         console.log("Relevance selected with search term active.");
     } else {
         setSortPreference(value as SortPreference);
     }
  }, [debouncedSearchTerm]); // Add debouncedSearchTerm dependency

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
    activeSortDisplay, // Use this for the dropdown value
    sortPreference, // Keep the underlying preference state
    currentPage,
    totalPages,
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePrev,
    handleNext,
    handleVote, // Expose the vote handler
  };
}