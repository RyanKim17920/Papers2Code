// src/pages/PaperListPage.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Removed useMemo
import { fetchPapersFromApi } from '../services/api'; // Ensure this uses the updated version
import { Paper } from '../types/paper';
import PaperCard from '../components/PaperCard'; // Assuming component path
import LoadingSpinner from '../components/LoadingSpinner'; // Assuming component path
import SearchBar from '../components/SearchBar'; // Assuming component path
import getVisiblePages from '../functions/getVisiblePages'; // Assuming this is a utility function for pagination
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

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState(currentPage.toString());
  const itemsPerPage = 3; // Load 10 items per page

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  // Reset currentPage on search or sort changes:
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, dateSortPreference]);

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
      const sortParamToSend = debouncedSearchTerm ? undefined : dateSortPreference;
      console.log(
        `Fetching page ${currentPage} with search: "${debouncedSearchTerm}", sort: ${sortParamToSend || 'relevance (backend default)'}`
      );
      try {
        // Updated API call: pass currentPage and itemsPerPage.
        const response = await fetchPapersFromApi(
          currentPage,
          itemsPerPage,
          debouncedSearchTerm,
          sortParamToSend
        );
        // Set papers and pagination metadata
        setPapers(response.papers);
        setTotalPages(response.totalPages);
      } catch (err) {
        console.error("Failed to fetch papers:", err);
        setError(err instanceof Error ? err.message : "Failed to load papers.");
        setPapers([]);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadPapers();
  }, [debouncedSearchTerm, dateSortPreference, currentPage]);

  // --- Handler for Search Input (Keep as is) ---
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  const handleGoToPage = () => {
    const numericValue = parseInt(pageInput, 10);
    if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= totalPages) {
      setCurrentPage(numericValue);
    } else {
      alert('Please enter a valid page number between 1 and ' + totalPages);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
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


      {!isLoading && !error && (
        <>
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
          {!isLoading && !error && totalPages > 1 && (
      <div className="pagination-container">
        {/* PREV Button */}
        <button
          className="nav-button"
          onClick={handlePrev}
          disabled={currentPage === 1}
        >
          ←
        </button>

        {/* Page Numbers */}
        <div className="page-buttons">
          {getVisiblePages(currentPage, totalPages, 2).map((item, idx) => {
            if (item === "…") {
              return <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>;
            } else {
              const pageNumber = item as number;
              return (
                <button
                  key={pageNumber}
                  className={`page-btn ${currentPage === pageNumber ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            }
          })}
        </div>

        {/* NEXT Button */}
        <button
          className="nav-button"
          onClick={handleNext}
          disabled={currentPage === totalPages}
        >
          →
        </button>

        {/* Go to Page */}
        <div className="go-to-page">
          <span>Go to:</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
          />
          <button className="go-btn" onClick={handleGoToPage}>Go</button>
        </div>
      </div>
    )}
        </>
      )}
      </div>
  );
};

export default PaperListPage;