import React, { useState } from 'react';
import { Code, GitBranch, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ImplementationProgressDialog } from './Tabs/ImplementationProgress/ImplementationProgressDialog';
import { useAuthorOutreachEmail } from '@/shared/hooks/useAuthorOutreachEmail';
import type { ImplementationProgress, UpdateEventType } from '@/shared/types/implementation';
import type { UserProfile } from '@/shared/types/user';
import { getStatusColorClasses } from '@/shared/utils/statusUtils';

interface ImplementationProgressCardProps {
    progress: ImplementationProgress;
    paperId: string;
    paperStatus: string; // The paper's overall status (from paper.status field)
    currentUser: UserProfile | null;
    onImplementationProgressChange: (progress: ImplementationProgress) => Promise<void>;
    onRefreshPaper: () => Promise<void>; // Function to refresh paper data
}

const ImplementationProgressCard: React.FC<ImplementationProgressCardProps> = ({
    progress,
    paperId,
    paperStatus,
    currentUser,
    onImplementationProgressChange,
    onRefreshPaper
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { fetchEmailContent, isFetchingEmail } = useAuthorOutreachEmail(paperId);

    const handleSendEmail = async () => {
        try {
            await fetchEmailContent();
            await onRefreshPaper();
        } catch (err) {
            console.error('Failed to send email:', err);
        }
    };

    // Get latest update info for preview
    const latestUpdate = progress.updates && progress.updates.length > 0 
        ? progress.updates[progress.updates.length - 1]
        : null;

    const getLatestUpdateText = () => {
        if (!latestUpdate) return 'No updates yet';
        
        const date = new Date(latestUpdate.timestamp);
        const now = Date.now();
        const diffMs = Math.max(0, now - date.getTime()); // Prevent negative values
        const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        let timeText;
        if (daysAgo === 0) {
            const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60));
            if (hoursAgo === 0) {
                timeText = 'Just now';
            } else {
                timeText = `${hoursAgo}h ago`;
            }
        } else if (daysAgo === 1) {
            timeText = 'Yesterday';
        } else {
            timeText = `${daysAgo}d ago`;
        }
        
        const eventTypeMap: Record<string, string> = {
            'Initiated': 'Started implementation',
            'Email Sent': 'Contacted authors',
            'Status Changed': 'Status updated',
            'GitHub Repo Linked': 'Repository linked',
        };
        
        return `${eventTypeMap[latestUpdate.eventType] || latestUpdate.eventType} • ${timeText}`;
    };

    const isCurrentUserContributor = progress.contributors?.some(
        (contributorId) => contributorId === currentUser?.id
    );

    const getGithubUrl = (repoId: string) => {
        if (repoId.startsWith('http')) {
            return repoId;
        }
        return `https://github.com/${repoId}`;
    };

    return (
        <>
            <Card 
                className="bg-card/70 backdrop-blur border border-primary/40 hover:border-primary/60 transition-all cursor-pointer group shadow-sm hover:shadow-md"
                onClick={() => setIsDialogOpen(true)}
            >
                <CardContent className="p-3 space-y-2.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                            <Code className="w-5 h-5 text-primary" />
                            Implementation Progress
                        </h3>
                        <Badge 
                            variant="outline" 
                            className={`text-xs h-5 px-2 font-medium whitespace-nowrap ${getStatusColorClasses(paperStatus)}`}
                        >
                            {paperStatus || 'Not Started'}
                        </Badge>
                    </div>

                    {/* Contributor Status Banner */}
                    {isCurrentUserContributor && (
                        <div className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary px-2 py-1.5 rounded border border-primary/30">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                            <span className="font-semibold">You're Contributing</span>
                        </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/30 rounded-lg p-2 border border-border/40">
                            <div className="text-[10px] text-foreground/70 font-semibold uppercase tracking-wide mb-0.5">
                                Contributors
                            </div>
                            <div className="text-xl font-bold text-foreground">
                                {progress.contributors?.length || 0}
                            </div>
                        </div>
                        
                        <div className="bg-muted/30 rounded-lg p-2 border border-border/40">
                            <div className="text-[10px] text-foreground/70 font-semibold uppercase tracking-wide mb-0.5">
                                Updates
                            </div>
                            <div className="text-xl font-bold text-foreground">
                                {progress.updates?.length || 0}
                            </div>
                        </div>
                    </div>

                    {/* Repository badge if exists */}
                    {progress.githubRepoId && (
                        <a
                            href={getGithubUrl(progress.githubRepoId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()} // Prevent opening the dialog
                            className="flex items-center gap-2 text-sm bg-primary/5 text-primary px-3 py-2 rounded-lg border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-colors font-medium"
                        >
                            <GitBranch size={14} />
                            <span className="font-semibold">Repository Linked</span>
                            <ExternalLink size={12} className="ml-auto" />
                        </a>
                    )}

                    {/* Latest update */}
                    <div className="flex items-center gap-1.5 text-xs text-foreground/70 border-t border-border/40 pt-2">
                        <Clock size={11} className="flex-shrink-0" />
                        <span className="text-[11px] leading-tight font-medium">{getLatestUpdateText()}</span>
                    </div>

                    {/* Hover hint */}
                    <div className="flex items-center justify-center gap-1.5 text-xs text-foreground/60 group-hover:text-primary/80 transition-colors pt-1">
                        <ExternalLink size={11} />
                        <span className="font-semibold">Click to view timeline</span>
                    </div>
                </CardContent>
            </Card>

            {/* Dialog - only opens when user clicks */}
            <ImplementationProgressDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                progress={progress}
                paperId={paperId}
                paperStatus={paperStatus}
                currentUser={currentUser}
                onImplementationProgressChange={onImplementationProgressChange}
                onRefreshPaper={onRefreshPaper}
                onSendEmail={handleSendEmail}
                isSendingEmail={isFetchingEmail}
            />
        </>
    );
};

export default ImplementationProgressCard;