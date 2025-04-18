import React from 'react';
import { usePaperList } from '../hooks/usePaperList'; // Import the main hook
import LoadingSpinner from '../components/LoadingSpinner';
import ListControls from '../components/PaperListComponents/ListControls'; // Import new component
import PaperListDisplay from '../components/PaperListComponents/PaperListDisplay'; // Import new component
import PaginationControls from '../components/PaperListComponents/PaginationControls'; // Import new component
import './PaperListPage.css'; // Keep page-specific styles

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
  } = usePaperList(); // Use the custom hook

  return (
    <div className="paper-list-page">
      <div className="list-header">
        <h2>Papers Seeking Implementation</h2>
        <ListControls
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          activeSortDisplay={activeSortDisplay}
          onSortChange={handleSortChange}
          isSearchActive={!!debouncedSearchTerm} // Pass boolean indicating if search is active
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