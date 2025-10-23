import React, { useState } from 'react';
import { TrendingUp, Clock, ThumbsUp, FileText, ChevronDown, MessageCircle, ExternalLink, Code, FileDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { Paper } from '@/common/types/paper';
import { getPaperDescription } from '@/common/utils/descriptionUtils';
import { cn } from '@/lib/utils';

interface ModernFeedTabsProps {
  trendingPapers: Paper[];
  recentPapers: Paper[];
  myPapers: Paper[];
  bookmarkedPapers?: Paper[];
  isLoading: boolean;
  onPaperClick: (paperId: string | number) => void;
  onVote?: (paperId: string, voteType: 'up' | 'none') => Promise<void>;
  denseLayout?: boolean;
}

// Removed local status badge color mapping in favor of unified StatusBadge.

const formatAuthors = (authors: string[] | null | undefined) => {
  if (!authors || authors.length === 0) return 'Unknown authors';
  if (authors.length === 1) return authors[0];
  if (authors.length <= 3) return authors.join(', ');
  return `${authors[0]}, et al.`;
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Unknown date';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return 'Invalid date';
  }
};

const getDomainTags = (paper: Paper): string[] => {
  const tags: string[] = [];
  
  // First, try to use paper.tasks if available (from backend - aliased as tags)
  if (paper.tasks && Array.isArray(paper.tasks) && paper.tasks.length > 0) {
    return paper.tasks.slice(0, 2);
  }
  
  // Fallback to text analysis if no tasks/tags
  const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
  
  if (text.includes('vision') || text.includes('image') || text.includes('visual') || text.includes('computer vision')) {
    tags.push('CV');
  }
  if (text.includes('nlp') || text.includes('language') || text.includes('text') || text.includes('natural language')) {
    tags.push('NLP');
  }
  if (text.includes('learning') || text.includes('neural') || text.includes('network') || text.includes('machine learning')) {
    tags.push('ML');
  }
  if (text.includes('transformer') || text.includes('attention')) {
    tags.push('Transformers');
  }
  if (text.includes('generative') || text.includes('diffusion') || text.includes('gan')) {
    tags.push('Generative AI');
  }
  
  return tags.slice(0, 2);
};

export const ModernFeedTabs: React.FC<ModernFeedTabsProps> = ({
  trendingPapers,
  recentPapers,
  myPapers,
  bookmarkedPapers = [],
  isLoading,
  onPaperClick,
  onVote,
  denseLayout = false,
}) => {
  const [activeTab, setActiveTab] = useState('mypapers');
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});

  const handleVote = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onVote || votingStates[paperId]) return;
    
    setVotingStates(prev => ({ ...prev, [paperId]: true }));
    try {
      const paper = [...trendingPapers, ...recentPapers, ...myPapers, ...(bookmarkedPapers || [])]
        .find(p => p.id === paperId);
      const nextVoteType = paper?.currentUserVote === 'up' ? 'none' : 'up';
      await onVote(paperId, nextVoteType);
    } catch (error) {
      console.error('Vote failed:', error);
    } finally {
      setVotingStates(prev => ({ ...prev, [paperId]: false }));
    }
  };

  const tabs = [
    { id: 'mypapers', label: 'My Papers', papers: myPapers, icon: FileText },
    { id: 'trending', label: 'Trending', papers: trendingPapers, icon: TrendingUp },
    { id: 'saved', label: 'Upvoted', papers: bookmarkedPapers, icon: ThumbsUp },
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Feed</h2>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse p-4 rounded-lg border border-border/50 bg-card/50">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-full mb-1" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-foreground">Feed</h2>
      </div>
      {/* Tab Navigation moved under the title to avoid same line as tabs */}
      <div className="flex space-x-1 bg-muted/30 p-1 rounded-lg mb-4 w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors flex-1 ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm border border-border/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
              <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded ml-1">
                {tab.papers.length}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          denseLayout
            ? 'grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 xl:gap-5'
            : 'space-y-3'
        )}
      >
        {(activeTabData?.papers || []).length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border/50 rounded-lg bg-muted/20">
            <p className="text-sm text-muted-foreground">
              No papers in {activeTabData?.label.toLowerCase()} yet
            </p>
          </div>
        ) : (
          (activeTabData?.papers || []).map((paper) => {
            const domainTags = getDomainTags(paper);
            
            return (
              <div
                key={paper.id}
                className={cn(
                  'rounded-lg border border-border/50 bg-card/50 cursor-pointer transition-all duration-200 hover:shadow-md hover-raise group',
                  denseLayout ? 'h-full' : ''
                )}
              >
                <div className="p-3 sm:p-4 h-full flex flex-col">
                  {/* Paper content - clickable */}
                  <div 
                    className="flex-1 mb-3"
                    onClick={() => onPaperClick(paper.id)}
                  >
                    {/* Title */}
                    <h3 className="text-[13px] sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight mb-1 sm:mb-2">
                      {paper.title}
                    </h3>
                    
                    {/* Authors • Venue • Date */}
                    <div className="text-[10px] sm:text-xs mb-2 flex-shrink-0">
                      <span className="font-medium text-muted-foreground">{formatAuthors(paper.authors || [])}</span>
                      {paper.proceeding && (
                        <>
                          <span className="mx-1 text-muted-foreground/60">·</span>
                          <span className="font-medium text-primary/80">{paper.proceeding}</span>
                        </>
                      )}
                      <span className="mx-1 text-muted-foreground/60">·</span>
                      <span className="text-muted-foreground font-normal">{formatDate(paper.publicationDate || '')}</span>
                    </div>

                    {/* Abstract */}
                    <div className="text-[11px] sm:text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-2.5 sm:mb-3 font-normal">
                      {getPaperDescription(paper, 140)}
                    </div>
                  </div>
                  
                  {/* Footer: Domain Tags + Status + Actions - Fixed at bottom */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/20 flex-wrap">
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                      {/* Domain Tags */}
                      {domainTags.map((tag, index) => (
                        <Badge key={index} variant="default" className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 h-5 sm:h-6 font-medium whitespace-nowrap">
                          {tag}
                        </Badge>
                      ))}
                      
                      {/* Status Badge */}
                      <StatusBadge paper={paper} className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 h-5 sm:h-6" />
                    </div>
                    
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      {/* Code Button - Only show if official code exists */}
                      {paper.urlGithub && (
                        <a
                          href={paper.urlGithub}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 sm:p-1.5 rounded hover:bg-emerald-500/10 transition-colors text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                          title="View Official Code"
                        >
                          <Code className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </a>
                      )}
                      
                      {/* PDF Button - Links to PDF or Abstract */}
                      {(paper.urlPdf || paper.urlAbs) && (
                        <a
                          href={paper.urlPdf || paper.urlAbs}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 sm:p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title={paper.urlPdf ? "Download PDF" : "View Abstract"}
                        >
                          <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </a>
                      )}
                      
                      {/* Upvote Button */}
                      {onVote && (
                        <button
                          onClick={(e) => handleVote(paper.id, e)}
                          disabled={votingStates[paper.id]}
                          className={`flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded transition-colors ${
                            paper.currentUserVote === 'up' 
                              ? 'bg-primary/10 text-primary' 
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          title="Save to Library"
                        >
                          <ThumbsUp 
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${paper.currentUserVote === 'up' ? 'fill-current' : ''}`} 
                          />
                          <span className="text-[9px] sm:text-xs font-medium">{paper.upvoteCount || 0}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};