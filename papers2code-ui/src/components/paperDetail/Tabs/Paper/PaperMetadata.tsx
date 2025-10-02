import React, { useState } from 'react';
import { Paper } from '../../../../common/types/paper';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Heart, ExternalLink, Calendar, Users, FileText, Tag, ChevronDown, ChevronUp } from 'lucide-react';
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
    const [authorsExpanded, setAuthorsExpanded] = useState(false);
    
    // Determine if we should show the expand/collapse feature
    const authors = paper.authors || [];
    const MAX_AUTHORS_DISPLAYED = 5;
    const shouldShowExpandButton = authors.length > MAX_AUTHORS_DISPLAYED;
    const displayedAuthors = authorsExpanded ? authors : authors.slice(0, MAX_AUTHORS_DISPLAYED);
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
                        <div className="text-sm">
                            {displayedAuthors.length > 0 ? displayedAuthors.join(', ') : 'N/A'}
                            {shouldShowExpandButton && !authorsExpanded && (
                                <span className="text-muted-foreground">...</span>
                            )}
                        </div>
                        {shouldShowExpandButton && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAuthorsExpanded(!authorsExpanded)}
                                className="mt-1 h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                                {authorsExpanded ? (
                                    <>
                                        <ChevronUp className="h-3 w-3 mr-1" />
                                        Show less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="h-3 w-3 mr-1" />
                                        Show {authors.length - MAX_AUTHORS_DISPLAYED} more
                                    </>
                                )}
                            </Button>
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
                
                {paper.urlPdf && (
                    <Button variant="outline" size="sm" asChild className="justify-start gap-2">
                        <a href={paper.urlPdf} target="_blank" rel="noopener noreferrer">
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