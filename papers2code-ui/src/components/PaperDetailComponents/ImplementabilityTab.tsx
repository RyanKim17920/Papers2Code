import React from 'react';
import { Paper } from '../../types/paper'; // Corrected import path
import { UserProfile } from '../../services/auth'; // Added import for UserProfile
import { VoteButton, RetractVoteButton, FaThumbsUp, FaThumbsDown } from './VotingButtons';
import { UserDisplayList } from './UserDisplayList'; // Named import
import './ImplementabilityTab.css';
// import { ActionUsers } from '../../hooks/usePaperDetail'; // Remove this line
import type { PaperActionUsers } from '../../services/api'; // Add this line


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
    // ... (rest of the component code is the same)
    const isConfirmedNonImplementable = paper.nonImplementableStatus === 'confirmed_non_implementable';

    return (
        <div className="tab-pane-container">
            <h3>Implementability Voting</h3>
            <div className="implementability-explanation">
                <h4>Community Voting: Is this paper implementable?</h4>
                <p>
                    Use <FaThumbsUp title="Flag Non-Implementable Icon" /> if you think this paper <strong>cannot</strong> be reasonably implemented (e.g., requires unavailable hardware, data, or is underspecified).
                    Use <FaThumbsDown title="Dispute Flag Icon" /> if you disagree with a non-implementable flag.
                    The paper admins can confirm the status based on community feedback.
                </p>
            </div>
            <div className="tab-action-area">
                {currentUser ? (
                    <>
                        <VoteButton
                            onClick={() => handleImplementabilityVote(paper.currentUserImplementabilityVote === 'up' ? 'retract' : 'confirm')}
                            disabled={isVoting || isConfirmedNonImplementable}
                            voted={paper.currentUserImplementabilityVote === 'up'}
                            count={paper.nonImplementableVotes}
                            icon={<FaThumbsUp />}
                            text="Flag Non-Implementable"
                            className="thumbs-up"
                            title={isConfirmedNonImplementable ? "Status is confirmed" : "Vote Non-Implementable"}
                        />
                        <VoteButton
                            onClick={() => handleImplementabilityVote(paper.currentUserImplementabilityVote === 'down' ? 'retract' : 'dispute')}
                            disabled={isVoting || isConfirmedNonImplementable}
                            voted={paper.currentUserImplementabilityVote === 'down'}
                            count={paper.disputeImplementableVotes}
                            icon={<FaThumbsDown />}
                            text="Dispute Flag"
                            className="thumbs-down"
                            title={isConfirmedNonImplementable ? "Status is confirmed" : "Dispute Non-Implementable Flag"}
                        />
                        {paper.currentUserImplementabilityVote !== 'none' && !isConfirmedNonImplementable && (
                            <RetractVoteButton onClick={() => handleImplementabilityVote('retract')} disabled={isVoting} />
                        )}
                    </>
                ) : (
                    <p>Please log in to vote on implementability.</p>
                )}
            </div>
            <div className="user-lists-grid">
                <UserDisplayList
                    title="Flagged Non-Implementable By"
                    users={actionUsers?.confirmations} 
                    isLoading={isLoadingActionUsers}
                    error={actionUsersError}
                    emptyMessage="No flags yet."
                />
                <UserDisplayList
                    title="Disputed Flag By"
                    users={actionUsers?.disputes} 
                    isLoading={isLoadingActionUsers}
                    error={actionUsersError}
                    emptyMessage="No disputes yet."
                />
            </div>
        </div>
    );
};

// Removed default export: export default ImplementabilityTab;
