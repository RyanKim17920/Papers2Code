// src/pages/PaperListPage.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { fetchPapersFromApi } from '../services/api';
import { Paper } from '../types/paper';
import PaperCard from '../components/PaperCard';
import LoadingSpinner from '../components/LoadingSpinner';
import SearchBar from '../components/SearchBar';
import './PaperListPage.css';

const DEBOUNCE_DELAY = 500; // Delay in ms (e.g., 500ms)

const PaperListPage: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Tracks initial load & search loading
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(''); // Value in the search input
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>(''); // Value used for API query
  const initialLoadLimit = 12;

  // --- Debouncing Logic ---
  useEffect(() => {
    // Set up a timer whenever searchTerm changes
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm); // Update debounced term after delay
    }, DEBOUNCE_DELAY);

    // Clear the previous timer if searchTerm changes again before delay finishes
    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]); // Effect runs when searchTerm changes

  // --- API Fetching Logic ---
  // Use useCallback to memoize this function
  const loadPapers = useCallback(async (searchQuery: string) => {
    setIsLoading(true); // Show loading spinner during fetch
    setError(null);
    console.log(`Executing fetch with search: "${searchQuery}"`); // Debug log
    try {
      // Pass the debounced search term to the API
      const fetchedPapers = await fetchPapersFromApi(initialLoadLimit, searchQuery);
      setPapers(fetchedPapers);
    } catch (err) {
      console.error("Failed to fetch papers:", err);
      setError(err instanceof Error ? err.message : "Failed to load papers. Is the backend running?");
      setPapers([]); // Clear papers on error
    } finally {
      setIsLoading(false);
    }
  }, [initialLoadLimit]); // Dependency: initialLoadLimit (though it's constant here)

  // --- Effect to Trigger Fetch based on Debounced Term ---
  useEffect(() => {
    // Trigger the API call when the debouncedSearchTerm changes
    // This includes the initial load (debouncedSearchTerm starts as '')
    loadPapers(debouncedSearchTerm);
  }, [debouncedSearchTerm, loadPapers]); // Dependencies: debounced term and the memoized load function

  // --- Handler for Search Input ---
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm); // Update the input value immediately
    // Do NOT trigger fetch here directly, wait for debounce effect
  };

  return (
    <div className="paper-list-page">
      <h2>Papers Seeking Implementation</h2>

      <SearchBar
        searchTerm={searchTerm} // Controlled component using immediate search term
        onSearchChange={handleSearchChange}
        placeholder="Search by title, abstract, or author..."
      />

      {/* Display area uses isLoading state */}
      <div className={`list-content-area ${isLoading ? 'loading' : ''}`}>
        {isLoading && <LoadingSpinner />}
        {error && <p className="error-message">Error loading papers: {error}</p>}
        {!isLoading && !error && (
          <div className="paper-list">
            {papers.length > 0 ? (
              papers.map((paper) => ( // Render papers directly from state
                <PaperCard key={paper.id} paper={{
                  id: paper.id,
                  pwcUrl: paper.pwcUrl,
                  title: paper.title,
                  authors: paper.authors,
                  date: paper.date,
                  implementationStatus: paper.implementationStatus,
                  isImplementable: paper.isImplementable
                }} />
              ))
            ) : (
              // Updated 'no results' message logic
              <p>
                {debouncedSearchTerm
                  ? `No papers found matching "${debouncedSearchTerm}".`
                  : "No implementable papers found."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperListPage;