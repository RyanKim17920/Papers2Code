import React from 'react';
import { Info, ThumbsUp, ThumbsDown, Vote } from 'lucide-react';
import { Paper, ImplementabilityAction } from '../../../../common/types/paper';
import type { UserProfile } from '../../../../common/types/user';
import { VoteButton, RetractVoteButton, FaThumbsUp, FaThumbsDown } from '../../VotingButtons';
import { UserDisplayList } from '../../UserDisplayList'; // Named import
import type { PaperActionUsers } from '../../../../common/services/api'; // Add this line
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../../../ui/tooltip';


interface ImplementabilityTabProps {
    paper: Paper;
    currentUser: UserProfile | null;
    isVoting: boolean;
    handleImplementabilityVote: (voteType: ImplementabilityAction) => void; // Use ImplementabilityAction type
    actionUsers: PaperActionUsers | null;
    isLoadingActionUsers: boolean;
    actionUsersError: string | null;
}

// Changed to named export
export const ImplementabilityVotingTab: React.FC<ImplementabilityTabProps> = ({
    paper,
    currentUser,
    isVoting,
    handleImplementabilityVote,
    actionUsers,
    isLoadingActionUsers,
    actionUsersError,
}) => {
    // Determine UI behavior based on the new implementabilityStatus
    const isAdminSetStatus = paper.implementabilityStatus === 'Admin Implementable' || paper.implementabilityStatus === 'Admin Not Implementable';
    const showVotingControls = !isAdminSetStatus; // Voting controls are hidden if an admin has set the status

    // User's current vote state
    const currentUserVotedIsImplementable = paper.currentUserImplementabilityVote === 'up';
    const currentUserVotedNotImplementable = paper.currentUserImplementabilityVote === 'down';

    let statusMessage = "";
    let statusMessageType: 'info' | 'success' | 'warning' | 'error' = 'info';

    if (paper.implementabilityStatus === 'Admin Implementable') {
        statusMessage = "Admin Confirmed: This paper is Implementable. Community voting is disabled.";
        statusMessageType = 'success';
    } else if (paper.implementabilityStatus === 'Admin Not Implementable') {
        statusMessage = "Admin Confirmed: This paper is Not Implementable. Community voting is disabled.";
        statusMessageType = 'error';
    } else if (paper.implementabilityStatus === 'Community Implementable') {
        statusMessage = "Community Consensus: Implementable. You can change your vote if needed.";
        statusMessageType = 'success';
    } else if (paper.implementabilityStatus === 'Community Not Implementable') {
        statusMessage = "Community Consensus: Not Implementable. You can vote 'Is Implementable' to help reach a different consensus, or 'Not Implementable' to reinforce this status.";
        statusMessageType = 'warning';
    } else if (paper.implementabilityStatus === 'Voting') {
        statusMessage = "Community Voting In Progress: Is this paper reasonably implementable?";
        statusMessageType = 'info';
    }

    const handleIsImplementableClick = () => {
        if (currentUserVotedIsImplementable) {
            handleImplementabilityVote('retract');
        } else {
            handleImplementabilityVote('confirm'); // 'confirm' for "Is Implementable"
        }
    };

    const handleNotImplementableClick = () => {
        if (currentUserVotedNotImplementable) {
            handleImplementabilityVote('retract');
        } else {
            handleImplementabilityVote('dispute'); // 'dispute' for "Not Implementable"
        }
    };
    
    const showRetractButton = (currentUserVotedIsImplementable || currentUserVotedNotImplementable) && showVotingControls;

    // Buttons are disabled if an API call is in progress or if admin has set the status.
    const commonButtonDisabled = isVoting || isAdminSetStatus;

    return (
        <div className="space-y-4">
            {/* Info Tooltip - Standalone, positioned to avoid header overlap */}
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground flex-1">
                    Help the community determine if this paper can be implemented in code
                </p>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="relative flex-shrink-0 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all duration-200 group">
                                <Info className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs z-50">
                            <div className="space-y-2">
                                <p className="font-semibold text-sm">What does "Not Implementable" mean?</p>
                                <ul className="text-xs space-y-1 list-disc list-inside">
                                    <li>Papers not related to coding or programming</li>
                                    <li>Pure theoretical research without practical implementation</li>
                                    <li>Dataset papers that cannot be recreated</li>
                                    <li>Survey or review papers with no code component</li>
                                    <li>Papers requiring proprietary tools or unavailable resources</li>
                                </ul>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Status Message - Enhanced styling */}
            {statusMessage && (
                <div className={`p-4 rounded-xl border-2 text-sm backdrop-blur-sm ${
                    statusMessageType === 'success' ? 'bg-emerald-50/80 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300' :
                    statusMessageType === 'error' ? 'bg-red-50/80 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300' :
                    statusMessageType === 'warning' ? 'bg-amber-50/80 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300' :
                    'bg-blue-50/80 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300'
                }`}>
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{statusMessage}</span>
                    </div>
                </div>
            )}

            {showVotingControls ? (
                <div className="space-y-4">
                    {/* Voting Instructions - Enhanced visual design */}
                    {!isAdminSetStatus && paper.implementabilityStatus === 'Voting' && (
                        <div className="bg-gradient-to-br from-primary/5 to-accent/10 backdrop-blur border-2 border-primary/20 rounded-xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Vote className="w-4 h-4 text-primary" />
                                Cast Your Vote
                            </p>
                            <div className="space-y-2.5 text-sm">
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-background/60 border border-border/40">
                                    <ThumbsUp className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span className="text-muted-foreground">This paper <strong className="text-foreground">can be implemented</strong> in code</span>
                                </div>
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-background/60 border border-border/40">
                                    <ThumbsDown className="w-5 h-5 text-red-600 flex-shrink-0" />
                                    <span className="text-muted-foreground">This paper <strong className="text-foreground">cannot be implemented</strong> in code</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Voting Buttons - Enhanced layout and styling */}
                    <div className="space-y-3">
                        {currentUser ? (
                            <div className="bg-gradient-to-br from-card/80 to-card/60 backdrop-blur border-2 border-border/60 rounded-xl p-5 shadow-md">
                                <div className="space-y-3">
                                    <VoteButton
                                        onClick={handleIsImplementableClick}
                                        disabled={commonButtonDisabled}
                                        voted={currentUserVotedIsImplementable}
                                        count={paper.isImplementableVotes}
                                        icon={<FaThumbsUp />}
                                        text="Implementable"
                                        className="thumbs-up w-full !py-3 text-base shadow-sm hover:shadow-md transition-all"
                                        title={isAdminSetStatus ? "Voting disabled by admin" : (currentUserVotedIsImplementable ? "Retract vote" : "Vote implementable")}
                                    />
                                    <VoteButton
                                        onClick={handleNotImplementableClick}
                                        disabled={commonButtonDisabled}
                                        voted={currentUserVotedNotImplementable}
                                        count={paper.nonImplementableVotes}
                                        icon={<FaThumbsDown />}
                                        text="Not Implementable"
                                        className="thumbs-down w-full !py-3 text-base shadow-sm hover:shadow-md transition-all"
                                        title={isAdminSetStatus ? "Voting disabled by admin" : (currentUserVotedNotImplementable ? "Retract vote" : "Vote not implementable")}
                                    />
                                    {showRetractButton && (
                                        <RetractVoteButton 
                                            onClick={() => handleImplementabilityVote('retract')} 
                                            disabled={commonButtonDisabled} 
                                            title="Retract your current vote"
                                            className="w-full !py-2.5 shadow-sm"
                                        />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gradient-to-br from-muted/40 to-muted/20 backdrop-blur border-2 border-dashed border-border/60 rounded-xl p-8 text-center">
                                <p className="text-sm font-medium text-muted-foreground">Please log in to vote on implementability</p>
                            </div>
                        )}
                    </div>
                    
                    {/* User Lists - Enhanced card design */}
                    <div className="bg-card/60 backdrop-blur border-2 border-border/50 rounded-xl p-5 shadow-sm">
                        <div className="space-y-5">
                            <UserDisplayList
                                title="Voted Implementable"
                                users={actionUsers?.votedIsImplementable}
                                isLoading={isLoadingActionUsers}
                                error={actionUsersError}
                                emptyMessage="No votes yet"
                            />
                            <div className="border-t-2 border-border/30" />
                            <UserDisplayList
                                title="Voted Not Implementable"
                                users={actionUsers?.votedNotImplementable}
                                isLoading={isLoadingActionUsers}
                                error={actionUsersError}
                                emptyMessage="No votes yet"
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
