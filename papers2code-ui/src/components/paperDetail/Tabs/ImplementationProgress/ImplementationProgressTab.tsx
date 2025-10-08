import React, { useEffect } from 'react';
import { ImplementationProgress, ProgressStatus, UpdateEventType } from '../../../../common/types/implementation';
import type { UserProfile } from '../../../../common/types/user';
import { EmailStatusManager } from './EmailStatusManager';
import { GitHubRepoManager } from './GitHubRepoManager';
import { ContributorsDisplay } from './ContributorsDisplay';
import { HorizontalTimeline } from './HorizontalTimeline';
import Modal from '../../../../common/components/Modal';
import { useAuthorOutreachEmail } from '../../../../common/hooks/useAuthorOutreachEmail';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { GitBranch, Users, Mail, AlertCircle } from 'lucide-react';

interface ImplementationProgressProps {
    progress: ImplementationProgress;
    paperId: string;
    currentUser: UserProfile | null;
    onImplementationProgressChange: (updatedProgress: ImplementationProgress) => void;
}

export const ImplementationProgressTab: React.FC<ImplementationProgressProps> = ({
    progress,
    paperId,
    currentUser,
    onImplementationProgressChange
}) => {
    const { emailContent, fetchEmailContent, isFetchingEmail, emailError, clearEmailContent } = useAuthorOutreachEmail(paperId);
 
    // Permission helpers
    const isLoggedIn = !!currentUser;
    const isContributor = isLoggedIn && progress.contributors.includes(currentUser!.id);
    const isInitiator = isLoggedIn && progress.initiatedBy === currentUser!.id;
    
    // Check if email has been sent by looking at updates
    const hasEmailBeenSent = progress.updates.some(u => u.eventType === UpdateEventType.EMAIL_SENT);
    
    const canModifyPostSentStatus = isLoggedIn && (
        isInitiator || 
        (hasEmailBeenSent && isContributor)
    );

    const canMarkAsSent = isLoggedIn && isContributor && !hasEmailBeenSent;
    const canModifyRepo = isLoggedIn && isInitiator;

    // State for managing updating status and errors
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    useEffect(() => {
        if (emailError) {
            console.error("Email fetch error:", emailError);
        }
    }, [emailError]);
 
    // Auto-update to "No Response" when cooldown expires
    useEffect(() => {
        const emailSentEvent = progress.updates.find(u => u.eventType === UpdateEventType.EMAIL_SENT);
        
        const hasReachedNoResponseTime = (): boolean => {
            if (!emailSentEvent) return false;
            
            const sentDate = new Date(emailSentEvent.timestamp);
            const now = new Date();
            const fourWeeksInMs = 4 * 7 * 24 * 60 * 60 * 1000;
            
            return (now.getTime() - sentDate.getTime()) >= fourWeeksInMs;
        };

        const checkAutoNoResponse = async () => {
            if (progress.status === ProgressStatus.STARTED && 
                emailSentEvent && 
                hasReachedNoResponseTime()) {
                
                try {
                    const updatedProgress: ImplementationProgress = {
                        ...progress,
                        status: ProgressStatus.NO_RESPONSE,
                        updatedAt: new Date().toISOString()
                    };
                    await onImplementationProgressChange(updatedProgress);
                } catch (err) {
                    console.error('Failed to auto-update to No Response:', err);
                }
            } 
        };
 
        checkAutoNoResponse();
    }, [progress, onImplementationProgressChange]);

    if (!progress) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Progress Data</h3>
                <p className="text-sm text-muted-foreground">Implementation progress information is not available.</p>
            </div>
        );
    }

    const shouldShowGithubField = (): boolean => {
        return [
            ProgressStatus.CODE_UPLOADED,
            ProgressStatus.CODE_NEEDS_REFACTORING,
            ProgressStatus.REFUSED_TO_UPLOAD,
            ProgressStatus.NO_RESPONSE
        ].includes(progress.status);
    };

    const getWIPStatus = () => {
        if (progress.status === ProgressStatus.CODE_UPLOADED) {
            return { label: 'Completed', variant: 'default' as const };
        } else {
            // Show the actual status
            return { label: progress.status, variant: 'outline' as const };
        }
    };

    const wipStatus = getWIPStatus();

    return (
        <div className="space-y-6">
            {/* Header with status badges */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Implementation Progress</h2>
                    <p className="text-sm text-muted-foreground mt-1">Track the journey from paper to code</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    {progress.githubRepoId && (
                        <Badge variant="outline" className="gap-1">
                            <GitBranch className="w-3 h-3" />
                            Repository Available
                        </Badge>
                    )}
                    <Badge variant={wipStatus.variant}>
                        {wipStatus.label}
                    </Badge>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <Card className="border-destructive bg-destructive/10">
                    <CardContent className="py-4">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm text-destructive font-medium">{error}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setError(null)}
                                className="h-6 w-6 p-0"
                            >
                                ×
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Interactive Timeline */}
            <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Implementation Timeline</CardTitle>
                    <CardDescription>
                        Click on timeline events to view detailed information
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-6">
                    <HorizontalTimeline progress={progress} />
                </CardContent>
            </Card>

            {/* Two-column layout for details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Status Management */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Mail className="w-4 h-4" />
                            Status Management
                        </CardTitle>
                        <CardDescription>
                            Update implementation status and contact authors
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <EmailStatusManager
                            progress={progress}
                            currentUser={currentUser}
                            onProgressChange={onImplementationProgressChange}
                            canMarkAsSent={canMarkAsSent}
                            canModifyPostSentStatus={canModifyPostSentStatus}
                            isUpdating={isUpdating}
                            onUpdatingChange={setIsUpdating}
                            onError={setError}
                        />
                        
                        {isContributor && (
                            <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={fetchEmailContent}
                                disabled={isFetchingEmail}
                            >
                                <Mail className="w-4 h-4 mr-2" />
                                {isFetchingEmail ? 'Loading...' : 'View Author Outreach Email'}
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Right: GitHub & Contributors */}
                <div className="space-y-6">
                    {/* GitHub Repository */}
                    {shouldShowGithubField() && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <GitBranch className="w-4 h-4" />
                                    GitHub Repository
                                </CardTitle>
                                <CardDescription>
                                    Link to the implementation code
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <GitHubRepoManager
                                    progress={progress}
                                    onProgressChange={onImplementationProgressChange}
                                    canModifyRepo={canModifyRepo}
                                    isUpdating={isUpdating}
                                    onUpdatingChange={setIsUpdating}
                                    onError={setError}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Contributors */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Users className="w-4 h-4" />
                                Contributors
                            </CardTitle>
                            <CardDescription>
                                People working on this implementation
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ContributorsDisplay 
                                progress={progress}
                                currentUser={currentUser}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Email Content Modal */}
            <Modal isOpen={!!emailContent} onClose={clearEmailContent} title="Author Outreach Email Template">
                {emailContent && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-foreground block mb-2">Subject:</label>
                            <textarea 
                                className="w-full p-3 rounded-md border border-border bg-background text-foreground text-sm resize-none"
                                value={emailContent.subject} 
                                readOnly 
                                rows={2}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground block mb-2">Body:</label>
                            <textarea 
                                className="w-full p-3 rounded-md border border-border bg-background text-foreground text-sm resize-none"
                                value={emailContent.body} 
                                readOnly 
                                rows={15}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Copy the content above and send it manually to the paper authors.
                        </p>
                    </div>
                )}
            </Modal>
        </div>
    );
};
