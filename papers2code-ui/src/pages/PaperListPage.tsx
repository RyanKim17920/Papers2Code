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
      {/* Header when sidebar is closed */}
      {!showSidebar && (
  <div className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSidebar(true)}
                className="flex items-center gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                <span>Filters</span>
              </Button>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">
                  {totalCount} {totalCount === 1 ? 'Paper' : 'Papers'}
                </h1>
              </div>
              {/* Active Filters Display */}
              <div className="flex items-center gap-2 flex-wrap">
                {debouncedSearchTerm && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    "{debouncedSearchTerm.length > 20 ? debouncedSearchTerm.substring(0, 20) + '...' : debouncedSearchTerm}"
                  </Badge>
                )}
                {advancedFilters.startDate && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    From: {advancedFilters.startDate}
                  </Badge>
                )}
                {advancedFilters.endDate && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    To: {advancedFilters.endDate}
                  </Badge>
                )}
                {advancedFilters.searchAuthors && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {advancedFilters.searchAuthors}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex max-w-7xl mx-auto">
        {/* Left Sidebar - Filters */}
        {showSidebar && (
          <div className="w-80 lg:w-80 md:w-72 sm:w-64 border-r border-border bg-card hidden sm:block">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
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
              <div className="space-y-2 mb-6">
                <Label className="text-sm font-medium">Search Papers</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Title, abstract, keywords..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 pr-8"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSearchTerm}
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
                    >
                      <X className="w-4 h-4" />
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

              <Separator className="mb-6" />

              {/* Sort */}
              <div className="space-y-2 mb-6">
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

              <Separator className="mb-6" />
            </div>

            {/* Advanced Filters - Sticky */}
            <div className="sticky top-16 z-10 bg-card p-6 pt-0 space-y-4">
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
        )}

        {/* Mobile Fullscreen Search & Filters */}
        {showSidebar && (
          <div className="sm:hidden fixed inset-0 z-50 bg-background">
            <div className="flex flex-col h-full animate-slide-in-right">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="text-sm font-semibold">Filters</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {totalCount} {totalCount === 1 ? 'paper' : 'papers'} found
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowSidebar(false)} aria-label="Close search">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Search */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                    <Input
                      placeholder="Title, abstract, keywords..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSearchTerm}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                        aria-label="Clear search"
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
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort by</Label>
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
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advanced Filters</Label>
                    {(advancedFilters.startDate || advancedFilters.endDate || advancedFilters.searchAuthors) && (
                      <Badge variant="secondary" className="h-5 w-5 p-0 text-xs rounded-full flex items-center justify-center">!</Badge>
                    )}
                  </div>

                  {/* Date Range */}
                  <div className="space-y-3">
                    <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      Publication Date
                    </Label>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">From</Label>
                        <Input
                          type="date"
                          value={formatDateForInput(advancedFilters.startDate)}
                          onChange={(e) => handleDateChange('startDate', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">To</Label>
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
                    <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-2">
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
                      aria-label="Clear filters"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border">
                <Button className="w-full" onClick={() => setShowSidebar(false)}>Show Results</Button>
              </div>
            </div>
          </div>
        )}

        {/* Right Content Area */}
        <div className={`${showSidebar ? 'flex-1' : 'w-full'} px-4 py-3 sm:p-6`}>
          {/* Unified top spacing & section header */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full">
              <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2">
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Search Papers</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSidebar(true)}
                  className="sm:hidden h-8 px-3 gap-1.5 text-xs"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {(advancedFilters.startDate || advancedFilters.endDate || advancedFilters.searchAuthors) && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </Button>
              </div>
              <div
                className={
                  `hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-md border text-sm font-medium ${showSidebar ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-muted/50 border-border text-muted-foreground'}`
                }
              >
                <span>Filters</span>
                {(advancedFilters.startDate || advancedFilters.endDate || advancedFilters.searchAuthors) && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold rounded-full">•</Badge>
                )}
              </div>
            </div>
            {/* Toggle button when sidebar visible (desktop) */}
            {showSidebar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(false)}
                className="hidden sm:flex px-2"
                aria-label="Hide filters"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
          </div>
          {isLoading ? (
            <>
              <div className={`grid gap-3 sm:gap-4 mt-4 sm:mt-6 ${showSidebar ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'}`}>
                <PaperListSkeleton count={showSidebar ? 8 : 12} />
              </div>
              <div className="mt-6 sm:mt-8">
                <PaginationSkeleton />
              </div>
            </>
          ) : error ? (
            <div className="text-center py-16 mt-6">
              <p className="text-destructive text-lg font-medium">{error}</p>
            </div>
          ) : papers.length > 0 ? (
            <>
              <div className={`grid gap-3 sm:gap-4 mt-4 sm:mt-6 ${showSidebar ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'}`}>
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
                <div className="mt-6 sm:mt-8">
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
            <div className="text-center py-16 mt-6">
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