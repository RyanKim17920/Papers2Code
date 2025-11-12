import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Calendar, User, Filter, X, RotateCcw, ChevronLeft, ChevronRight, Tags, Briefcase } from 'lucide-react';
import { usePaperList, SortPreference } from '@/shared/hooks/usePaperList';
import { LoadingSpinner } from '@/shared/components';
import { SEO } from '@/shared/components/SEO';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardContent } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import { Badge } from '@/shared/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Checkbox } from '@/shared/ui/checkbox';
import { MultiSelect } from '@/shared/ui/multi-select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs';
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

const PaperListPage: React.FC<PaperListPageProps> = ({ authLoading, currentUser }) => {
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

  // Build dynamic SEO title and description based on filters
  const buildSEOTitle = () => {
    if (searchTerm) {
      return `"${searchTerm}" Research Papers`;
    }
    
    return 'Browse AI & ML Research Papers';
  };

  const buildSEODescription = () => {
    if (searchTerm) {
      return `Discover ${totalCount} AI and machine learning research papers related to "${searchTerm}". Find implementations, collaborate with researchers, and transform papers into production code.`;
    }
    
    return `Browse ${totalCount} cutting-edge AI and machine learning research papers. Find implementations, track progress, and collaborate with the community to bring research to production.`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={buildSEOTitle()}
        description={buildSEODescription()}
        keywords="AI research papers, machine learning papers, arXiv papers, research implementation, ML code, deep learning, computer vision, NLP, research collaboration"
        url={`https://papers2code.com/papers${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`}
      />
      
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
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    "{debouncedSearchTerm.length > 20 ? debouncedSearchTerm.substring(0, 20) + '...' : debouncedSearchTerm}"
                  </Badge>
                )}
                {advancedFilters.startDate && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    From: {advancedFilters.startDate}
                  </Badge>
                )}
                {advancedFilters.endDate && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    To: {advancedFilters.endDate}
                  </Badge>
                )}
                {advancedFilters.searchAuthors && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {advancedFilters.searchAuthors}
                  </Badge>
                )}
                {advancedFilters.tags && advancedFilters.tags.length > 0 && advancedFilters.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                    <Tags className="w-3 h-3" />
                    {tag}
                  </Badge>
                ))}
                {advancedFilters.hasCode !== undefined && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    {advancedFilters.hasCode ? 'With Code' : 'Without Code'}
                  </Badge>
                )}
                {advancedFilters.contributorId && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    My Papers
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex">
        {/* Left Sidebar - Filters - Fixed position */}
        {showSidebar && (
          <div className="w-96 lg:w-96 md:w-80 sm:w-72 border-r border-border bg-card hidden sm:block fixed left-0 top-16 h-[calc(100vh-4rem)] overflow-y-auto z-10">
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
                  aria-label="Hide filters"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>

              {/* Search */}
              <div className="space-y-2 mb-3">
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

              <Separator className="mb-3" />

              {/* Sort */}
              <div className="space-y-2 mb-3">
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

              <Separator className="mb-3" />

              {/* Advanced Filters */}
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Advanced Filters</Label>
                {(advancedFilters.startDate || advancedFilters.endDate || advancedFilters.searchAuthors || advancedFilters.tags?.length || advancedFilters.hasCode !== undefined || advancedFilters.contributorId) && (
                  <Badge variant="outline" className="h-5 w-5 p-0 text-xs rounded-full flex items-center justify-center">
                    !
                  </Badge>
                )}
              </div>

              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="content" className="text-sm">
                    <Tags className="w-3 h-3 mr-1" />
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="publication" className="text-sm">
                    <Calendar className="w-3 h-3 mr-1" />
                    Publication
                  </TabsTrigger>
                  <TabsTrigger value="options" className="text-sm">
                    <Filter className="w-3 h-3 mr-1" />
                    Filters
                  </TabsTrigger>
                </TabsList>

                {/* Content Tab: Tags */}
                <TabsContent value="content" className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                      <Tags className="w-3 h-3" />
                      Tags
                    </Label>
                    <MultiSelect
                      options={availableTags}
                      selected={advancedFilters.tags || []}
                      onChange={(tags) => handleAdvancedFilterChange('tags', tags)}
                      placeholder="Type to search tags..."
                      emptyMessage="No tags found"
                      onSearch={handleTagsSearch}
                    />
                  </div>
                </TabsContent>

                {/* Publication Tab: Date Range, Authors */}
                <TabsContent value="publication" className="space-y-4">
                  {/* Date Range */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      Publication Date
                    </Label>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm text-foreground/80">From</Label>
                        <Input
                          type="date"
                          value={formatDateForInput(advancedFilters.startDate)}
                          onChange={(e) => handleDateChange('startDate', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-foreground/80">To</Label>
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
                    <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                      <User className="w-3 h-3" />
                      Authors
                    </Label>
                    <Input
                      placeholder="e.g., Hinton, LeCun"
                      value={advancedFilters.searchAuthors || ''}
                      onChange={(e) => handleAdvancedFilterChange('searchAuthors', e.target.value)}
                    />
                  </div>
                </TabsContent>

                {/* Filter Options Tab: Code Availability, My Papers */}
                <TabsContent value="options" className="space-y-4">
                  {/* Has Code Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground/80">
                      Code Availability
                    </Label>
                    <Select
                      value={advancedFilters.hasCode === undefined ? 'all' : advancedFilters.hasCode ? 'true' : 'false'}
                      onValueChange={(value) => handleAdvancedFilterChange('hasCode', value === 'all' ? undefined : value === 'true')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Papers</SelectItem>
                        <SelectItem value="true">With Code</SelectItem>
                        <SelectItem value="false">Without Code</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* My Papers Filter - Only shown when logged in */}
                  {currentUser && (
                    <div className="space-y-2">
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
                          className="text-sm font-medium text-foreground/80 flex items-center gap-2 cursor-pointer"
                        >
                          <Briefcase className="w-3 h-3" />
                          Papers I've worked on
                        </Label>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Clear Filters Button */}
              <div className="flex gap-2 pt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearAdvancedFilters}
                  className="flex items-center gap-1 w-full"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear Filters
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
                  <Label className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Search</Label>
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
                  <Label className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Sort by</Label>
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
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Advanced Filters</Label>
                    {(advancedFilters.startDate || advancedFilters.endDate || advancedFilters.searchAuthors || advancedFilters.tags?.length || advancedFilters.hasCode !== undefined || advancedFilters.contributorId) && (
                      <Badge variant="outline" className="h-5 w-5 p-0 text-xs rounded-full flex items-center justify-center">!</Badge>
                    )}
                  </div>

                  <Tabs defaultValue="content" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-3">
                      <TabsTrigger value="content" className="text-xs">
                        <Tags className="w-3 h-3 mr-1" />
                        Content
                      </TabsTrigger>
                      <TabsTrigger value="publication" className="text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        Publication
                      </TabsTrigger>
                      <TabsTrigger value="options" className="text-xs">
                        <Filter className="w-3 h-3 mr-1" />
                        Filters
                      </TabsTrigger>
                    </TabsList>

                    {/* Content Tab: Tags */}
                    <TabsContent value="content" className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Tags className="w-3 h-3" />
                          Tags
                        </Label>
                        <MultiSelect
                          options={availableTags}
                          selected={advancedFilters.tags || []}
                          onChange={(tags) => handleAdvancedFilterChange('tags', tags)}
                          placeholder="Type to search tags..."
                          emptyMessage="No tags found"
                          onSearch={handleTagsSearch}
                        />
                      </div>
                    </TabsContent>

                    {/* Publication Tab: Date Range, Authors */}
                    <TabsContent value="publication" className="space-y-4">
                      {/* Date Range */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          Publication Date
                        </Label>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-sm text-foreground/80">From</Label>
                            <Input
                              type="date"
                              value={formatDateForInput(advancedFilters.startDate)}
                              onChange={(e) => handleDateChange('startDate', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-foreground/80">To</Label>
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
                        <Label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <User className="w-3 h-3" />
                          Authors
                        </Label>
                        <Input
                          placeholder="e.g., Hinton, LeCun"
                          value={advancedFilters.searchAuthors || ''}
                          onChange={(e) => handleAdvancedFilterChange('searchAuthors', e.target.value)}
                        />
                      </div>
                    </TabsContent>

                    {/* Filter Options Tab: Code Availability, My Papers */}
                    <TabsContent value="options" className="space-y-4">
                      {/* Has Code Filter */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground/80">
                          Code Availability
                        </Label>
                        <Select
                          value={advancedFilters.hasCode === undefined ? 'all' : advancedFilters.hasCode ? 'true' : 'false'}
                          onValueChange={(value) => handleAdvancedFilterChange('hasCode', value === 'all' ? undefined : value === 'true')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Papers</SelectItem>
                            <SelectItem value="true">With Code</SelectItem>
                            <SelectItem value="false">Without Code</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* My Papers Filter - Only shown when logged in */}
                      {currentUser && (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="myPapersMobile"
                              checked={advancedFilters.contributorId === currentUser.id}
                              onCheckedChange={(checked) => {
                                handleAdvancedFilterChange('contributorId', checked ? currentUser.id : '')
                              }}
                            />
                            <Label
                              htmlFor="myPapersMobile"
                              className="text-sm font-medium text-foreground/80 flex items-center gap-2 cursor-pointer"
                            >
                              <Briefcase className="w-3 h-3" />
                              Papers I've worked on
                            </Label>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* Clear Filters Button */}
                  <div className="flex gap-2 pt-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleClearAdvancedFilters}
                      className="flex items-center gap-1 w-full"
                      aria-label="Clear filters"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Filters
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
        <div className={`${showSidebar ? 'sm:ml-72 md:ml-80 lg:ml-96 flex-1' : 'w-full'} px-4 py-3 sm:p-6 max-w-[1600px]`}>
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
                  {(advancedFilters.startDate || advancedFilters.endDate || advancedFilters.searchAuthors || advancedFilters.tags?.length || advancedFilters.hasCode !== undefined || advancedFilters.contributorId) && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </Button>
              </div>
              
              {/* Active Filters Display */}
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {debouncedSearchTerm && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    "{debouncedSearchTerm.length > 20 ? debouncedSearchTerm.substring(0, 20) + '...' : debouncedSearchTerm}"
                  </Badge>
                )}
                {advancedFilters.startDate && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    From: {advancedFilters.startDate}
                  </Badge>
                )}
                {advancedFilters.endDate && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    To: {advancedFilters.endDate}
                  </Badge>
                )}
                {advancedFilters.searchAuthors && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {advancedFilters.searchAuthors}
                  </Badge>
                )}
                {advancedFilters.tags && advancedFilters.tags.length > 0 && advancedFilters.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                    <Tags className="w-3 h-3" />
                    {tag}
                  </Badge>
                ))}
                {advancedFilters.hasCode !== undefined && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    {advancedFilters.hasCode ? 'With Code' : 'Without Code'}
                  </Badge>
                )}
                {advancedFilters.contributorId && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    My Papers
                  </Badge>
                )}
              </div>
              
              <div
                className={
                  `hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-md border text-sm font-medium ${showSidebar ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-muted/50 border-border text-muted-foreground'}`
                }
              >
                <span>Filters</span>
                {(advancedFilters.startDate || advancedFilters.endDate || advancedFilters.searchAuthors || advancedFilters.tags?.length || advancedFilters.hasCode !== undefined || advancedFilters.contributorId) && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold rounded-full">•</Badge>
                )}
              </div>
            </div>
          </div>
          {isLoading ? (
            <>
              <div className={`grid gap-3 sm:gap-4 mt-4 sm:mt-6 ${showSidebar ? 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                <PaperListSkeleton count={showSidebar ? 9 : 12} />
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
              <div className={`grid gap-3 sm:gap-4 mt-4 sm:mt-6 ${showSidebar ? 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
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