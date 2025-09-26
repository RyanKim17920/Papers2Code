import React, { useState, useRef } from 'react';
import { Paper } from '../../../../common/types/paper';
import type { UserProfile } from '../../../../common/types/user';
import { VoteButton, RetractVoteButton, FaArrowUp } from '../../VotingButtons';
import UserListPopup from '../../../common/UserListPopup';
import type { PaperActionUsers } from '../../../../common/services/api';

interface UpvotesTabProps {
    paper: Paper;
    currentUser: UserProfile | null;
    isVoting: boolean;
    handleUpvote: (voteType: 'up' | 'none') => void;
    actionUsers: PaperActionUsers | null;
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
    const [showUpvotesPopup, setShowUpvotesPopup] = useState(false);
    const voteButtonRef = useRef<HTMLButtonElement>(null);
    const handleShowUpvotesPopup = () => {
        if (paper.upvoteCount > 0) {
            setShowUpvotesPopup(true);
        }
    };

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
                            onCountClick={handleShowUpvotesPopup}
                        />
                        {paper.currentUserVote === 'up' && (
                            <RetractVoteButton onClick={() => handleUpvote('none')} disabled={isVoting} />
                        )}
                    </>
                ) : (
                    <p>Please log in to upvote.</p>
                )}
            </div>
            
            <div className="upvotes-summary">
                <p>
                    <strong>{paper.upvoteCount}</strong> {paper.upvoteCount === 1 ? 'person has' : 'people have'} upvoted this paper.
                    {paper.upvoteCount > 0 && (
                        <span> <button 
                            className="link-button"
                            onClick={handleShowUpvotesPopup}
                        >
                            View all
                        </button></span>
                    )}
                </p>
            </div>

            <UserListPopup
                isOpen={showUpvotesPopup}
                onClose={() => setShowUpvotesPopup(false)}
                users={actionUsers?.upvotes}
                title="Upvoted By"
                isLoading={isLoadingActionUsers}
                error={actionUsersError}
                emptyMessage="No upvotes yet."
                anchorElement={voteButtonRef.current}
            />
        </div>
    );
};

// Removed default export: export default UpvotesTab;
