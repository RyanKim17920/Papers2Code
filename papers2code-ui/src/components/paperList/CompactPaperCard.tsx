import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, Calendar, Users } from 'lucide-react';
import { Paper } from '../../common/types/paper';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { getPaperDescription } from '@/common/utils/descriptionUtils';

interface CompactPaperCardProps {
  paper: Paper;
  onVote: (paperId: string, voteType: 'up' | 'none') => Promise<void>;
  className?: string;
}

const CompactPaperCard: React.FC<CompactPaperCardProps> = ({ paper, onVote, className = '' }) => {
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

  const getDomainTags = (paper: Paper): string[] => {
    const tags: string[] = [];
    const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
    
    if (text.includes('vision') || text.includes('image') || text.includes('visual')) {
      tags.push('CV');
    }
    if (text.includes('nlp') || text.includes('language') || text.includes('text')) {
      tags.push('NLP');
    }
    if (text.includes('learning') || text.includes('neural') || text.includes('network')) {
      tags.push('ML');
    }
    if (text.includes('transformer') || text.includes('attention')) {
      tags.push('Transformers');
    }
    
    return tags.slice(0, 2);
  };

  const domainTags = getDomainTags(paper);
  const authors = paper.authors?.slice(0, 2).join(', ') || 'Unknown authors';
  const hasMoreAuthors = paper.authors && paper.authors.length > 2;

  return (
    <Link to={`/paper/${paper.id}`} className="block h-full">
      <Card className={`hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-primary/20 hover:border-l-primary h-full ${className}`.trim()}>
        <CardContent className="p-4 h-full flex flex-col">
          {/* Header with Title and Vote */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-base font-semibold text-foreground line-clamp-2 flex-1">
              {paper.title}
            </h3>
            <button
              onClick={handleVoteClick}
              disabled={isVoting}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <ThumbsUp 
                className={`w-4 h-4 ${paper.currentUserVote === 'up' ? 'fill-current text-primary' : ''}`} 
              />
              <span className="text-xs font-medium">{paper.upvoteCount || 0}</span>
            </button>
          </div>

          {/* Authors */}
          <div className="flex items-center gap-1 mb-3 text-sm text-muted-foreground">
            <Users className="w-3 h-3" />
            <span className="truncate">
              {authors}
              {hasMoreAuthors && <span className="ml-1">+{paper.authors!.length - 2}</span>}
            </span>
          </div>

          {/* Abstract */}
          <p className="text-sm text-muted-foreground/80 line-clamp-3 leading-relaxed mb-4 flex-1">
            {getPaperDescription(paper, 120)}
          </p>

          {/* Footer */}
          <div className="space-y-2 mt-auto">
            {/* Tags */}
            {domainTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {domainTags.map((tag, index) => (
                  <Badge key={index} variant="default" className="text-xs px-2 py-0.5 h-5">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Meta info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(paper.publicationDate)}</span>
                {paper.proceeding && (
                  <>
                    <span>•</span>
                    <span className="font-medium">{paper.proceeding}</span>
                  </>
                )}
              </div>
              <StatusBadge paper={paper} className="text-xs px-2 py-0.5 h-5" />
            </div>
          </div>

          {/* Vote Error */}
          {voteError && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-2">
              {voteError}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default CompactPaperCard;