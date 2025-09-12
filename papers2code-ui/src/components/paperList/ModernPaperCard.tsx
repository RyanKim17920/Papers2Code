import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ExternalLink, Users, Calendar } from 'lucide-react';
import { Paper } from '../../common/types/paper';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { getStatusClass } from '../../common/utils/statusUtils';
import { StatusBadge } from '@/components/common/StatusBadge';

interface ModernPaperCardProps {
  paper: Paper;
  onVote: (paperId: string, voteType: 'up' | 'none') => Promise<void>;
}

const ModernPaperCard: React.FC<ModernPaperCardProps> = ({ paper, onVote }) => {
  const [isVoting, setIsVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  const handleVoteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isVoting) return;

    setIsVoting(true);
    setVoteError(null);
    const nextVoteType = paper.currentUserVote === 'up' ? 'none' : 'up';

    try {
      await onVote(paper.id, nextVoteType);
    } catch (error) {
      console.error("Voting failed:", error);
      setVoteError(error instanceof Error ? error.message : "Vote failed");
      setTimeout(() => setVoteError(null), 3000);
    } finally {
      setIsVoting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return 'Invalid date';
    }
  };

  const truncateAbstract = (abstract: string, maxLength: number = 200): string => {
    if (!abstract || abstract.length <= maxLength) return abstract || '';
    return abstract.substring(0, maxLength).trim() + '...';
  };

  // Removed local color mapping in favor of unified StatusBadge component.

  // Generate domain tags based on title/abstract keywords
  const getDomainTags = (paper: Paper): string[] => {
    const tags: string[] = [];
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
    
    return tags.slice(0, 2);
  };

  const domainTags = getDomainTags(paper);
  const authors = paper.authors?.slice(0, 3).join(', ') || 'Unknown authors';
  const hasMoreAuthors = paper.authors && paper.authors.length > 3;

  let displayStatus: string = paper.status;
  if (paper.status === 'Not Started' && paper.nonImplementableVotes > 0 && paper.implementabilityStatus === 'Voting') {
    displayStatus = 'Disputed';
  }

  return (
    <Link to={`/paper/${paper.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                  {paper.title}
                </h3>
                
                {/* Authors */}
                <div className="text-sm text-muted-foreground/80 mb-2">
                  {authors}
                  {hasMoreAuthors && <span className="ml-1">+{paper.authors!.length - 3} others</span>}
                </div>
              </div>

              {/* Vote Button */}
              <button
                onClick={handleVoteClick}
                disabled={isVoting}
                className="flex items-center gap-1 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <Heart 
                  className={`w-4 h-4 ${paper.currentUserVote === 'up' ? 'fill-current text-red-500' : ''}`} 
                />
                <span className="text-xs">{paper.upvoteCount || 0}</span>
              </button>
            </div>

            {/* Abstract */}
            {paper.abstract && (
              <p className="text-sm text-muted-foreground/70 line-clamp-2 leading-relaxed">
                {truncateAbstract(paper.abstract, 150)}
              </p>
            )}

            {/* Footer - Single Row with Tags, Date, and Status */}
            <div className="flex items-center justify-between pt-2">
              {/* Left group: Category tags */}
              <div className="flex items-center gap-2">
                {domainTags.map((tag, index) => (
                  <Badge key={index} className="text-xs px-2 py-0.5 h-5 bg-primary text-primary-foreground">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Right group: Date, proceeding, and status */}
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-muted-foreground/60">
                  {formatDate(paper.publicationDate)}
                </span>
                
                {paper.proceeding && (
                  <span className="text-xs text-muted-foreground/60 font-medium">
                    {paper.proceeding}
                  </span>
                )}
                
                <StatusBadge paper={paper} className="text-xs px-2 py-0.5 h-5" />
              </div>
            </div>

            {/* Vote Error */}
            {voteError && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {voteError}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ModernPaperCard;