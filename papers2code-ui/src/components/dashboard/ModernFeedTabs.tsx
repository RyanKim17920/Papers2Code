import React, { useState } from 'react';
import { TrendingUp, Clock, ThumbsUp, Users, ChevronDown, Sparkles, MessageCircle, ExternalLink } from 'lucide-react';
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
  personalizedPapers: Paper[];
  followingPapers: Paper[];
  bookmarkedPapers?: Paper[];
  isLoading: boolean;
  onPaperClick: (paperId: string | number) => void;
  onVote?: (paperId: string, voteType: 'up' | 'none') => Promise<void>;
  denseLayout?: boolean;
}

// Removed local status badge color mapping in favor of unified StatusBadge.

const formatAuthors = (authors: string[]) => {
  if (authors.length <= 2) {
    return authors.join(', ');
  }
  return `${authors[0]}, ${authors[1]} and ${authors.length - 2} others`;
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
    return `${Math.ceil(diffDays / 365)} years ago`;
  } catch {
    return new Date(dateString).toLocaleDateString();
  }
};

const getDomainTags = (paper: Paper): string[] => {
  const tags: string[] = [];
  const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
  
  if (text.includes('vision') || text.includes('image') || text.includes('visual')) {
    tags.push('CV');
  }
  if (text.includes('nlp') || text.includes('language') || text.includes('text')) {
    tags.push('NLP');
  }
  if (text.includes('learning') || text.includes('neural') || text.includes('network')) {
    tags.push('ML');
  }
  if (text.includes('transformer') || text.includes('attention')) {
    tags.push('Transformers');
  }
  
  return tags.slice(0, 2);
};

const PaperCard: React.FC<{ paper: Paper; onClick: () => void }> = ({ paper, onClick }) => {
  // StatusBadge now handles styling
  
  return (
    <Card 
      className="group cursor-pointer bg-card/60 backdrop-blur-sm border border-border/40 hover:border-border/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden hover-raise"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight mb-1 line-clamp-2 text-sm">
                {paper.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">By {paper.authors.join(', ')}</span>
                <span>•</span>
                <span>{new Date(paper.publicationDate).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge paper={paper} className="text-[10px] px-1.5 py-0.5" />
              {paper.upvoteCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  <span>{paper.upvoteCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Abstract Preview */}
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {getPaperDescription(paper, 160)}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>{paper.implementabilityStatus}</span>
              </div>
              {paper.isImplementableVotes > 0 && (
                <div className="flex items-center gap-1">
                  <span>👍 {paper.isImplementableVotes}</span>
                </div>
              )}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronDown className="w-3 h-3 text-primary rotate-[-90deg]" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ModernFeedTabs: React.FC<ModernFeedTabsProps> = ({
  trendingPapers,
  recentPapers,
  personalizedPapers,
  followingPapers,
  bookmarkedPapers = [],
  isLoading,
  onPaperClick,
  onVote,
  denseLayout = false,
}) => {
  const [activeTab, setActiveTab] = useState('following');
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});

  const handleVote = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onVote || votingStates[paperId]) return;
    
    setVotingStates(prev => ({ ...prev, [paperId]: true }));
    try {
      const paper = [...trendingPapers, ...recentPapers, ...personalizedPapers, ...followingPapers]
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
    { id: 'following', label: 'Following', papers: followingPapers, icon: Users },
    { id: 'trending', label: 'Trending', papers: trendingPapers, icon: TrendingUp },
    { id: 'recent', label: 'Recent', papers: recentPapers, icon: Clock },
    { id: 'personalized', label: 'For You', papers: personalizedPapers, icon: Sparkles },
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
      <div className="flex space-x-1 bg-muted/30 p-1 rounded-lg mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
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
                  'p-4 rounded-lg border border-border/50 bg-card/50 cursor-pointer transition-all duration-200 min-h-[160px] flex flex-col hover-raise',
                  denseLayout && 'h-full'
                )}
              >
                <div 
                  className="flex-1"
                  onClick={() => onPaperClick(paper.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-relaxed flex-1 mr-2">
                      {paper.title}
                    </h3>
                    <StatusBadge paper={paper} className="text-[10px] px-2 py-0.5" />
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
                    {getPaperDescription(paper, 160)}
                  </p>

                  {domainTags.length > 0 && (
                    <div className="flex gap-1 mb-2">
                      {domainTags.map((tag, index) => (
                        <Badge key={index} variant="default" className="text-xs px-1.5 py-0.5 h-5">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/20">
                  <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                    <span>By {formatAuthors(paper.authors)}</span>
                    <span>•</span>
                    <span>{formatDate(paper.publicationDate)}</span>
                    {paper.proceeding && (
                      <>
                        <span>•</span>
                        <span className="text-primary font-medium">{paper.proceeding}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {onVote && (
                      <button
                        onClick={(e) => handleVote(paper.id, e)}
                        disabled={votingStates[paper.id]}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                          paper.currentUserVote === 'up' 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <ThumbsUp className={`w-3 h-3 ${paper.currentUserVote === 'up' ? 'fill-current' : ''}`} />
                        <span>{paper.upvoteCount}</span>
                      </button>
                    )}
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="w-3 h-3" />
                      <span>0</span>
                    </div>

                    <button
                      onClick={() => onPaperClick(paper.id)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
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