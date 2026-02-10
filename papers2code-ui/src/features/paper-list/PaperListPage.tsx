import React, { useState, useEffect } from 'react';
import { Search, Calendar, User, X, RotateCcw, Tags, Briefcase, ChevronDown, Code2, Grid2X2, List } from 'lucide-react';
import { usePaperList, SortPreference } from '@/shared/hooks/usePaperList';
import { LoadingSpinner } from '@/shared/components';
import { SEO } from '@/shared/components/SEO';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Badge } from '@/shared/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Checkbox } from '@/shared/ui/checkbox';
import { MultiSelect } from '@/shared/ui/multi-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { fetchTagsFromApi } from '@/shared/services/api';
import type { UserProfile } from '@/shared/types/user';
import ModernPaperCard from '@/features/paper-list/ModernPaperCard';
import ModernPaginationControls from '@/features/paper-list/ModernPaginationControls';
import PaperListSkeleton from '@/features/paper-list/PaperListSkeleton';
import PaginationSkeleton from '@/features/paper-list/PaginationSkeleton';

interface PaperListPageProps {
  authLoading: boolean;
  currentUser: UserProfile | null;
}

const ITEMS_PER_PAGE = 20;

const PaperListPage: React.FC<PaperListPageProps> = ({ authLoading, currentUser }) => {
  const [showFilters, setShowFilters] = useState(false);

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
    countCapped,
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
  } = usePaperList(authLoading, currentUser);

  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Fetch all tags on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await fetchTagsFromApi();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };
    loadTags();
  }, []);

  const handleTagsSearch = async (query: string) => {
    try {
      const tags = await fetchTagsFromApi(query);
      setAvailableTags(tags);
    } catch (error) {
      console.error('Failed to search tags:', error);
    }
  };

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

  // Count active filters
  const activeFilterCount = [
    advancedFilters.startDate,
    advancedFilters.endDate,
    advancedFilters.searchAuthors,
    advancedFilters.tags?.length,
    advancedFilters.hasCode !== undefined,
    advancedFilters.contributorId,
  ].filter(Boolean).length;

  // Check if any filters are active
  const hasActiveFilters = activeFilterCount > 0 || debouncedSearchTerm;

  // Remove a specific filter
  const removeFilter = (filterType: string, value?: string) => {
    switch (filterType) {
      case 'search':
        clearSearchTerm();
        break;
      case 'startDate':
        handleAdvancedFilterChange('startDate', '');
        break;
      case 'endDate':
        handleAdvancedFilterChange('endDate', '');
        break;
      case 'author':
        handleAdvancedFilterChange('searchAuthors', '');
        break;
      case 'tag':
        if (value && advancedFilters.tags) {
          handleAdvancedFilterChange('tags', advancedFilters.tags.filter(t => t !== value));
        }
        break;
      case 'hasCode':
        handleAdvancedFilterChange('hasCode', undefined);
        break;
      case 'myPapers':
        handleAdvancedFilterChange('contributorId', '');
        break;
    }
  };

  // Build dynamic SEO title and description based on filters
  const buildSEOTitle = () => {
    if (searchTerm) {
      return `"${searchTerm}" Research Papers`;
    }
    return 'Browse AI & ML Research Papers';
  };

  const buildSEODescription = () => {
    if (searchTerm) {
      return `Discover ${formatCount(totalCount, countCapped)} AI and machine learning research papers related to "${searchTerm}". Find implementations, collaborate with researchers, and transform papers into production code.`;
    }
    return `Browse ${formatCount(totalCount, countCapped)} cutting-edge AI and machine learning research papers. Find implementations, track progress, and collaborate with the community to bring research to production.`;
  };

  // Calculate result range for display
  const startResult = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endResult = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  // Format total count for display
  const formatCount = (count: number, capped?: boolean) => {
    const suffix = capped ? '+' : '';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M${suffix}`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K${suffix}`;
    }
    return `${count}${suffix}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={buildSEOTitle()}
        description={buildSEODescription()}
        keywords="AI research papers, machine learning papers, arXiv papers, research implementation, ML code, deep learning, computer vision, NLP, research collaboration"
        url={`https://papers2code.com/papers${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`}
      />

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">

        {/* Header Section */}
        <div className="pb-12">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-3">
              Research Papers
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Explore {formatCount(totalCount, countCapped)} papers from arXiv, discover implementations, and contribute to open science.
            </p>
          </div>

          {/* Search Bar - Prominent and Centered */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search papers by title, abstract, or keywords..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-12 pr-12 h-14 text-base rounded-xl border-border/60 bg-card shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearchTerm}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Filter/Sort Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
            {/* Left: Filter Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Filters Popover */}
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 gap-2 rounded-lg"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[20px] text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="start">
                  <div className="space-y-4">
                    {/* Tags */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Tags className="w-4 h-4" />
                        Tags
                      </Label>
                      <MultiSelect
                        options={availableTags}
                        selected={advancedFilters.tags || []}
                        onChange={(tags) => handleAdvancedFilterChange('tags', tags)}
                        placeholder="Search tags..."
                        emptyMessage="No tags found"
                        onSearch={handleTagsSearch}
                      />
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Publication Date
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">From</Label>
                          <Input
                            type="date"
                            value={formatDateForInput(advancedFilters.startDate)}
                            onChange={(e) => handleDateChange('startDate', e.target.value)}
                            className="mt-1 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">To</Label>
                          <Input
                            type="date"
                            value={formatDateForInput(advancedFilters.endDate)}
                            onChange={(e) => handleDateChange('endDate', e.target.value)}
                            className="mt-1 h-9"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Authors */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Authors
                      </Label>
                      <Input
                        placeholder="e.g., Hinton, LeCun"
                        value={advancedFilters.searchAuthors || ''}
                        onChange={(e) => handleAdvancedFilterChange('searchAuthors', e.target.value)}
                        className="h-9"
                      />
                    </div>

                    {/* Code Availability */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Code2 className="w-4 h-4" />
                        Code Availability
                      </Label>
                      <Select
                        value={advancedFilters.hasCode === undefined ? 'all' : advancedFilters.hasCode ? 'true' : 'false'}
                        onValueChange={(value) => handleAdvancedFilterChange('hasCode', value === 'all' ? undefined : value === 'true')}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Papers</SelectItem>
                          <SelectItem value="true">With Code</SelectItem>
                          <SelectItem value="false">Without Code</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* My Papers - Only shown when logged in */}
                    {currentUser && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="myPapers"
                          checked={advancedFilters.contributorId === currentUser.id}
                          onCheckedChange={(checked) => {
                            handleAdvancedFilterChange('contributorId', checked ? currentUser.id : '')
                          }}
                        />
                        <Label
                          htmlFor="myPapers"
                          className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                        >
                          <Briefcase className="w-4 h-4" />
                          Papers I've worked on
                        </Label>
                      </div>
                    )}

                    {/* Clear All */}
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAdvancedFilters}
                        className="w-full text-muted-foreground hover:text-foreground gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Clear all filters
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Quick Filter Pills for Active Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {debouncedSearchTerm && (
                  <Badge
                    variant="secondary"
                    className="pl-2 pr-1 py-1 h-7 gap-1 cursor-pointer hover:bg-muted"
                    onClick={() => removeFilter('search')}
                  >
                    <Search className="w-3 h-3" />
                    <span className="max-w-[120px] truncate">"{debouncedSearchTerm}"</span>
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
                {advancedFilters.startDate && (
                  <Badge
                    variant="secondary"
                    className="pl-2 pr-1 py-1 h-7 gap-1 cursor-pointer hover:bg-muted"
                    onClick={() => removeFilter('startDate')}
                  >
                    <Calendar className="w-3 h-3" />
                    From: {advancedFilters.startDate}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
                {advancedFilters.endDate && (
                  <Badge
                    variant="secondary"
                    className="pl-2 pr-1 py-1 h-7 gap-1 cursor-pointer hover:bg-muted"
                    onClick={() => removeFilter('endDate')}
                  >
                    <Calendar className="w-3 h-3" />
                    To: {advancedFilters.endDate}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
                {advancedFilters.searchAuthors && (
                  <Badge
                    variant="secondary"
                    className="pl-2 pr-1 py-1 h-7 gap-1 cursor-pointer hover:bg-muted"
                    onClick={() => removeFilter('author')}
                  >
                    <User className="w-3 h-3" />
                    {advancedFilters.searchAuthors}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
                {advancedFilters.tags && advancedFilters.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="pl-2 pr-1 py-1 h-7 gap-1 cursor-pointer hover:bg-muted"
                    onClick={() => removeFilter('tag', tag)}
                  >
                    <Tags className="w-3 h-3" />
                    {tag}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                {advancedFilters.hasCode !== undefined && (
                  <Badge
                    variant="secondary"
                    className="pl-2 pr-1 py-1 h-7 gap-1 cursor-pointer hover:bg-muted"
                    onClick={() => removeFilter('hasCode')}
                  >
                    <Code2 className="w-3 h-3" />
                    {advancedFilters.hasCode ? 'With Code' : 'Without Code'}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
                {advancedFilters.contributorId && (
                  <Badge
                    variant="secondary"
                    className="pl-2 pr-1 py-1 h-7 gap-1 cursor-pointer hover:bg-muted"
                    onClick={() => removeFilter('myPapers')}
                  >
                    <Briefcase className="w-3 h-3" />
                    My Papers
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      handleClearAdvancedFilters();
                      clearSearchTerm();
                    }}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>

            {/* Right: Sort Control */}
            <div className="flex items-center gap-3">
              <Select
                value={activeSortDisplay}
                onValueChange={(value) => handleSortChange({ target: { value } } as any)}
                disabled={isSearchActive}
              >
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Sort by" />
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
          </div>
        </div>

        {/* Results Section */}
        <div className="pb-12">
          {isLoading ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PaperListSkeleton count={8} />
              </div>
              <div className="mt-12">
                <PaginationSkeleton />
              </div>
            </>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-destructive text-lg font-medium">{error}</p>
            </div>
          ) : papers.length > 0 ? (
            <>
              {/* Paper Grid - 2 columns on desktop, 1 on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {papers.map((paper) => (
                  <ModernPaperCard
                    key={paper.id}
                    paper={paper}
                    onVote={handleVote}
                    className="h-full"
                  />
                ))}
              </div>

              {/* Pagination Section */}
              <div className="mt-12 pt-8 border-t border-border">
                {/* Result Count */}
                <div className="text-center mb-6">
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{startResult}-{endResult}</span> of{' '}
                    <span className="font-medium text-foreground">{formatCount(totalCount, countCapped)}</span> papers
                  </p>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <ModernPaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    onPrev={handlePrev}
                    onNext={handleNext}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium tracking-tight mb-3">
                  {debouncedSearchTerm ? 'No papers found' : 'No papers available'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {debouncedSearchTerm
                    ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                    : 'Check back later for new research papers.'}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleClearAdvancedFilters();
                      clearSearchTerm();
                    }}
                    className="rounded-lg"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Clear all filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Sheet Overlay */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 sm:hidden"
          onClick={() => setShowFilters(false)}
        />
      )}
    </div>
  );
};

export default PaperListPage;
