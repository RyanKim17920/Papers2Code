import React from 'react';
import { Paper } from '../../../../common/types/paper';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Heart, Github, ExternalLink, Calendar, Users, FileText, Tag } from 'lucide-react';
import { UpvotersPopover } from '../../UpvotersModal';
import type { PaperActionUsers } from '../../../../common/services/api';
import type { UserProfile } from '../../../../common/types/user';
interface PaperMetadataProps {
    paper: Paper;
    currentUser: UserProfile | null;
    handleUpvote: (voteType: 'up' | 'none') => void;
    isVoting: boolean;
    actionUsers: PaperActionUsers | null;
    isLoadingActionUsers: boolean;
    actionUsersError: string | null;
}

const PaperMetadata: React.FC<PaperMetadataProps> = ({ 
    paper, 
    currentUser, 
    handleUpvote, 
    isVoting, 
    actionUsers, 
    isLoadingActionUsers, 
    actionUsersError 
}) => {
    const [authorsExpanded, setAuthorsExpanded] = React.useState(false);

    // Compute an inferred PDF link when urlPdf is not available.
    // Priority: explicit urlPdf > derive from urlAbs if it looks like an arXiv abs link > derive from arxivId
    const inferPdfFromAbs = (absUrl: string | undefined): string | null => {
        if (!absUrl) return null;
        try {
            const lower = absUrl.toLowerCase();
            // arXiv usual abstract links contain '/abs/' or 'arxiv.org/abs/'
            if (lower.includes('arxiv.org/abs')) {
                return absUrl.replace('/abs/', '/pdf/') + '.pdf'.replace('//pdf/.pdf', '/pdf');
            }
            // Some providers link directly to arXiv via query or other forms; try a simple heuristic
            const m = absUrl.match(/arxiv\.org\/(abs|pdf)\/(.+)$/i);
            if (m && m[2]) {
                return `https://arxiv.org/pdf/${m[2]}.pdf`;
            }
        } catch (e) {
            // fallback to null
        }
        return null;
    };

    const inferredPdf: string | null = React.useMemo(() => {
        if (paper.urlPdf) return paper.urlPdf;
        // prefer deriving from urlAbs
        const fromAbs = inferPdfFromAbs(paper.urlAbs || undefined);
        if (fromAbs) return fromAbs;
        // otherwise, use arxivId if available
        if (paper.arxivId) {
            // some arXiv ids may contain version like 2101.00001v2 -> strip the vX
            const id = String(paper.arxivId).replace(/v\d+$/i, '');
            return `https://arxiv.org/pdf/${id}.pdf`;
        }
        return null;
    }, [paper.urlPdf, paper.urlAbs, paper.arxivId]);

    return (
        <div className="space-y-6">
            {/* Header Section with Upvotes */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <StatusBadge paper={paper} />
                        {paper.tasks && paper.tasks.length > 0 && (
                            <div className="flex gap-1">
                                {paper.tasks.slice(0, 3).map((task, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                        <Tag className="h-3 w-3 mr-1" />
                                        {task}
                                    </Badge>
                                ))}
                                {paper.tasks.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                        +{paper.tasks.length - 3} more
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Upvote Section */}
                <div className="flex items-center gap-2">
                    {currentUser ? (
                        <Button
                            variant={paper.currentUserVote === 'up' ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleUpvote(paper.currentUserVote === 'up' ? 'none' : 'up')}
                            disabled={isVoting}
                            className="gap-2"
                        >
                            <Heart className={`h-4 w-4 ${paper.currentUserVote === 'up' ? 'fill-current' : ''}`} />
                            {paper.upvoteCount}
                        </Button>
                    ) : (
                        <Badge variant="secondary" className="gap-2">
                            <Heart className="h-4 w-4" />
                            {paper.upvoteCount}
                        </Badge>
                    )}
                    
                    {paper.upvoteCount > 0 && (
                        <UpvotersPopover
                            actionUsers={actionUsers}
                            isLoading={isLoadingActionUsers}
                            error={actionUsersError}
                            upvoteCount={paper.upvoteCount}
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <Users className="h-4 w-4 mr-1" />
                                View
                            </Button>
                        </UpvotersPopover>
                    )}
                </div>
            </div>

            {/* Authors Section */}
            <div className="space-y-3">
                <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-muted-foreground">Authors</div>
                        {paper.authors && paper.authors.length > 0 ? (
                            <div className="text-sm">
                                {(() => {
                                    const authorsList = paper.authors.join(', ');
                                    const MAX_LENGTH = 150; // characters before truncation
                                    
                                    if (authorsList.length <= MAX_LENGTH) {
                                        return authorsList;
                                    }
                                    
                                    if (authorsExpanded) {
                                        return (
                                            <>
                                                {authorsList}
                                                <button
                                                    onClick={() => setAuthorsExpanded(false)}
                                                    className="ml-2 text-primary hover:underline focus:outline-none"
                                                >
                                                    show less
                                                </button>
                                            </>
                                        );
                                    }
                                    
                                    return (
                                        <>
                                            {authorsList.slice(0, MAX_LENGTH)}...
                                            <button
                                                onClick={() => setAuthorsExpanded(true)}
                                                className="ml-2 text-primary hover:underline focus:outline-none"
                                            >
                                                show more
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="text-sm">N/A</div>
                        )}
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                        <div className="text-sm font-medium text-muted-foreground">Publication</div>
                        <div className="text-sm">
                            {paper.publicationDate ? new Date(paper.publicationDate).toLocaleDateString() : 'N/A'}
                            {paper.proceeding && <span className="text-muted-foreground ml-2">• {paper.proceeding}</span>}
                        </div>
                    </div>
                </div>

                {paper.arxivId && (
                    <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div>
                            <div className="text-sm font-medium text-muted-foreground">ArXiv ID</div>
                            <div className="text-sm">{paper.arxivId}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Links Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {paper.urlAbs && (
                    <Button variant="outline" size="sm" asChild className="justify-start gap-2">
                        <a href={paper.urlAbs} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            Abstract
                        </a>
                    </Button>
                )}
                
                {(paper.urlPdf || inferredPdf) && (
                    <Button variant="outline" size="sm" asChild className="justify-start gap-2">
                        <a href={paper.urlPdf || inferredPdf || '#'} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4" />
                            PDF
                        </a>
                    </Button>
                )}
            </div>
        </div>
    );
};

export default PaperMetadata;