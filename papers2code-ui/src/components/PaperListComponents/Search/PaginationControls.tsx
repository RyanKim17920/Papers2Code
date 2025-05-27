import React, { useState, useEffect } from 'react';
import getVisiblePages from '../../../functions/getVisiblePages'; // Assuming path

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
  const [inputError, setInputError] = useState<string | null>(null); // State for error message

  // Update input when currentPage changes externally
  useEffect(() => {
    setPageInput(currentPage.toString());
    setInputError(null); // Clear error when page changes externally
  }, [currentPage]);

  const handleGoToPage = () => {
    setInputError(null); // Clear previous error
    // --- FIX: Use base 10 for parsing ---
    const numericValue = parseInt(pageInput, 10);
    // --- END FIX ---

    if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= totalPages) {
      onPageChange(numericValue);
    } else {
      // --- FIX: Set error state instead of alert ---
      setInputError(`Page must be between 1 and ${totalPages}`);
      // Optionally reset input to current page if invalid, or leave it as is
      // setPageInput(currentPage.toString());
      // --- END FIX ---
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
    if (inputError) {
      setInputError(null); // Clear error on input change
    }
  };

  // ... (handleInputKeyDown remains the same) ...
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
      {/* ... existing PREV button ... */}
       <button
        className="nav-button"
        onClick={onPrev}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        ←
      </button>

      {/* Page Numbers */}
      {/* ... existing page number mapping ... */}
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
      {/* ... existing NEXT button ... */}
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
        <label htmlFor="page-input">Go to:</label>
        <div className="go-to-input-wrapper"> {/* Wrapper for input and error */}
          <input
            id="page-input"
            type="number"
            min="1"
            max={totalPages}
            value={pageInput}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            aria-label={`Enter page number, 1 to ${totalPages}`}
            aria-invalid={!!inputError} // Indicate invalid state for accessibility
            aria-describedby={inputError ? "page-input-error" : undefined} // Link error message
          />
          <button className="go-btn" onClick={handleGoToPage}>Go</button>
          {/* --- Render error message --- */}
          {inputError && <span id="page-input-error" className="page-input-error">{inputError}</span>}
        </div>
      </div>
    </div>
  );
};

export default PaginationControls;