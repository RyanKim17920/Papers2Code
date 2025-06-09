import React from 'react';
import { usePaperList, SortPreference } from '../common/hooks/usePaperList';
import { LoadingSpinner } from '../common/components';
import ListControls from '../components/paperList/Search/ListControls';
import PaperListDisplay from '../components/paperList/PaperListDisplay';
import PaginationControls from '../components/paperList/Search/PaginationControls';
import AdvancedSearchForm from '../components/paperList/Search/AdvancedSearchForm';
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
      <header className="page-header">
        <h1>Explore Research Papers</h1>
      </header>
      <div className="list-header">
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