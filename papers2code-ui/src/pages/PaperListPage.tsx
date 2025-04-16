// src/pages/PaperListPage.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Removed useMemo
import { fetchPapersFromApi } from '../services/api'; // Ensure this uses the updated version
import { Paper } from '../types/paper';
import PaperCard from '../components/PaperCard'; // Assuming component path
import LoadingSpinner from '../components/LoadingSpinner'; // Assuming component path
import SearchBar from '../components/SearchBar'; // Assuming component path
import './PaperListPage.css';

const DEBOUNCE_DELAY = 500;

// Keep track of the user's desired date sort preference separately
type DateSortPreference = 'newest' | 'oldest';

const PaperListPage: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  // State for the user's preferred date sorting
  const [dateSortPreference, setDateSortPreference] = useState<DateSortPreference>('newest');
  const initialLoadLimit = 50;

  // --- Debouncing Logic (Keep as is) ---
  useEffect(() => {
    const timerId = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, DEBOUNCE_DELAY);
    return () => { clearTimeout(timerId); };
  }, [searchTerm]);

  // --- Combined API Fetching Logic ---
  useEffect(() => {
    const loadPapers = async () => {
      setIsLoading(true);
      setError(null);

      // Determine the sort parameter to send to the backend
      // If there's a search term, backend handles relevance sort, so send nothing.
      // Otherwise, send the user's date sort preference.
      const sortParamToSend = debouncedSearchTerm ? undefined : dateSortPreference;

      console.log(`Workspaceing papers with search: "${debouncedSearchTerm}", sort: ${sortParamToSend || 'relevance (defaulted by backend)'}`);

      try {
        const fetchedPapers = await fetchPapersFromApi(
            initialLoadLimit,
            debouncedSearchTerm, // Send debounced search term
            sortParamToSend      // Send 'newest', 'oldest', or undefined
        );
        setPapers(fetchedPapers); // Set papers directly, backend handles sorting
      } catch (err) {
        console.error("Failed to fetch papers:", err);
        setError(err instanceof Error ? err.message : "Failed to load papers. Is the backend running?");
        setPapers([]); // Clear papers on error
      } finally {
        setIsLoading(false);
      }
    };

    loadPapers();
    // Re-run this effect whenever the search term OR the date sort preference changes
  }, [debouncedSearchTerm, dateSortPreference, initialLoadLimit]); // Add dateSortPreference

  // --- Handler for Search Input (Keep as is) ---
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  // --- Handler for Sort Dropdown ---
  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    // Update only the date sort preference state
    setDateSortPreference(event.target.value as DateSortPreference);
  };

  // --- No more frontend sorting needed ---
  // const sortedAndFilteredPapers = useMemo(() => { ... }); // REMOVED

  // Determine which sort option is effectively active for the dropdown UI
  const activeSortDisplay = debouncedSearchTerm ? 'relevance' : dateSortPreference;

  return (
    <div className="paper-list-page">
      <div className="list-header">
        <h2>Papers Seeking Implementation</h2>
        <div className="list-controls">
          <SearchBar
             // Assuming SearchBar takes these props - adjust if needed
             searchTerm={searchTerm} // Pass current (non-debounced) term for responsiveness
             onSearchChange={handleSearchChange} // Use consistent handler name maybe?
             placeholder="Search by title, abstract, or author..."
          />
          {/* --- Sort Dropdown --- */}
          <div className="sort-control">
            <label htmlFor="sort-order">Sort by:</label>
            {/* The value should reflect the effectively active sort */}
            <select id="sort-order" value={activeSortDisplay} onChange={handleSortChange}>
              {/* Show relevance option *only if* searching */}
              {debouncedSearchTerm && <option value="relevance">Relevance</option>}
              {/* Always show date options, but disable if searching? Or just let selection change dateSortPreference state */}
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- Display Area (uses 'papers' state directly) --- */}
      <div className={`list-content-area ${isLoading ? 'loading' : ''}`}>
        {isLoading && <LoadingSpinner />}
        {error && <p className="error-message">Error loading papers: {error}</p>}
        {!isLoading && !error && (
          <div className="paper-list">
            {/* Use 'papers' directly as it's already sorted by backend */}
            {papers.length > 0 ? (
              papers.map((paper) => (
                // Assuming PaperCard takes a summary object prop like 'paperSummary'
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
              <p style={{width:'100vw'}}> {/* Consider adjusting width styling */}
                {debouncedSearchTerm
                  ? `No papers found matching "${debouncedSearchTerm}".`
                  : "No implementable papers found." // Or a more general message
                }
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperListPage;