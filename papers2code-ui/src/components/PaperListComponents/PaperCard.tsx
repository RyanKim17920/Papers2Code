import React from 'react';
import { Link } from 'react-router-dom';
import { PaperSummary } from '../../types/paper';
import './PaperCard.css';

interface PaperCardProps {
  paper: PaperSummary;
}

const PaperCard: React.FC<PaperCardProps> = ({ paper }) => {
  const authors = paper.authors.map(a => a.name).join(', ');

  return (
    <div className="paper-card">
      {/* Title with fixed height */}
      <h3>
        <Link to={`/paper/${paper.id}`}>{paper.title}</Link>
      </h3>

      {/* Restructured meta content with top and bottom sections */}
      <div className="card-meta-content">
        {/* Authors at the top */}
        <div className="card-meta-top">
          <p className="authors">Authors: {authors}</p>
        </div>
        
        {/* Date and status at the bottom */}
        <div className="card-meta-bottom">
          <p className="date">Date: {new Date(paper.date).toLocaleDateString()}</p>
          <p className="status">Status: {paper.implementationStatus}</p>
        </div>
      </div>

      {/* Button at the bottom */}
      <Link to={`/paper/${paper.id}`} className="details-link">
        View Details & Progress
      </Link>
    </div>
  );
};

export default PaperCard;