import React from 'react';
import { usePaperList, SortPreference } from '../hooks/usePaperList';
import LoadingSpinner from '../components/LoadingSpinner';
import ListControls from '../components/PaperListComponents/Search/ListControls';
import PaperListDisplay from '../components/PaperListComponents/PaperListDisplay';
import PaginationControls from '../components/PaperListComponents/Search/PaginationControls';
import AdvancedSearchForm from '../components/PaperListComponents/Search/AdvancedSearchForm'; // <-- Import Advanced Form
import './PaperListPage.css';

const PaperListPage: React.FC = () => {
  const {
    papers,
    isLoading,
    error,
    searchTerm,
    debouncedSearchTerm,
    activeSortDisplay,
    currentPage,
    totalPages,
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePrev,
    handleNext,
    handleVote,
    // --- NEW: Destructure advanced search state/handlers ---
    showAdvancedSearch,
    advancedFilters,
    appliedAdvancedFilters, // Needed to determine if search is active
    toggleAdvancedSearch,
    handleAdvancedFilterChange,
    applyAdvancedFilters,
    clearAdvancedFilters,
    // --- End NEW ---
  } = usePaperList();

  // Determine if any search criteria is active for the ListControls component
  const isAnySearchActive = !!debouncedSearchTerm ||
                           !!appliedAdvancedFilters.startDate ||
                           !!appliedAdvancedFilters.endDate ||
                           !!appliedAdvancedFilters.searchAuthors;

  return (
    <div className="paper-list-page">
      <div className="list-header">
        <h1>Papers Without Implementation</h1>
        <ListControls
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          activeSortDisplay={activeSortDisplay as SortPreference | 'relevance'}
          onSortChange={handleSortChange}
          isSearchActive={isAnySearchActive} // <-- Use combined check
          onToggleAdvancedSearch={toggleAdvancedSearch} // <-- Pass handler
          showAdvancedSearch={showAdvancedSearch}     // <-- Pass state
        />
        {/* --- NEW: Conditionally render Advanced Search Form --- */}
        {showAdvancedSearch && (
          <AdvancedSearchForm
            filters={advancedFilters}
            onChange={handleAdvancedFilterChange}
            onApply={applyAdvancedFilters}
            onClear={clearAdvancedFilters}
            onClose={toggleAdvancedSearch} // Use toggle to close
          />
        )}
        {/* --- End NEW --- */}
      </div>

      <div className="list-content-area">
        {isLoading && <LoadingSpinner />}
        {/* ... rest of the component ... */}
        {!isLoading && error && <div className="error-message">{error}</div>}

        {!isLoading && !error && (
          <>
            <PaperListDisplay
              papers={papers}
              debouncedSearchTerm={debouncedSearchTerm}
              onVote={handleVote}
            />
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default PaperListPage;