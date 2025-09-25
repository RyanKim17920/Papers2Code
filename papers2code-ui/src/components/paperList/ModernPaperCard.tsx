import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, ExternalLink, Users, Calendar } from 'lucide-react';
import { Paper } from '../../common/types/paper';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { getStatusClass } from '../../common/utils/statusUtils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { getPaperDescription } from '@/common/utils/descriptionUtils';

interface ModernPaperCardProps {
  paper: Paper;
  onVote: (paperId: string, voteType: 'up' | 'none') => Promise<void>;
  className?: string; // allow external styling overrides
}

const ModernPaperCard: React.FC<ModernPaperCardProps> = ({ paper, onVote, className = '' }) => {
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

  // Replaced local truncate with shared getPaperDescription utility.

  // Removed local color mapping in favor of unified StatusBadge component.

  // Generate domain tags based on title/abstract keywords
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
  const authors = paper.authors?.slice(0, 3).join(', ') || 'Unknown authors';
  const hasMoreAuthors = paper.authors && paper.authors.length > 3;

  let displayStatus: string = paper.status;
  if (paper.status === 'Not Started' && paper.nonImplementableVotes > 0 && paper.implementabilityStatus === 'Voting') {
    displayStatus = 'Disputed';
  }

  return (
    <Link to={`/paper/${paper.id}`} className="block h-full group">
      <Card className={`hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col ${className}`.trim()}>
        <CardContent className="pt-5 pb-4 px-5 flex flex-col flex-1">
          <div className="space-y-3 flex-1">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2 leading-snug">
                  {paper.title}
                </h3>
                
                {/* Authors */}
                <div
                  className="text-sm font-medium text-muted-foreground mb-2 line-clamp-1"
                  title={paper.authors?.join(', ')}
                >
                  {authors}
                  {hasMoreAuthors && <span className="ml-1 font-normal">+{paper.authors!.length - 3} others</span>}
                </div>
              </div>

              {/* Vote Button */}
              <button
                onClick={handleVoteClick}
                disabled={isVoting}
                className="flex items-center gap-1 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ThumbsUp 
                  className={`w-4 h-4 ${paper.currentUserVote === 'up' ? 'fill-current text-primary' : ''}`} 
                />
                <span className="text-xs">{paper.upvoteCount || 0}</span>
              </button>
            </div>

            {/* Abstract */}
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.75rem]">
              {getPaperDescription(paper, 150)}
            </p>

            {/* Meta & Footer */}
            <div className="mt-auto pt-3">
              <div className="h-px bg-border/60 mb-3" />
              <div className="flex items-center justify-between gap-3">
                {/* Left: Domain tags */}
                <div className="flex items-center gap-2 min-w-0">
                  {domainTags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Right: Proceeding • Date • Status */}
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  {paper.proceeding && (
                    <Badge variant="outline" className="h-5 px-2 font-medium">
                      {paper.proceeding}
                    </Badge>
                  )}
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(paper.publicationDate)}
                  </span>
                  <StatusBadge paper={paper} className="text-xs px-2 py-0.5 h-5 font-medium" />
                </div>
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