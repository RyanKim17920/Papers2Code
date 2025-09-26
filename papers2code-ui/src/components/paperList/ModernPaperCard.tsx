import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, ExternalLink, FileDown, Code } from 'lucide-react';
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

  // Format authors for compact display
  const formatAuthors = (authors: string[] | undefined): string => {
    if (!authors || authors.length === 0) return 'Unknown authors';
    if (authors.length === 1) return authors[0];
    if (authors.length <= 3) return authors.join(', ');
    return `${authors[0]}, et al.`;
  };

    // Generate more descriptive domain tags
  const getDomainTags = (paper: Paper): string[] => {
    const tags: string[] = [];
    const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
    
    if (text.includes('vision') || text.includes('image') || text.includes('visual') || text.includes('computer vision')) {
      tags.push('CV');
    }
    if (text.includes('nlp') || text.includes('language') || text.includes('text') || text.includes('natural language')) {
      tags.push('NLP');
    }
    if (text.includes('learning') || text.includes('neural') || text.includes('network') || text.includes('machine learning')) {
      tags.push('ML');
    }
    if (text.includes('transformer') || text.includes('attention')) {
      tags.push('Transformers');
    }
    if (text.includes('generative') || text.includes('diffusion') || text.includes('gan')) {
      tags.push('Generative AI');
    }
    
    return tags.slice(0, 2);
  };

  const domainTags = getDomainTags(paper);
  const formattedAuthors = formatAuthors(paper.authors);

  return (
    <Link to={`/paper/${paper.id}`} className="block h-full group">
      <Card className={`hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col ${className}`.trim()}>
        <CardContent className="pt-4 pb-4 px-4 h-full flex flex-col">
          {/* Title - Responsive height */}
          <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight mb-2" style={{ minHeight: 'calc(1.2em * 2.2)' }}>
            {paper.title}
          </h3>
          
          {/* Authors • Venue • Date */}
          <div className="text-xs mb-2 flex-shrink-0">
            <span className="font-semibold text-foreground">{formattedAuthors}</span>
            {paper.proceeding && (
              <>
                <span className="mx-1 text-muted-foreground/60">·</span>
                <span className="font-medium text-primary/80">{paper.proceeding}</span>
              </>
            )}
            <span className="mx-1 text-muted-foreground/60">·</span>
            <span className="text-muted-foreground font-normal">{formatDate(paper.publicationDate)}</span>
          </div>

          {/* Abstract - Responsive height */}
          <div className="text-sm text-foreground/75 leading-relaxed line-clamp-2 mb-4 flex-1 font-normal" style={{ minHeight: 'calc(1.4em * 2.2)' }}>
            {getPaperDescription(paper, 140)}
          </div>

          {/* Footer: Domain Tags + Status + Actions - Fixed at bottom */}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-2">
              {/* Domain Tags */}
              {domainTags.map((tag, index) => (
                <Badge key={index} variant="default" className="text-xs px-2 py-0.5 h-5 font-medium">
                  {tag}
                </Badge>
              ))}
              
              {/* Status Badge */}
              <StatusBadge paper={paper} className="text-xs px-2 py-1 h-6" />
            </div>
            
            <div className="flex items-center gap-1">
              {/* Code Button */}
              <button
                onClick={(e) => e.preventDefault()}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="View Code"
              >
                <Code className="w-4 h-4" />
              </button>
              
              {/* PDF Button */}
              <button
                onClick={(e) => e.preventDefault()}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Download PDF"
              >
                <FileDown className="w-4 h-4" />
              </button>
              
              {/* Like Button */}
              <button
                onClick={handleVoteClick}
                disabled={isVoting}
                className="flex items-center gap-1 p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Save to Library"
              >
                <ThumbsUp 
                  className={`w-4 h-4 ${paper.currentUserVote === 'up' ? 'fill-current text-primary' : ''}`} 
                />
                <span className="text-xs font-medium">{paper.upvoteCount || 0}</span>
              </button>
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

export default ModernPaperCard;