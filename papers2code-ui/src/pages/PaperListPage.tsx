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
    handleNext,
    handleVote,
    showAdvancedSearch,
    advancedFilters,
    toggleAdvancedSearch,
    handleAdvancedFilterChange,
    handleApplyAdvancedFilters, // Corrected to match the hook's returned name
    handleClearAdvancedFilters, // Corrected to match the hook's returned name
    isSearchActive, // Corrected to match the hook's returned name (isSearchActive or isDebouncedSearchActive)
  } = usePaperList(authLoading); // Pass authLoading to the hook

  return (
    <div className="paper-list-page">
      <header className="page-header">
        <h1>Explore Research Papers</h1>
      </header>
      <div className="list-header">
        <div className="search-section">
          <h2>Search Papers</h2>
          <ListControls
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            activeSortDisplay={activeSortDisplay as SortPreference | 'relevance'} // This was activeSortDisplay, ensure it's what you want from the hook
            onSortChange={handleSortChange}
            isSearchInputActive={isSearchActive} // Corrected to use isSearchActive from the hook
            onToggleAdvancedSearch={toggleAdvancedSearch} // <-- Pass handler
            showAdvancedSearch={showAdvancedSearch}     // <-- Pass state
          />
        </div>
        {showAdvancedSearch && (
          <div className="filter-section">
            <h3>Advanced Filters</h3>
            <AdvancedSearchForm
              filters={advancedFilters}
              onChange={handleAdvancedFilterChange}
              onApply={handleApplyAdvancedFilters} // Corrected to use handleApplyAdvancedFilters
              onClear={handleClearAdvancedFilters} // Corrected to use handleClearAdvancedFilters
              onClose={toggleAdvancedSearch} // Use toggle to close
            />
          </div>
        )}}
      </div>     
       <div className="list-content-area">
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
              showAdvancedSearch={showAdvancedSearch}
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