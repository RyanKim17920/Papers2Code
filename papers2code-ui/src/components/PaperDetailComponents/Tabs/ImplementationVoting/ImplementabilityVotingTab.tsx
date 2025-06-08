import React from 'react';
import { Paper, ImplementabilityAction } from '../../../../types/paper'; // Ensure ImplementabilityAction is imported
import { UserProfile } from '../../../../services/auth'; // Added import for UserProfile
import { VoteButton, RetractVoteButton, FaThumbsUp, FaThumbsDown } from '../../VotingButtons';
import { UserDisplayList } from '../../UserDisplayList'; // Named import
import './ImplementabilityVotingTab.css';
import type { PaperActionUsers } from '../../../../services/api'; // Add this line


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
        <div className="tab-pane-container implementability-tab">
            <h3>Implementability Status</h3>

            {statusMessage && (
                <div className={`status-message message-${statusMessageType} implementability-status-message`}>
                    <p>{statusMessage}</p>
                </div>
            )}

            {showVotingControls ? (
                <>
                    <div className="implementability-explanation">
                        {!isAdminSetStatus && paper.implementabilityStatus === 'Voting' && (
                            <>
                                <p>
                                    Use <FaThumbsUp /> if you believe this paper <strong>can</strong> be reasonably implemented (assumptions about missing information, lack of training data, etc. are fine).
                                </p>
                                <p>
                                    Use <FaThumbsDown /> if you believe this paper <strong>cannot</strong> be reasonably implemented in any way (not code-related at all like surveys).
                                </p>
                            </>
                        )}
                         <p>Your vote contributes to the community consensus. Admins may also set a final status.</p>
                    </div>
                    <div className="tab-action-area">
                        {currentUser ? (
                            <>
                                <VoteButton
                                    onClick={handleIsImplementableClick}
                                    disabled={commonButtonDisabled}
                                    voted={currentUserVotedIsImplementable}
                                    count={paper.isImplementableVotes}
                                    icon={<FaThumbsUp />}
                                    text="Is Implementable"
                                    className="thumbs-up"
                                    title={isAdminSetStatus ? "Voting disabled by admin" : (currentUserVotedIsImplementable ? "Retract 'Is Implementable' vote" : "Vote 'Is Implementable'")}
                                />
                                <VoteButton
                                    onClick={handleNotImplementableClick}
                                    disabled={commonButtonDisabled}
                                    voted={currentUserVotedNotImplementable}
                                    count={paper.nonImplementableVotes}
                                    icon={<FaThumbsDown />}
                                    text="Not Implementable"
                                    className="thumbs-down"
                                    title={isAdminSetStatus ? "Voting disabled by admin" : (currentUserVotedNotImplementable ? "Retract 'Not Implementable' vote" : "Vote 'Not Implementable'")}
                                />
                                {showRetractButton && (
                                    <RetractVoteButton 
                                        onClick={() => handleImplementabilityVote('retract')} 
                                        disabled={commonButtonDisabled} 
                                        title={isAdminSetStatus ? "Voting disabled by admin" : "Retract your current vote"}
                                    />
                                )}
                            </>
                        ) : (
                            <p>Please log in to vote on implementability.</p>
                        )}
                    </div>
                    <div className="user-lists-grid">
                        <UserDisplayList
                            title="Voted Is Implementable By:"
                            users={actionUsers?.votedIsImplementable}
                            isLoading={isLoadingActionUsers}
                            error={actionUsersError}
                            emptyMessage="No votes for 'Is Implementable' yet."
                        />
                        <UserDisplayList
                            title="Voted Not Implementable By:"
                            users={actionUsers?.votedNotImplementable}
                            isLoading={isLoadingActionUsers}
                            error={actionUsersError}
                            emptyMessage="No votes for 'Not Implementable' yet."
                        />
                    </div>
                </>
            ) : (
                // This block is effectively covered by the statusMessage when isAdminSetStatus is true
                // If showVotingControls is false due to admin action, the statusMessage already explains it.
                // Consider removing this else block if redundant with the message above.
                // For now, let's keep it simple: if voting controls aren't shown, the message above should suffice.
                null 
            )}
        </div>
    );
};
