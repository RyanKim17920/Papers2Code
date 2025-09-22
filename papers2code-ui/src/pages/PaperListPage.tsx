import React, { useState } from 'react';
import { Search, SlidersHorizontal, Calendar, User, Filter, X } from 'lucide-react';
import { usePaperList, SortPreference } from '../common/hooks/usePaperList';
import { LoadingSpinner } from '../common/components';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import ModernPaperCard from '../components/paperList/ModernPaperCard';
import ModernPaginationControls from '../components/paperList/ModernPaginationControls';
import PaperListSkeleton from '../components/paperList/PaperListSkeleton';
import PaginationSkeleton from '../components/paperList/PaginationSkeleton';
import './PaperListPage.css';

interface PaperListPageProps {
  authLoading: boolean;
}

const PaperListPage: React.FC<PaperListPageProps> = ({ authLoading }) => {
  const [showFilters, setShowFilters] = useState(true);
  
  const {
    papers,
    isLoading,
    error,
    searchTerm,
    debouncedSearchTerm,
    activeSortDisplay,
    currentPage,
    totalPages,
  totalCount,
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
    handleApplyAdvancedFilters,
    handleClearAdvancedFilters,
    isSearchActive,
  } = usePaperList(authLoading);

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    handleAdvancedFilterChange(field, value);
  };

  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return '';
    return dateString;
  };

  const clearSearchTerm = () => {
    handleSearchChange('');
  };

  return (
    <div className="min-h-screen bg-background">
  <div className="container mx-auto px-4 pt-3 pb-6">

        <div className={`paper-list-layout ${showFilters ? 'with-filters' : 'no-filters'}`}>
          {/* Left Sidebar - Collapsible Filters */}
          <div className={`filter-sidebar ${showFilters ? 'visible' : 'hidden'}`}>
            <Card className="sticky top-6 filter-card">
              <CardContent className="p-0">
                {/* Filter Header */}
                <div className="filter-header">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    <span className="font-semibold">Filters</span>
                  </div>
                </div>
                
                <div className="filter-content">
                  {/* Search Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Search Papers</Label>
                    </div>
                    <Input
                      placeholder="Search by title, abstract..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <Separator />

                  {/* Sort Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Sort By</Label>
                    </div>
                    <select
                      value={activeSortDisplay}
                      onChange={handleSortChange}
                      disabled={isSearchActive}
                      className="w-full p-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {isSearchActive && <option value="relevance">Relevance</option>}
                      {!isSearchActive && (
                        <>
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                          <option value="upvotes">Most Upvoted</option>
                        </>
                      )}
                    </select>
                  </div>

                  <Separator />

                  {/* Date Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Publication Date</Label>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="start-date" className="text-xs text-muted-foreground">From</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={formatDateForInput(advancedFilters.startDate)}
                          onChange={(e) => handleDateChange('startDate', e.target.value)}
                          className="w-full mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date" className="text-xs text-muted-foreground">To</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={formatDateForInput(advancedFilters.endDate)}
                          onChange={(e) => handleDateChange('endDate', e.target.value)}
                          className="w-full mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Author Filter */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Authors</Label>
                    </div>
                    <Input
                      placeholder="e.g., Hinton, LeCun"
                      value={advancedFilters.searchAuthors || ''}
                      onChange={(e) => handleAdvancedFilterChange('searchAuthors', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Filter Actions */}
                  <div className="flex flex-col gap-2 pt-2">
                    <Button onClick={handleApplyAdvancedFilters} className="w-full">
                      Apply Filters
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleClearAdvancedFilters}
                      className="w-full"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="main-content">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                {/* Filter Toggle Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </Button>
                
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">
                    {debouncedSearchTerm 
                      ? `Showing ${totalCount} results for '${debouncedSearchTerm}'`
                      : `${totalCount} papers found`
                    }
                  </h2>
                  {debouncedSearchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSearchTerm}
                      className="flex items-center gap-1 px-2 py-1 h-6 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    >
                      <span className="text-xs">{debouncedSearchTerm}</span>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            {isLoading ? (
              <>
                <div className="space-y-3">
                  {/* Invisible Sizing Card to prevent horizontal layout shift */}
                  <div style={{ height: 0, overflow: 'hidden', visibility: 'hidden' }}>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold">
                        This is a very long sample title to correctly size the container width based on multi-line text wrapping behavior.
                      </h3>
                      <p className="text-sm text-muted-foreground/70 leading-relaxed">
                        This is a sample abstract that is also quite long, designed to simulate the content of a real paper card. The purpose of this text is purely for layout calculation. It will force the parent container to expand to its full width, preventing any horizontal layout shift when the actual paper data is loaded and rendered. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      </p>
                    </div>
                  </div>

                  <PaperListSkeleton count={12} />
                </div>
                <div className="mt-8">
                  <PaginationSkeleton />
                </div>
              </>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            ) : papers.length > 0 ? (
              <>
                <div className="space-y-3">
                  {papers.map((paper) => (
                    <ModernPaperCard
                      key={paper.id}
                      paper={paper}
                      onVote={handleVote}
                    />
                  ))}
                </div>
                
                {totalPages > 1 && (
                  <div className="mt-8">
                    <ModernPaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                      onPrev={handlePrev}
                      onNext={handleNext}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {debouncedSearchTerm 
                    ? `No papers found matching "${debouncedSearchTerm}"`
                    : 'No papers available'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperListPage;