import React from 'react';
import { Search, SlidersHorizontal, Calendar, User } from 'lucide-react';
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

interface PaperListPageProps {
  authLoading: boolean;
}

const PaperListPage: React.FC<PaperListPageProps> = ({ authLoading }) => {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Research Papers</h1>
          <p className="text-muted-foreground">
            Explore the latest research papers and their implementations
          </p>
        </div>

        <div className="flex gap-6">
          {/* Left Sidebar - Filters */}
          <div className="w-80 flex-shrink-0">
            <Card className="sticky top-6">
              <CardContent className="p-6 space-y-6">
                {/* Search Section */}
                <div className="space-y-3">
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
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  {totalCount} papers found
                </h2>
                {debouncedSearchTerm && (
                  <Badge variant="secondary">
                    Results for "{debouncedSearchTerm}"
                  </Badge>
                )}
              </div>
            </div>

            {/* Content Area */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            ) : papers.length > 0 ? (
              <>
                <div className="space-y-2">
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