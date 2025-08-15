import React from 'react';
import { Link } from 'react-router-dom';
import { Paper } from '../../common/types/paper';
import './EnhancedPaperCard.css';

interface EnhancedPaperCardProps {
  paper: Paper;
  showFullAbstract?: boolean;
}

const EnhancedPaperCard: React.FC<EnhancedPaperCardProps> = ({ 
  paper, 
  showFullAbstract = false 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return '#28a745';
      case 'Work in Progress': return '#ffc107';
      case 'Started': return '#17a2b8';
      case 'Not Started': return '#6c757d';
      case 'Official Code Posted': return '#28a745';
      default: return '#6c757d';
    }
  };

  const truncateAbstract = (abstract: string, maxLength: number = 150): string => {
    if (!abstract || abstract.length <= maxLength) return abstract;
    return abstract.substring(0, maxLength).trim() + '...';
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
      return `${Math.ceil(diffDays / 365)} years ago`;
    } catch {
      return 'Recently';
    }
  };

  // Extract domain tags from paper (this would ideally come from the backend)
  const getDomainTags = (paper: Paper): string[] => {
    const tags: string[] = [];
    
    // Simple heuristic based on title and abstract
    const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
    
    if (text.includes('vision') || text.includes('image') || text.includes('visual')) {
      tags.push('Computer Vision');
    }
    if (text.includes('nlp') || text.includes('language') || text.includes('text')) {
      tags.push('NLP');
    }
    if (text.includes('learning') || text.includes('neural') || text.includes('network')) {
      tags.push('Machine Learning');
    }
    if (text.includes('transformer') || text.includes('attention')) {
      tags.push('Transformers');
    }
    
    return tags.slice(0, 3); // Limit to 3 tags
  };

  const domainTags = getDomainTags(paper);

  return (
    <article className="enhanced-paper-card">
      <Link to={`/paper/${paper.id}`} className="card-link">
        <header className="card-header">
          <h3 className="paper-title">{paper.title}</h3>
          {paper.status && (
            <span 
              className="status-badge"
              style={{ backgroundColor: getStatusColor(paper.status) }}
            >
              {paper.status}
            </span>
          )}
        </header>

        <div className="paper-authors">
          {paper.authors && paper.authors.length > 0 ? (
            <>
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ` et al.`}
            </>
          ) : (
            'Unknown authors'
          )}
        </div>

        {paper.abstract && (
          <div className="paper-abstract">
            {showFullAbstract ? paper.abstract : truncateAbstract(paper.abstract)}
          </div>
        )}

        {domainTags.length > 0 && (
          <div className="domain-tags">
            {domainTags.map((tag, index) => (
              <span key={index} className="domain-tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        <footer className="card-footer">
          <div className="paper-metrics">
            {paper.upvoteCount && paper.upvoteCount > 0 && (
              <div className="metric">
                <span className="metric-icon">⭐</span>
                <span className="metric-value">{paper.upvoteCount}</span>
              </div>
            )}
            
            {paper.implementationProgress && (
              <div className="metric">
                <span className="metric-icon">💾</span>
                <span className="metric-value">1</span>
              </div>
            )}
            
            {/* Placeholder for discussions count */}
            <div className="metric">
              <span className="metric-icon">💬</span>
              <span className="metric-value">0</span>
            </div>
          </div>

          <div className="paper-metadata">
            {paper.proceeding && (
              <span className="venue">{paper.proceeding}</span>
            )}
            <span className="timestamp">
              {paper.publicationDate ? formatDate(paper.publicationDate) : 'Recently'}
            </span>
          </div>
        </footer>
      </Link>
    </article>
  );
};

export default EnhancedPaperCard;
