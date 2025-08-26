import React from 'react';
import { Eye, FileText, Users, Calendar, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Paper } from '@/types/paper';

interface PaperCardProps {
  paper: Paper;
  onClick?: () => void;
  showStatus?: boolean;
  compact?: boolean;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  onClick,
  showStatus = false,
  compact = false,
}) => {
  const getStatusVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'published':
        return 'research-badge-success';
      case 'in progress':
      case 'voting':
        return 'research-badge-warning';
      case 'not started':
        return 'research-badge-muted';
      case 'rejected':
      case 'failed':
        return 'research-badge-destructive';
      default:
        return 'research-badge-muted';
    }
  };

  const getImplementabilityVariant = (isImplementable: boolean, status: string) => {
    if (status?.toLowerCase() === 'voting') {
      return 'research-badge-warning';
    }
    return isImplementable ? 'research-badge-success' : 'research-badge-destructive';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  if (compact) {
    return (
      <div
        className="research-card research-card-hover p-4 cursor-pointer"
        onClick={onClick}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm line-clamp-2 text-foreground min-w-0 flex-1">
              {paper.title}
            </h4>
            {showStatus && paper.status && (
              <span className={`research-badge ${getStatusVariant(paper.status)} shrink-0 ml-2`}>
                {paper.status}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground overflow-hidden">
            {paper.authors && paper.authors.length > 0 && (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {paper.authors.slice(0, 1).join(', ')}
                  {paper.authors.length > 1 && ` +${paper.authors.length - 1}`}
                </span>
              </div>
            )}
            
            {paper.upvoteCount !== undefined && (
              <div className="flex items-center gap-1 shrink-0">
                <Eye className="w-3 h-3" />
                <span>{paper.upvoteCount}</span>
              </div>
            )}

            {paper.implementabilityStatus && (
              <span className={`research-badge ${getImplementabilityVariant(paper.isImplementable, paper.implementabilityStatus)} shrink-0 text-xs`}>
                {paper.implementabilityStatus}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="research-card research-card-hover p-6 cursor-pointer"
      onClick={onClick}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2 min-w-0">
            <h3 className="font-semibold text-lg leading-tight text-foreground line-clamp-2">
              {paper.title}
            </h3>
            
            {paper.authors && paper.authors.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {paper.authors.slice(0, 2).join(', ')}
                  {paper.authors.length > 2 && ` and ${paper.authors.length - 2} others`}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            {paper.implementabilityStatus && (
              <span className={`research-badge ${getImplementabilityVariant(paper.isImplementable, paper.implementabilityStatus)}`}>
                {paper.implementabilityStatus}
              </span>
            )}
            {showStatus && paper.status && (
              <span className={`research-badge ${getStatusVariant(paper.status)}`}>
                {paper.status}
              </span>
            )}
          </div>
        </div>

        {/* Abstract */}
        {paper.abstract && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {paper.abstract}
          </p>
        )}

        {/* Voting Section */}
        {(paper.isImplementableVotes > 0 || paper.nonImplementableVotes > 0) && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-success">
                <span className="w-2 h-2 bg-success rounded-full"></span>
                <span>Implementable: {paper.isImplementableVotes}</span>
              </div>
              <div className="flex items-center gap-1 text-destructive">
                <span className="w-2 h-2 bg-destructive rounded-full"></span>
                <span>Not implementable: {paper.nonImplementableVotes}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {formatDate(paper.publicationDate) && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(paper.publicationDate)}</span>
              </div>
            )}
            
            {paper.arxivId && (
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[120px]">arXiv:{paper.arxivId}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {paper.upvoteCount !== undefined && (
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>{paper.upvoteCount} upvotes</span>
              </div>
            )}
            
            {(paper.urlAbs || paper.urlPdf) && (
              <ExternalLink className="w-3 h-3" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};