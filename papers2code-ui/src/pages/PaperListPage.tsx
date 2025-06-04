import React from 'react';
import { usePaperList, SortPreference } from '../hooks/usePaperList';
import LoadingSpinner from '../components/LoadingSpinner';
import ListControls from '../components/PaperListComponents/Search/ListControls';
import PaperListDisplay from '../components/PaperListComponents/PaperListDisplay';
import PaginationControls from '../components/PaperListComponents/Search/PaginationControls';
import AdvancedSearchForm from '../components/PaperListComponents/Search/AdvancedSearchForm'; // <-- Import Advanced Form
import './PaperListPage.css';

interface PaperListPageProps { // Create an interface for props
  authLoading: boolean;
}

const PaperListPage: React.FC<PaperListPageProps> = ({ authLoading }) => { // Destructure authLoading
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
    handleNext,    handleVote,    // --- NEW: Destructure advanced search state/handlers and search flags ---
    showAdvancedSearch,
    advancedFilters,
    toggleAdvancedSearch,
    handleAdvancedFilterChange,
    applyAdvancedFilters,
    clearAdvancedFilters,
    isTitleAbstractSearchActive,
    // --- End NEW ---
  } = usePaperList(authLoading); // Pass authLoading to the hook

  return (
    <div className="paper-list-page">
      <div className="list-header">
        <h1>Papers Without Implementation</h1>
        <ListControls
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          activeSortDisplay={activeSortDisplay as SortPreference | 'relevance'}          onSortChange={handleSortChange}
          isSearchInputActive={isTitleAbstractSearchActive}
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
      </div>      <div className="list-content-area">
        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            <PaperListDisplay
              papers={papers}
              debouncedSearchTerm={debouncedSearchTerm}
              onVote={handleVote}
              isLoading={isLoading}
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