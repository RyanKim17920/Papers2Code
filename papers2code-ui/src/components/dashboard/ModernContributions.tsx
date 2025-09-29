import React from 'react';
import { FileText, ThumbsUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Paper } from '@/common/types/paper';
import { getStatusClass } from '@/common/utils/statusUtils';
import '@/components/paperList/PaperCard.css'; // ensures status-* classes are available
import { StatusBadge } from '@/components/common/StatusBadge';

interface ModernContributionsProps {
  contributions: Paper[];
  isLoading: boolean;
  onPaperClick: (paperId: string | number) => void;
  onViewAll: () => void;
  onNewContribution: () => void;
  onVote?: (paperId: string, voteType: 'up' | 'none') => Promise<void>;
}

// NOTE: Removed local Tailwind status color mapping to ensure consistency with global status classes.

export const ModernContributions: React.FC<ModernContributionsProps> = ({
  contributions,
  isLoading,
  onPaperClick,
  onViewAll,
  onNewContribution,
  onVote,
}) => {
  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">My Papers</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse p-3 rounded border border-border/50 bg-card/50">
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-2 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">My Papers</h3>
        {contributions.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </button>
        )}
      </div>
      
      {contributions.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border/60 rounded-lg bg-muted/20">
          <FileText className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground mb-3">
            No papers yet
          </p>
          <Button 
            onClick={onNewContribution}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            Create first paper
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {contributions.slice(0, 5).map((paper) => {
            const statusClass = getStatusClass(paper); // retained for potential conditional logic
            return (
              <div
                key={paper.id}
                className="p-2 rounded border border-border/30 bg-card/30 cursor-pointer transition-colors text-left group hover-raise"
              >
                <div onClick={() => onPaperClick(paper.id)} className="flex-1">
                  <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                    {paper.title}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {paper.publicationDate ? new Date(paper.publicationDate).toLocaleDateString() : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <StatusBadge paper={paper} className="text-[10px] leading-none px-1.5 py-0.5" />
                      {onVote && paper.upvoteCount > 0 && (
                        <span className="text-xs bg-muted/50 px-1.5 py-0.5 rounded flex items-center">
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          {paper.upvoteCount}
                        </span>
                      )}
                      <button
                        onClick={() => onPaperClick(paper.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {contributions.length > 5 && (
            <button
              onClick={onViewAll}
              className="w-full p-2 text-xs text-muted-foreground hover:text-foreground rounded border border-dashed border-border/50 hover:border-border/80 transition-colors"
            >
              Show {contributions.length - 5} more papers
            </button>
          )}
        </div>
      )}
    </div>
  );
};