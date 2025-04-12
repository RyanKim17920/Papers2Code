// src/pages/PaperListPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Added useMemo back
import { fetchPapersFromApi } from '../services/api';
import { Paper } from '../types/paper';
import PaperCard from '../components/PaperCard';
import LoadingSpinner from '../components/LoadingSpinner';
import SearchBar from '../components/SearchBar';
import './PaperListPage.css'; // Ensure CSS is imported

const DEBOUNCE_DELAY = 500;

type SortOrder = 'newest' | 'oldest' | 'relevance'; // Add 'relevance' for search

const PaperListPage: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  // --- Add State for Sorting ---
  const [sortOrder, setSortOrder] = useState<SortOrder>('relevance'); // Default to relevance (backend order) or newest?
  const initialLoadLimit = 50; // Load a decent amount for sorting/searching

  // --- Debouncing Logic (Keep as is) ---
  useEffect(() => {
    const timerId = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, DEBOUNCE_DELAY);
    return () => { clearTimeout(timerId); };
  }, [searchTerm]);

  // --- API Fetching Logic (Keep as is) ---
  const loadPapers = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    setError(null);
    console.log(`Executing fetch with search: "${searchQuery}"`);
    try {
      // Backend handles search relevance sorting if searchQuery exists
      const fetchedPapers = await fetchPapersFromApi(initialLoadLimit, searchQuery);
      setPapers(fetchedPapers);
      // Set default sort order based on search
      setSortOrder(searchQuery ? 'relevance' : 'newest'); // Default to newest if no search, relevance if search
    } catch (err) {
      console.error("Failed to fetch papers:", err);
      setError(err instanceof Error ? err.message : "Failed to load papers. Is the backend running?");
      setPapers([]);
    } finally {
      setIsLoading(false);
    }
  }, [initialLoadLimit]); // useCallback dependency

  // --- Effect to Trigger Fetch (Keep as is) ---
  useEffect(() => {
    loadPapers(debouncedSearchTerm);
  }, [debouncedSearchTerm, loadPapers]);

  // --- Handler for Search Input (Keep as is) ---
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  // --- Handler for Sort Dropdown ---
  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOrder(event.target.value as SortOrder); // Update sort state
  };

  // --- Sorting Logic using useMemo ---
  const sortedAndFilteredPapers = useMemo(() => {
    // Start with the papers fetched from the API (already potentially filtered by search term on backend)
    let papersToSort = [...papers]; // Create a shallow copy to sort

    // Apply frontend sorting based on sortOrder state
    switch (sortOrder) {
      case 'newest':
        papersToSort.sort((a, b) => b.date.localeCompare(a.date)); // YYYY-MM-DD sorts correctly lexicographically
        break;
      case 'oldest':
        papersToSort.sort((a, b) => a.date.localeCompare(b.date));
        break;
      case 'relevance':
      default:
        // If 'relevance', we assume the backend already sorted by relevance (if search term provided)
        // or returned in its default order. So, no additional frontend sorting needed here.
        break;
    }
    return papersToSort; // Return the sorted (or original order) array
  }, [papers, sortOrder]); // Re-run sorting only if papers or sortOrder changes

  return (
    <div className="paper-list-page">
      <div className="list-header"> {/* Wrap heading and controls */}
        <h2>Papers Seeking Implementation</h2>
        <div className="list-controls">
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            placeholder="Search by title, abstract, or author..."
          />
          {/* --- Add Sort Dropdown --- */}
          <div className="sort-control">
            <label htmlFor="sort-order">Sort by:</label>
            <select id="sort-order" value={sortOrder} onChange={handleSortChange}>
              {/* Show relevance only if a search term exists */}
              {debouncedSearchTerm && <option value="relevance">Relevance</option>}
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- Display Area (use sortedAndFilteredPapers) --- */}
      <div className={`list-content-area ${isLoading ? 'loading' : ''}`}>
        {isLoading && <LoadingSpinner />}
        {error && <p className="error-message">Error loading papers: {error}</p>}
        {!isLoading && !error && (
          <div className="paper-list">
            {sortedAndFilteredPapers.length > 0 ? (
              sortedAndFilteredPapers.map((paper) => ( // Use the sorted array
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
              <p style={{'width':'100vw'}}>
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