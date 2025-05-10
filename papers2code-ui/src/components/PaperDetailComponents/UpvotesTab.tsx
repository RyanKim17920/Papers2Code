import React from 'react';
import { Paper } from '../types'; // Corrected import path
import { UserProfile } from '../services/auth';
import { VoteButton, RetractVoteButton, FaArrowUp } from './VotingButtons';
import { UserDisplayList } from './UserDisplayList'; // Named import
import { ActionUsers } from '../hooks/usePaperDetail';

interface UpvotesTabProps {
    paper: Paper;
    currentUser: UserProfile | null;
    isVoting: boolean;
    handleUpvote: (voteType: 'up' | 'none') => void;
    actionUsers: ActionUsers | null;
    isLoadingActionUsers: boolean;
    actionUsersError: string | null;
}

// Changed to named export
export const UpvotesTab: React.FC<UpvotesTabProps> = ({
    paper,
    currentUser,
    isVoting,
    handleUpvote,
    actionUsers,
    isLoadingActionUsers,
    actionUsersError,
}) => {
    // ... (rest of the component code is the same)
    return (
        <div className="tab-pane-container">
            <h3>Upvotes</h3>
            <div className="tab-action-area">
                {currentUser ? (
                    <>
                        <VoteButton
                            onClick={() => handleUpvote(paper.currentUserVote === 'up' ? 'none' : 'up')}
                            disabled={isVoting}
                            voted={paper.currentUserVote === 'up'}
                            count={paper.upvoteCount}
                            icon={<FaArrowUp />}
                            text={paper.currentUserVote === 'up' ? 'Upvoted' : 'Upvote'}
                            className="upvote-tab" 
                        />
                        {paper.currentUserVote === 'up' && (
                            <RetractVoteButton onClick={() => handleUpvote('none')} disabled={isVoting} />
                        )}
                    </>
                ) : (
                    <p>Please log in to upvote.</p>
                )}
            </div>
            <UserDisplayList
                title="Upvoted By"
                users={actionUsers?.upvotes} 
                isLoading={isLoadingActionUsers}
                error={actionUsersError}
                emptyMessage="No upvotes yet."
            />
        </div>
    );
};

// Removed default export: export default UpvotesTab;
