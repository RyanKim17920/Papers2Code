import React, { useState } from 'react';
import { Code, GitBranch, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ImplementationProgressDialog } from './Tabs/ImplementationProgress/ImplementationProgressDialog';
import { useAuthorOutreachEmail } from '../../common/hooks/useAuthorOutreachEmail';
import type { ImplementationProgress, UpdateEventType } from '../../common/types/implementation';
import type { UserProfile } from '../../common/types/user';
import { getStatusColorClasses } from '../../common/utils/statusUtils';

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
        const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
        const timeText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;
        
        const eventTypeMap: Record<string, string> = {
            'Initiated': 'Started implementation',
            'Email Sent': 'Contacted authors',
            'Status Changed': 'Status updated',
            'GitHub Repo Linked': 'Repository linked',
        };
        
        return `${eventTypeMap[latestUpdate.eventType] || latestUpdate.eventType} • ${timeText}`;
    };

    return (
        <>
            <Card className="bg-card/70 backdrop-blur border border-border/60 hover:border-border transition-colors">
                <CardContent className="p-2 space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">
                            <Code className="w-3 h-3 text-primary" />
                            Progress
                        </h3>
                    </div>

                    {/* Basic info */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Status</span>
                            <Badge 
                                variant="outline" 
                                className={`text-xs h-4 px-1 ${getStatusColorClasses(paperStatus)}`}
                            >
                                {paperStatus || 'Not Started'}
                            </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Contributors</span>
                            <span className="font-medium">{progress.contributors?.length || 0}</span>
                        </div>

                        {progress.githubRepoId && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Repository</span>
                                <GitBranch size={10} className="text-primary" />
                            </div>
                        )}

                        {/* Latest update preview */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                            <Clock size={9} />
                            <span className="text-[10px]">{getLatestUpdateText()}</span>
                        </div>
                    </div>

                    {/* View Timeline Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDialogOpen(true)}
                        className="w-full h-6 text-xs flex items-center gap-1"
                    >
                        <ExternalLink size={10} />
                        View Timeline & Details
                    </Button>
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