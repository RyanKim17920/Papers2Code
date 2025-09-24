import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Calendar, User, Filter, X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePaperList, SortPreference } from '../common/hooks/usePaperList';
import { LoadingSpinner } from '../common/components';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import ModernPaperCard from '../components/paperList/ModernPaperCard';
import ModernPaginationControls from '../components/paperList/ModernPaginationControls';
import PaperListSkeleton from '../components/paperList/PaperListSkeleton';
import PaginationSkeleton from '../components/paperList/PaginationSkeleton';
import './PaperListPage.css';

interface PaperListPageProps {
  authLoading: boolean;
}

const PaperListPage: React.FC<PaperListPageProps> = ({ authLoading }) => {
  const [showSidebar, setShowSidebar] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('paperListShowSidebar');
      return saved ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem('paperListShowSidebar', String(showSidebar));
    } catch {
      // ignore storage errors
    }
  }, [showSidebar]);
  
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
      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar Toggle Button */}
        {!showSidebar && (
          <div className="fixed left-4 top-20 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(true)}
              className="shadow-md"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Left Sidebar - Filters */}
        {showSidebar && (
          <div className="w-80 p-6 border-r border-border bg-card/30 transition-all duration-300 ease-in-out">
          <div className="sticky top-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold mb-1">Research Papers</h1>
                <p className="text-sm text-muted-foreground">
                  {totalCount} {totalCount === 1 ? 'paper' : 'papers'} found
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(false)}
                className="p-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Title, abstract, keywords..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearchTerm}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {debouncedSearchTerm && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    Searching: "{debouncedSearchTerm}"
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Sort */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sort by</Label>
              <Select 
                value={activeSortDisplay} 
                onValueChange={(value) => handleSortChange({ target: { value } } as any)} 
                disabled={isSearchActive}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSearchActive && (
                    <SelectItem value="relevance">Relevance</SelectItem>
                  )}
                  {!isSearchActive && (
                    <>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="upvotes">Most Upvoted</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Advanced Filters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Advanced Filters</Label>
                {(advancedFilters.startDate || advancedFilters.endDate || advancedFilters.searchAuthors) && (
                  <Badge variant="secondary" className="h-5 w-5 p-0 text-xs rounded-full flex items-center justify-center">
                    !
                  </Badge>
                )}
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Publication Date
                </Label>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input
                      type="date"
                      value={formatDateForInput(advancedFilters.startDate)}
                      onChange={(e) => handleDateChange('startDate', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input
                      type="date"
                      value={formatDateForInput(advancedFilters.endDate)}
                      onChange={(e) => handleDateChange('endDate', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Authors */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <User className="w-3 h-3" />
                  Authors
                </Label>
                <Input
                  placeholder="e.g., Hinton, LeCun"
                  value={advancedFilters.searchAuthors || ''}
                  onChange={(e) => handleAdvancedFilterChange('searchAuthors', e.target.value)}
                />
              </div>

              {/* Filter Actions */}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleApplyAdvancedFilters} size="sm" className="flex-1">
                  Apply
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearAdvancedFilters}
                  className="flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Right Content Area */}
        <div className={`flex-1 p-6 transition-all duration-300 ease-in-out ${showSidebar ? '' : 'ml-0'}`}>
          {isLoading ? (
            <>
              <div className={`grid gap-4 ${showSidebar ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
                <PaperListSkeleton count={showSidebar ? 8 : 12} />
              </div>
              <div className="mt-8">
                <PaginationSkeleton />
              </div>
            </>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-destructive text-lg font-medium">{error}</p>
            </div>
          ) : papers.length > 0 ? (
            <>
              <div className={`grid gap-4 ${showSidebar ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
                {papers.map((paper) => (
                  <ModernPaperCard
                    key={paper.id}
                    paper={paper}
                    onVote={handleVote}
                    className="h-full"
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
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {debouncedSearchTerm ? 'No papers found' : 'No papers available'}
                </h3>
                <p className="text-muted-foreground">
                  {debouncedSearchTerm 
                    ? `Try adjusting your search terms or filters.`
                    : 'Check back later for new research papers.'}
                </p>
                {debouncedSearchTerm && (
                  <Button
                    variant="outline"
                    onClick={clearSearchTerm}
                    className="mt-4"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaperListPage;