import React from 'react';
import { Paper } from '../../types/paper'; // Use full Paper type
import PaperCard from './PaperCard';
import { Typography } from '@mui/material'; // Import Typography from Material-UI

interface PaperListDisplayProps {
  papers: Paper[]; // Use full Paper type
  debouncedSearchTerm: string;
  onVote: (paperId: string, voteType: 'up' | 'none') => Promise<void>; // Add vote handler prop
}

const PaperListDisplay: React.FC<PaperListDisplayProps> = ({ papers, debouncedSearchTerm, onVote }) => {
  // Add a defensive check to ensure onVote is a function before mapping
  if (typeof onVote !== 'function') {
    console.error("PaperListDisplay: onVote prop is not a function!", onVote);
    // Render an error or null state if the handler is missing
    return <div className="error-message">Error: Internal component communication failed (voting handler).</div>;
  }

  if (papers.length > 0) {
    return (
      <div className="paper-list">
        {papers.map((paper) => (
          <PaperCard
            key={paper.id}
            paper={paper} // Pass the full paper object
            onVote={onVote} // Pass the validated vote handler down
          />
        ))}
      </div>
    );
  }

  // Display messages for no papers found or no search term
  if (debouncedSearchTerm) {
    return (
      <Typography variant="subtitle1" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
        No papers found matching "{debouncedSearchTerm}". Try refining your search.
      </Typography>
    );
  } else {
    return (
      <Typography variant="subtitle1" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
        No papers available at the moment. Check back later!
      </Typography>
    );
  }
};

export default PaperListDisplay;