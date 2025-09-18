import React from 'react';
import { Paper, ImplementabilityAction } from '../../../../common/types/paper';
import type { UserProfile } from '../../../../common/types/user';
import { VoteButton, RetractVoteButton, FaThumbsUp, FaThumbsDown } from '../../VotingButtons';
import { UserDisplayList } from '../../UserDisplayList'; // Named import
import './ImplementabilityVotingTab.css';
import type { PaperActionUsers } from '../../../../common/services/api'; // Add this line


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
            {statusMessage && (
                <div className={`p-3 rounded-lg border text-sm ${
                    statusMessageType === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                    statusMessageType === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                    statusMessageType === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                    {statusMessage}
                </div>
            )}

            {showVotingControls ? (
                <div className="space-y-4">
                    {!isAdminSetStatus && paper.implementabilityStatus === 'Voting' && (
                        <div className="text-sm text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-lg">
                            <p>
                                Use <FaThumbsUp /> if this paper <strong>can</strong> be implemented.
                            </p>
                            <p>
                                Use <FaThumbsDown /> if this paper <strong>cannot</strong> be implemented.
                            </p>
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        {currentUser ? (
                            <>
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
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center">Please log in to vote</p>
                        )}
                    </div>
                    
                    <div className="space-y-3 text-sm">
                        <UserDisplayList
                            title="Implementable"
                            users={actionUsers?.votedIsImplementable}
                            isLoading={isLoadingActionUsers}
                            error={actionUsersError}
                            emptyMessage="No votes yet"
                        />
                        <UserDisplayList
                            title="Not Implementable"
                            users={actionUsers?.votedNotImplementable}
                            isLoading={isLoadingActionUsers}
                            error={actionUsersError}
                            emptyMessage="No votes yet"
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
};
