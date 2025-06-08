import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Paper } from '../../common/types/paper'; // Ensure Status is imported
import './PaperCard.css';
import { getStatusClass, getStatusSymbol } from '../../common/utils/statusUtils';

const ThumbsUpIcon = ({ filled }: { filled: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
  </svg>
);

interface PaperCardProps {
  paper: Paper; // Use full Paper type
  onVote: (paperId: string, voteType: 'up' | 'none') => Promise<void>; // Add vote handler prop
}

const PaperCard: React.FC<PaperCardProps> = ({ paper, onVote }) => {
  const [isVoting, setIsVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const authors = paper.authors?.join(', ');
  const handleVoteClick = async () => {
    if (isVoting) return; // Prevent multiple clicks

    setIsVoting(true);
    setVoteError(null);
    const nextVoteType = paper.currentUserVote === 'up' ? 'none' : 'up';

    try {
      await onVote(paper.id, nextVoteType);
      // State update is handled by the parent via the onVote callback refreshing the paper list data
    } catch (error) {
      console.error("Voting failed:", error);
      setVoteError(error instanceof Error ? error.message : "Vote failed");
      // Optionally clear error after a delay
      setTimeout(() => setVoteError(null), 3000);
    } finally {
      setIsVoting(false);
    }
  };

  // --- Determine Display Status and Class ---
  let displayStatus: string = paper.status;
  if (paper.status === 'Not Started' && paper.nonImplementableVotes > 0 && paper.implementabilityStatus === 'Voting') {
    displayStatus = 'Disputed'; // Or 'Community Concern'
  }
  // Default class and symbol are now handled within statusUtils or by direct assignment below
  const statusClass = getStatusClass(paper); // Pass the whole paper object
  const statusSymbol = getStatusSymbol(paper); // Pass the whole paper object

  // The switch statement for statusClass and statusSymbol in this component is now redundant
  // as getStatusClass and getStatusSymbol centralize this logic.
  // We directly use what paper.status provides for displayStatus text unless specific overrides are needed.

  // --- End Determine Status and Class ---

  return (
    <div className="paper-card">
      <h3>
        <Link to={`/paper/${paper.id}`}>{paper.title}</Link>
      </h3>
      <div className="card-meta-content">
        <div className="card-meta-top">
          <p className="authors">Authors: {authors}</p>
        </div>
        <div className="card-meta-bottom">
          <p className="date">Date: {paper.publicationDate ? new Date(paper.publicationDate).toLocaleDateString() : 'N/A'}</p>
          <p className={`status ${statusClass}`}>
            <span className="status-symbol">{statusSymbol}</span>
            <span className="status-text">{displayStatus}</span>
          </p>
        </div>
      </div>
      <div className="card-actions">
        <div className="vote-section">
           <button
             className={`vote-button ${paper.currentUserVote === 'up' ? 'active' : ''}`}
             onClick={handleVoteClick}
             disabled={isVoting}
             title={paper.currentUserVote === 'up' ? 'Remove vote' : 'Upvote'}
           >
             <ThumbsUpIcon filled={paper.currentUserVote === 'up'} />
           </button>
           <span className="upvote-count">{paper.upvoteCount}</span>
           {voteError && <span className="vote-error-tooltip">{voteError}</span>}
        </div>
        <Link to={`/paper/${paper.id}`} className="details-link">
          View Details
        </Link>
      </div>
    </div>
  );
};

export default PaperCard;