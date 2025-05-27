import React from 'react';
import { Paper } from '../../../../types/paper'; // Corrected import path
import { UserProfile } from '../../../../services/auth'; // Added import for UserProfile
import { VoteButton, RetractVoteButton, FaThumbsUp, FaThumbsDown } from '../../VotingButtons';
import { UserDisplayList } from '../../UserDisplayList'; // Named import
import './ImplementabilityTab.css';
import type { PaperActionUsers } from '../../../../services/api'; // Add this line


interface ImplementabilityTabProps {
    paper: Paper;
    currentUser: UserProfile | null;
    isVoting: boolean;
    handleImplementabilityVote: (voteType: 'confirm' | 'dispute' | 'retract') => void;
    actionUsers: PaperActionUsers | null; // Changed ActionUsers to PaperActionUsers
    isLoadingActionUsers: boolean;
    actionUsersError: string | null;
}

// Changed to named export
export const ImplementabilityTab: React.FC<ImplementabilityTabProps> = ({
    paper,
    currentUser,
    isVoting,
    handleImplementabilityVote,
    actionUsers,
    isLoadingActionUsers,
    actionUsersError,
}) => {
    const isOwnerConfirmed = paper.nonImplementableConfirmedBy === 'owner';
    const isCommunityConfirmedImplementable = paper.nonImplementableStatus === 'confirmed_implementable' && paper.nonImplementableConfirmedBy === 'community';
    const isCommunityConfirmedNonImplementable = paper.nonImplementableStatus === 'confirmed_non_implementable' && paper.nonImplementableConfirmedBy === 'community';

    // Hide voting if owner has confirmed a status, or if community has confirmed it as implementable.
    // Voting remains if community confirmed non-implementable, to allow disputes unless owner locks it.
    const showVotingInterface = !isOwnerConfirmed && !isCommunityConfirmedImplementable;

    // 'up' means user voted "Is Implementable" (Thumbs Up)
    // 'down' means user voted "Not Implementable" (Thumbs Down)
    const currentUserVotedIsImplementable = paper.currentUserImplementabilityVote === 'up'; 
    const currentUserVotedNotImplementable = paper.currentUserImplementabilityVote === 'down';

    let statusMessage = "";
    if (isOwnerConfirmed) {
        if (paper.nonImplementableStatus === 'confirmed_implementable') {
            statusMessage = "Paper status confirmed as Implementable by Admin.";
        } else if (paper.nonImplementableStatus === 'confirmed_non_implementable') {
            statusMessage = "Paper status confirmed as Not Implementable by Admin.";
        }
    } else if (isCommunityConfirmedImplementable) {
        statusMessage = "Paper status confirmed as Implementable by Community Vote.";
    } else if (isCommunityConfirmedNonImplementable) {
        statusMessage = "Paper status confirmed as Not Implementable by Community Vote. Admin can override or reset voting.";
    }

    return (
        <div className="tab-pane-container">
            <h3>Implementability Status</h3>
            
            {statusMessage && (
                <div className={`status-message ${isOwnerConfirmed ? 'owner-confirmed' : 'community-confirmed'}`}>
                    <p>{statusMessage}</p>
                </div>
            )}

            {showVotingInterface ? (
                <>
                    <div className="implementability-explanation">
                        <h4>Community Voting: Is this paper implementable?</h4>
                        <p>
                            Use <FaThumbsUp title="Vote Is Implementable Icon" /> if you think this paper <strong>can</strong> be reasonably implemented.
                        </p>
                        <p>
                            Use <FaThumbsDown title="Vote Not Implementable Icon" /> if you think this paper <strong>cannot</strong> be reasonably implemented.
                        </p>
                        <p>
                            Admins can confirm the status based on community feedback or reset voting.
                        </p>
                    </div>
                    <div className="tab-action-area">
                        {currentUser ? (
                            <>
                                <VoteButton // Thumbs Up for "Is Implementable"
                                    onClick={() => handleImplementabilityVote(currentUserVotedIsImplementable ? 'retract' : 'confirm')} 
                                    disabled={isVoting || isCommunityConfirmedNonImplementable}
                                    voted={currentUserVotedIsImplementable}
                                    count={paper.disputeImplementableVotes} 
                                    icon={<FaThumbsUp />}
                                    text="Is Implementable"
                                    className="thumbs-up"
                                    title={isCommunityConfirmedNonImplementable ? "Community confirmed Non-Implementable. Admin can reset." : "Vote Is Implementable"}
                                />
                                <VoteButton // Thumbs Down for "Not Implementable"
                                    onClick={() => handleImplementabilityVote(currentUserVotedNotImplementable ? 'retract' : 'dispute')} 
                                    disabled={isVoting}
                                    voted={currentUserVotedNotImplementable}
                                    count={paper.nonImplementableVotes}
                                    icon={<FaThumbsDown />}
                                    text="Not Implementable"
                                    className="thumbs-down"
                                    title="Vote Not Implementable"
                                />
                                {(currentUserVotedIsImplementable || currentUserVotedNotImplementable) && (
                                    <RetractVoteButton onClick={() => handleImplementabilityVote('retract')} disabled={isVoting} />
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
                <div className="voting-disabled-message">
                    <p>Community voting is currently disabled for this paper due to its confirmed status.</p>
                    {isOwnerConfirmed && <p>An Admin has set the final status.</p>}
                    {isCommunityConfirmedImplementable && <p>The community has confirmed this paper as implementable.</p>}
                </div>
            )}
        </div>
    );
};
