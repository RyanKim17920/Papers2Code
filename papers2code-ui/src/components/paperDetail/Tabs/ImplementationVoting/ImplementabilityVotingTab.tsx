import React from 'react';
import { Info, ThumbsUp, ThumbsDown } from 'lucide-react';
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
        <div className="space-y-6">
            {/* Header with Info Tooltip */}
            <div className="flex items-start gap-3">
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-foreground mb-1">
                        Paper Implementability
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Help the community determine if this paper can be implemented in code
                    </p>
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="flex-shrink-0 p-2 rounded-lg bg-card/60 hover:bg-accent/50 border border-border/60 hover:border-primary/40 transition-colors">
                                <Info className="w-4 h-4 text-primary" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
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

            {/* Status Message */}
            {statusMessage && (
                <div className={`p-4 rounded-lg border text-sm ${
                    statusMessageType === 'success' ? 'bg-emerald-50/50 border-emerald-200/60 text-emerald-700' :
                    statusMessageType === 'error' ? 'bg-red-50/50 border-red-200/60 text-red-700' :
                    statusMessageType === 'warning' ? 'bg-amber-50/50 border-amber-200/60 text-amber-700' :
                    'bg-blue-50/50 border-blue-200/60 text-blue-700'
                }`}>
                    <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{statusMessage}</span>
                    </div>
                </div>
            )}

            {showVotingControls ? (
                <div className="space-y-5">
                    {/* Voting Instructions - only show during active voting */}
                    {!isAdminSetStatus && paper.implementabilityStatus === 'Voting' && (
                        <div className="bg-card/70 backdrop-blur border border-border/60 rounded-lg p-4">
                            <p className="text-sm font-medium text-foreground mb-3">Cast Your Vote:</p>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <ThumbsUp className="w-4 h-4 text-emerald-600" />
                                    <span>This paper <strong>can be implemented</strong> in code</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ThumbsDown className="w-4 h-4 text-red-600" />
                                    <span>This paper <strong>cannot be implemented</strong> in code</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Voting Buttons */}
                    <div className="space-y-3">
                        {currentUser ? (
                            <div className="bg-card/70 backdrop-blur border border-border/60 rounded-lg p-4">
                                <div className="space-y-3">
                                    <VoteButton
                                        onClick={handleIsImplementableClick}
                                        disabled={commonButtonDisabled}
                                        voted={currentUserVotedIsImplementable}
                                        count={paper.isImplementableVotes}
                                        icon={<FaThumbsUp />}
                                        text="Implementable"
                                        className="thumbs-up w-full"
                                        title={isAdminSetStatus ? "Voting disabled by admin" : (currentUserVotedIsImplementable ? "Retract vote" : "Vote implementable")}
                                    />
                                    <VoteButton
                                        onClick={handleNotImplementableClick}
                                        disabled={commonButtonDisabled}
                                        voted={currentUserVotedNotImplementable}
                                        count={paper.nonImplementableVotes}
                                        icon={<FaThumbsDown />}
                                        text="Not Implementable"
                                        className="thumbs-down w-full"
                                        title={isAdminSetStatus ? "Voting disabled by admin" : (currentUserVotedNotImplementable ? "Retract vote" : "Vote not implementable")}
                                    />
                                    {showRetractButton && (
                                        <RetractVoteButton 
                                            onClick={() => handleImplementabilityVote('retract')} 
                                            disabled={commonButtonDisabled} 
                                            title="Retract your current vote"
                                            className="w-full"
                                        />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-card/70 backdrop-blur border border-border/60 rounded-lg p-6 text-center">
                                <p className="text-sm text-muted-foreground">Please log in to vote on implementability</p>
                            </div>
                        )}
                    </div>
                    
                    {/* User Lists */}
                    <div className="bg-card/70 backdrop-blur border border-border/60 rounded-lg p-4">
                        <div className="space-y-4">
                            <UserDisplayList
                                title="Voted Implementable"
                                users={actionUsers?.votedIsImplementable}
                                isLoading={isLoadingActionUsers}
                                error={actionUsersError}
                                emptyMessage="No votes yet"
                            />
                            <div className="border-t border-border/40" />
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
