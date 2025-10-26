import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import getVisiblePages from '@/shared/utils/getVisiblePages';

interface ModernPaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

const ModernPaginationControls: React.FC<ModernPaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  onPrev,
  onNext,
}) => {
  const [pageInput, setPageInput] = useState(currentPage.toString());
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    setPageInput(currentPage.toString());
    setInputError(null);
  }, [currentPage]);

  const handleGoToPage = () => {
    setInputError(null);
    const numericValue = parseInt(pageInput, 10);

    if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= totalPages) {
      onPageChange(numericValue);
    } else {
      setInputError(`Page must be between 1 and ${totalPages}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
    if (inputError) {
      setInputError(null);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
  <div className="flex items-center justify-center gap-5 py-5">
      {/* Previous Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={currentPage === 1}
        className="flex items-center gap-1 h-9"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </Button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {getVisiblePages(currentPage, totalPages, 2).map((item, idx) => {
          if (item === "…") {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 py-1 text-muted-foreground">
                …
              </span>
            );
          } else {
            const pageNumber = item as number;
            return (
              <Button
                key={pageNumber}
                variant={currentPage === pageNumber ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNumber)}
                className="min-w-[2.5rem] h-9 px-0"
              >
                {pageNumber}
              </Button>
            );
          }
        })}
      </div>

      {/* Next Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="flex items-center gap-1 h-9"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </Button>

      {/* Go to Page */}
      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm text-muted-foreground">Go to:</span>
        <div className="relative">
          <Input
            type="number"
            min="1"
            max={totalPages}
            value={pageInput}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            className="w-16 text-center text-sm"
            placeholder="Page"
          />
          {inputError && (
            <div className="absolute top-full left-0 mt-1 text-xs text-destructive bg-destructive/10 p-1 rounded whitespace-nowrap z-10">
              {inputError}
            </div>
          )}
        </div>
        <Button size="sm" onClick={handleGoToPage}>
          Go
        </Button>
      </div>
    </div>
  );
};

export default ModernPaginationControls;