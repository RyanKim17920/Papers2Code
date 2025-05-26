import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Paper, ImplementationStatus } from '../../types/paper'; // Import ImplementationStatus
import './PaperCard.css';


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
  // ... existing useState and handleVoteClick ...
  const [isVoting, setIsVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const authors = paper.authors.join(', ');
  console.log(paper)
  const handleVoteClick = async () => {
    // ... existing vote logic ...
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
  let displayStatus = paper.implementationStatus? paper.implementationStatus : ImplementationStatus.NeedsCode;
  let statusClass = 'status-default';
  let statusSymbol = '⏳'; // Default: Hourglass

  if (paper.nonImplementableStatus === 'confirmed_non_implementable') {
      displayStatus = ImplementationStatus.ConfirmedNonImplementable;
      statusClass = 'status-non-implementable';
      statusSymbol = '🚫'; // Symbol: Prohibited / Stop
  } else if (paper.implementationStatus === ImplementationStatus.Completed) {
      displayStatus = ImplementationStatus.Completed;
      statusClass = 'status-completed';
      statusSymbol = '✅'; // Symbol: Check Mark
  } else if (paper.implementationStatus === ImplementationStatus.ImplementationInProgress) {
      displayStatus = ImplementationStatus.ImplementationInProgress;
      statusClass = 'status-in-progress';
      statusSymbol = '🚧'; // Symbol: Construction / In Progress
  } else if (paper.implementationStatus === ImplementationStatus.NeedsCode) {
      statusClass = 'status-needs-code'; // Add specific class if needed
      statusSymbol = '❓'; // Symbol: Question Mark / Needs Info
  } // Add more else if for other specific statuses if needed // Add more else if for other specific statuses if needed
  // --- End Determine Status and Class ---


  return (
    <div className="paper-card">
      {/* ... Title and Meta Top ... */}
      <h3>
        <Link to={`/paper/${paper.id}`}>{paper.title}</Link>
      </h3>
      <div className="card-meta-content">
        <div className="card-meta-top">
          <p className="authors">Authors: {authors}</p>
        </div>
        <div className="card-meta-bottom">
          <p className="date">Date: {new Date(paper.publicationDate).toLocaleDateString()}</p>
          {/* --- Use determined display status, class, and symbol --- */}
          <p className={`status ${statusClass}`}>
            <span className="status-symbol">{statusSymbol}</span>
            <span className="status-text">{displayStatus}</span>
          </p>
        </div>
      </div>
      {/* ... Actions ... */}
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