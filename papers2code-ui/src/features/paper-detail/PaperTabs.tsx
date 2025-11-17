import React from 'react';
import { Paper } from '@/shared/types/paper';
import { cn } from '@/shared/utils/utils';

interface PaperTabsProps {
    activeTab: string;
    onSelectTab: (tab: string) => void; 
    paper: Paper;
    isAdminView: boolean; 
}

const PaperTabs: React.FC<PaperTabsProps> = ({ 
    activeTab, 
    onSelectTab, 
    paper, 
    isAdminView 
}) => {

  return (
    <div className="border-b border-border/60">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        <button
          className={cn(
            "px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
            "hover:text-foreground hover:bg-accent/50 flex-shrink-0",
            activeTab === 'paperInfo'
              ? "text-primary border-primary bg-primary/5"
              : "text-muted-foreground border-transparent"
          )}
          onClick={() => onSelectTab('paperInfo')}
        >
          Paper Info
        </button>
        {paper.implementationProgress && (
          <button
            className={cn(
              "px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
              "hover:text-foreground hover:bg-accent/50 flex-shrink-0",
              activeTab === 'implementationProgress'
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent"
            )}
            onClick={() => onSelectTab('implementationProgress')}
          >
            Progress
          </button>
        )}
        {!paper.implementationProgress && (
          <button
            className={cn(
              "px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
              "hover:text-foreground hover:bg-accent/50 flex items-center gap-2 flex-shrink-0",
              activeTab === 'implementability'
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent"
            )}
            onClick={() => onSelectTab('implementability')}
          >
            <span className="hidden sm:inline">Implementability Votes</span>
            <span className="sm:hidden">Votes</span>
            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs rounded-full bg-muted text-muted-foreground">
              {paper.nonImplementableVotes + paper.isImplementableVotes}
            </span>
          </button>
        )}
        {isAdminView && (
          <button
            className={cn(
              "px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
              "hover:text-foreground hover:bg-accent/50 flex-shrink-0",
              activeTab === 'admin'
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent"
            )}
            onClick={() => onSelectTab('admin')}
          >
            Admin
          </button>
        )}
      </div>
    </div>
  );
};

export default PaperTabs;