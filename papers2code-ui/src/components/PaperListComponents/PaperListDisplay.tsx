import React from 'react';
import { Paper } from '../../types/paper';
import PaperCard from './PaperCard'; // Assuming path

interface PaperListDisplayProps {
  papers: Paper[];
  debouncedSearchTerm: string;
}

const PaperListDisplay: React.FC<PaperListDisplayProps> = ({ papers, debouncedSearchTerm }) => {
  if (papers.length > 0) {
    return (
      <div className="paper-list">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={{
              id: paper.id,
              pwcUrl: paper.pwcUrl,
              title: paper.title,
              authors: paper.authors,
              date: paper.date,
              implementationStatus: paper.implementationStatus,
              isImplementable: paper.isImplementable
          }} />
        ))}
      </div>
    );
  }

  // No papers found message
  return (
    <div className="paper-list"> {/* Keep container for consistent styling */}
      <p>
        {debouncedSearchTerm
          ? `No papers found matching "${debouncedSearchTerm}".`
          : "No implementable papers found."
        }
      </p>
    </div>
  );
};

export default PaperListDisplay;