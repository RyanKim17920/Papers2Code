import React, { useState, useEffect } from 'react';
import getVisiblePages from '../../functions/getVisiblePages'; // Assuming path

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  onPrev,
  onNext,
}) => {
  const [pageInput, setPageInput] = useState(currentPage.toString());

  // Update input when currentPage changes externally
  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handleGoToPage = () => {
    const numericValue = parseInt(pageInput, 10);
    if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= totalPages) {
      onPageChange(numericValue);
    } else {
      alert(`Please enter a valid page number between 1 and ${totalPages}`);
      // Optionally reset input to current page if invalid
      setPageInput(currentPage.toString());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  // Don't render pagination if only one page
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination-container">
      {/* PREV Button */}
      <button
        className="nav-button"
        onClick={onPrev}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        ←
      </button>

      {/* Page Numbers */}
      <div className="page-buttons">
        {getVisiblePages(currentPage, totalPages, 2).map((item, idx) => {
          if (item === "…") {
            return <span key={`ellipsis-${idx}`} className="page-ellipsis" aria-hidden="true">…</span>;
          } else {
            const pageNumber = item as number;
            return (
              <button
                key={pageNumber}
                className={`page-btn ${currentPage === pageNumber ? 'active' : ''}`}
                onClick={() => onPageChange(pageNumber)}
                aria-label={`Go to page ${pageNumber}`}
                aria-current={currentPage === pageNumber ? 'page' : undefined}
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
        onClick={onNext}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        →
      </button>

      {/* Go to Page */}
      <div className="go-to-page">
        <label htmlFor="page-input">Go to:</label> {/* Added label for accessibility */}
        <input
          id="page-input"
          type="number"
          min="1"
          max={totalPages}
          value={pageInput}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          aria-label={`Enter page number, 1 to ${totalPages}`}
        />
        <button className="go-btn" onClick={handleGoToPage}>Go</button>
      </div>
    </div>
  );
};

export default PaginationControls;