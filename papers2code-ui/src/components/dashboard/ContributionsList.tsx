import React from 'react';
import { FileText, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaperCard } from './PaperCard';
import type { Paper } from '@/types/paper';

interface ContributionsListProps {
  contributions: Paper[];
  isLoading: boolean;
  onPaperClick: (paperId: string | number) => void;
  onViewAll: () => void;
  onNewContribution: () => void;
}

export const ContributionsList: React.FC<ContributionsListProps> = ({
  contributions = [],
  isLoading,
  onPaperClick,
  onViewAll,
  onNewContribution,
}) => {
  if (isLoading) {
    return (
      <div className="research-section">
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded w-40 animate-pulse" />
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="research-card p-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="research-section">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            My Contributions
          </h3>
          
          {contributions.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewAll}
              className="text-primary hover:text-primary/80 p-0 h-auto"
            >
              View all
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>

        {contributions.length === 0 ? (
          <div className="research-card p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <h4 className="font-medium text-foreground mb-2">Start Contributing</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Share your research and collaborate with the scientific community
            </p>
            <Button onClick={onNewContribution} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Paper
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {contributions.slice(0, 5).map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onClick={() => onPaperClick(paper.id)}
                showStatus={true}
                compact={true}
              />
            ))}
          </div>
        )}

        {contributions.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {contributions.length} total contribution{contributions.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};