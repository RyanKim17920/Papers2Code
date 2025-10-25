import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Paper } from '../../common/types/paper'; // Ensure Status is imported
import { getStatusClass } from '../../common/utils/statusUtils';
import { StatusBadge } from '@/components/common/StatusBadge';

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

  // The switch statement for statusClass and statusSymbol in this component is now redundant
  // as getStatusClass and getStatusSymbol centralize this logic.
  // We directly use what paper.status provides for displayStatus text unless specific overrides are needed.

  // --- End Determine Status and Class ---

  return (
    <div className="border border-[var(--border-color)] rounded-xl px-6 py-5 bg-gradient-to-br from-[rgba(0,72,90,0.01)] to-[rgba(0,72,90,0.15)] shadow-[var(--box-shadow-sm)] transition-[box-shadow,transform] duration-[0.25s] ease-in-out flex flex-col h-[300px] flex-[0_0_calc(33.333%-20px)] min-w-[300px] box-border overflow-y-hidden hover:shadow-[var(--box-shadow-md)] hover:-translate-y-1 hover:border-[rgba(25,124,154,0.2)] max-[1100px]:flex-[0_0_calc(50%-15px)] max-[680px]:flex-[0_0_100%] max-[680px]:min-w-0 max-[680px]:h-auto">
      <h3 className="m-0 mb-3.5 text-[1.15em] font-semibold leading-[1.4] text-[var(--text-heading-color)] h-[4.2em] [-webkit-line-clamp:3] [line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden">
        <Link to={`/paper/${paper.id}`} className="no-underline text-inherit hover:text-[var(--primary-color)]">{paper.title}</Link>
      </h3>
      <div className="flex flex-col flex-grow justify-start">
        <div className="mb-2.5">
          <p className="text-[0.87em] text-[var(--text-muted-color)] m-0 mb-1.5 leading-[1.5] font-normal whitespace-nowrap overflow-hidden text-ellipsis">Authors: {authors}</p>
        </div>
        <div className="mb-3.5">
          <p className="text-[0.87em] text-[var(--text-muted-color)] m-0 mb-1.5 leading-[1.5] font-medium">Date: {paper.publicationDate ? new Date(paper.publicationDate).toLocaleDateString() : 'N/A'}</p>
          <StatusBadge paper={paper} />
        </div>
      </div>
      <div className="flex justify-between items-center mt-auto pt-2.5 border-t border-[var(--border-color)] max-[680px]:flex-col max-[680px]:items-start max-[680px]:gap-2.5">
        <div className="flex items-center gap-2 relative">
           <button
             className={`bg-none border-none p-1.5 cursor-pointer text-[var(--text-muted-color)] transition-[color,transform] duration-200 flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-60 hover:text-[var(--primary-color)] focus:outline-none focus:shadow-none ${paper.currentUserVote === 'up' ? 'text-[var(--primary-color)]' : ''}`}
             onClick={handleVoteClick}
             disabled={isVoting}
             title={paper.currentUserVote === 'up' ? 'Remove vote' : 'Upvote'}
           >
             <ThumbsUpIcon filled={paper.currentUserVote === 'up'} />
           </button>
           <span className="text-[0.9em] font-semibold text-[var(--text-color)] min-w-[20px] text-left">{paper.upvoteCount}</span>
           {voteError && <span className="absolute bottom-[110%] left-1/2 -translate-x-1/2 bg-[var(--danger-color)] text-white px-2 py-1 rounded-sm text-[0.8em] whitespace-nowrap z-10 opacity-90">{voteError}</span>}
        </div>
        <Link to={`/paper/${paper.id}`} className="px-3 py-1.5 bg-[var(--primary-light-color)] text-[var(--primary-color)] no-underline rounded-lg text-[0.85em] font-medium text-center transition-[background-color,box-shadow,color] duration-200 border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-[var(--text-on-primary)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] max-[680px]:self-stretch max-[680px]:text-center">
          View Details
        </Link>
      </div>
    </div>
  );
};


export default PaperCard;