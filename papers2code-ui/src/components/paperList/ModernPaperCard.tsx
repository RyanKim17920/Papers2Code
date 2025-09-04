import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ExternalLink, Users, Calendar } from 'lucide-react';
import { Paper } from '../../common/types/paper';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { getStatusClass, getStatusSymbol } from '../../common/utils/statusUtils';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
      case 'Official Code Posted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Work in Progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Started':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Not Started':
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

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
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Link 
                to={`/paper/${paper.id}`} 
                className="block group"
              >
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                  {paper.title}
                </h3>
              </Link>
              
              {/* Authors */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                <Users className="w-3 h-3" />
                <span>
                  {authors}
                  {hasMoreAuthors && <span className="ml-1">+{paper.authors!.length - 3} others</span>}
                </span>
              </div>
            </div>

            {/* Vote Button */}
            <Button
              variant={paper.currentUserVote === 'up' ? 'default' : 'outline'}
              size="sm"
              onClick={handleVoteClick}
              disabled={isVoting}
              className="flex items-center gap-1 min-w-fit"
            >
              <Heart 
                className={`w-4 h-4 ${paper.currentUserVote === 'up' ? 'fill-current' : ''}`} 
              />
              <span className="text-xs">{paper.upvoteCount || 0}</span>
            </Button>
          </div>

          {/* Abstract */}
          {paper.abstract && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {truncateAbstract(paper.abstract)}
            </p>
          )}

          {/* Tags */}
          {domainTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {domainTags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(paper.publicationDate)}</span>
              </div>
              
              {paper.proceeding && (
                <span className="font-medium">{paper.proceeding}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(displayStatus)}>
                {displayStatus}
              </Badge>
              
              <Link to={`/paper/${paper.id}`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  View Details
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
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
  );
};

export default ModernPaperCard;