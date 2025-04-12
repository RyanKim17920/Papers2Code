// src/components/PaperCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { PaperSummary } from '../types/paper';
import './PaperCard.css';

interface PaperCardProps {
  paper: PaperSummary;
}

const PaperCard: React.FC<PaperCardProps> = ({ paper }) => {
  const authors = paper.authors.map(a => a.name).join(', ');

  return (
    <div className="paper-card">
      {/* Title remains directly inside */}
      <h3>
        <Link to={`/paper/${paper.id}`}>{paper.title}</Link>
      </h3>

      {/* Wrap metadata in a div */}
      <div className="card-meta-content">
          <p className="authors">Authors: {authors}</p>
          <p className="date">Date: {new Date(paper.date).toLocaleDateString()}</p>
          <p className="status">Status: {paper.implementationStatus}</p>
      </div>

      {/* Button remains directly inside, will be pushed down */}
      <Link to={`/paper/${paper.id}`} className="details-link">
          View Details & Progress
      </Link>
    </div>
  );
};

export default PaperCard;