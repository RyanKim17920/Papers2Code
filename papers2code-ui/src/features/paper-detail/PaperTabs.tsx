import React from 'react';
import { Paper } from '@/shared/types/paper';
import { cn } from '../../lib/utils';

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
            <div className="flex gap-1 overflow-x-auto">
                <button
                    className={cn(
                        "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
                        "hover:text-foreground hover:bg-accent/50",
                        activeTab === 'paperInfo'
                            ? "text-primary border-primary bg-primary/5"
                            : "text-muted-foreground border-transparent"
                    )}
                    onClick={() => onSelectTab('paperInfo')}
                >
                    Paper Information
                </button>
                {paper.implementationProgress && (
                    <button
                        className={cn(
                            "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
                            "hover:text-foreground hover:bg-accent/50",
                            activeTab === 'implementationProgress'
                                ? "text-primary border-primary bg-primary/5"
                                : "text-muted-foreground border-transparent"
                        )}
                        onClick={() => onSelectTab('implementationProgress')}
                    >
                        Implementation Progress
                    </button>
                )}
                {!paper.implementationProgress && (
                    <button
                        className={cn(
                            "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
                            "hover:text-foreground hover:bg-accent/50 flex items-center gap-2",
                            activeTab === 'implementability'
                                ? "text-primary border-primary bg-primary/5"
                                : "text-muted-foreground border-transparent"
                        )}
                        onClick={() => onSelectTab('implementability')}
                    >
                        Implementability Votes
                        <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                            {paper.nonImplementableVotes + paper.isImplementableVotes}
                        </span>
                    </button>
                )}
                {isAdminView && (
                    <button
                        className={cn(
                            "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
                            "hover:text-foreground hover:bg-accent/50",
                            activeTab === 'admin'
                                ? "text-primary border-primary bg-primary/5"
                                : "text-muted-foreground border-transparent"
                        )}
                        onClick={() => onSelectTab('admin')}
                    >
                        Admin Actions
                    </button>
                )}
            </div>
        </div>
    );
};

export default PaperTabs;