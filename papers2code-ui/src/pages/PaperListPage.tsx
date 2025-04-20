import React from 'react';
import { usePaperList } from '../hooks/usePaperList';
import LoadingSpinner from '../components/LoadingSpinner';
import ListControls from '../components/PaperListComponents/ListControls';
import PaperListDisplay from '../components/PaperListComponents/PaperListDisplay';
import PaginationControls from '../components/PaperListComponents/PaginationControls';
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
    handleVote, // Get the vote handler from the hook
  } = usePaperList();

  return (
    <div className="paper-list-page">
      <div className="list-header">
        <h2>Papers Seeking Implementation</h2>
        <ListControls
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          activeSortDisplay={activeSortDisplay}
          onSortChange={handleSortChange}
          isSearchActive={!!debouncedSearchTerm}
        />
      </div>

      <div className="list-content-area">
        {isLoading && <LoadingSpinner />}

        {!isLoading && error && <div className="error-message">{error}</div>}

        {!isLoading && !error && (
          <>
            <PaperListDisplay
              papers={papers}
              debouncedSearchTerm={debouncedSearchTerm}
              onVote={handleVote} // Pass the vote handler down
            />
            {/* ... PaginationControls ... */}
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