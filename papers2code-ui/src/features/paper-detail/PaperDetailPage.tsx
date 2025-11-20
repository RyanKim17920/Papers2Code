import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Rocket, Users, ExternalLink, FileText, Code, Vote, Settings, Github, CheckCircle2, ThumbsUp } from 'lucide-react';

import { usePaperDetail } from '@/shared/hooks/usePaperDetail';
import { useActivityTracking } from '@/shared/hooks/useActivityTracking';
import type { ActiveTab as ActiveTabType, AdminSettableImplementabilityStatus } from '@/shared/hooks/usePaperDetail';
import type { UserProfile } from '@/shared/types/user';
import type { ImplementationProgress } from '@/shared/types/implementation';

import { LoadingSpinner } from '@/shared/components';
import { SEO, generatePaperStructuredData, injectStructuredData } from '@/shared/components/SEO';
import ConfirmationModal from '@/shared/components/ConfirmationModal';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';

import PaperMetadata from '@/features/paper-detail/Tabs/Paper/PaperMetadata';

import PaperTabs from '@/features/paper-detail/PaperTabs';
import ImplementabilityNotice from '@/features/paper-detail/Tabs/ImplementationVoting/ImplementabilityNotice';

import { ImplementabilityVotingTab } from '@/features/paper-detail/Tabs/ImplementationVoting/ImplementabilityVotingTab';
import { OwnerActions } from '@/features/paper-detail/Tabs/Admin/OwnerActions';
import { ImplementationProgressTab } from '@/features/paper-detail/Tabs/ImplementationProgress/ImplementationProgressTab';
import ImplementationProgressCard from '@/features/paper-detail/ImplementationProgressCard';
import ErrorPage from '@/features/auth/ErrorPage';

interface PaperDetailPageProps {
    currentUser: UserProfile | null;
}

const PaperDetailPage: React.FC<PaperDetailPageProps> = ({ currentUser }) => {
    const { paperId } = useParams<{ paperId: string }>();
    const location = useLocation();
    const [showStartEffortConfirmModal, setShowStartEffortConfirmModal] = useState<boolean>(false);

    // Activity tracking
    const { trackPaperView } = useActivityTracking();

    const {
        paper,
        isLoading,
        error,
        updateError,
        activeTab,
        setActiveTab, 
        handleUpvote,
        handleImplementabilityVote,
        handleSetImplementabilityStatus,
        handleRemovePaper,
        showConfirmRemoveModal,
        setShowConfirmRemoveModal,
        showConfirmStatusModal,
        setShowConfirmStatusModal,
        openConfirmStatusModal,
        isRemoving,
        isUpdatingStatus,
        isVoting,
        actionUsers,
        isLoadingActionUsers,
        actionUsersError,
        loadPaperAndActions, 
        handleInitiateJoinImplementationEffort, 
        isProcessingEffortAction,          
        effortActionError,
        updateImplementationProgress
    } = usePaperDetail(paperId, currentUser);

    const isAdminView = (currentUser?.isAdmin === true || currentUser?.isOwner == true);
    
    // Check if official code is posted (use status as primary indicator)
    const hasOfficialCode = paper?.status === 'Official Code Posted' || paper?.hasCode === true;

    // Track paper view when component mounts or paper changes
    useEffect(() => {
        if (paperId && paper) {
            trackPaperView({ 
                paperId, 
                cameFrom: location.state?.from || 'direct' 
            });
        }
    }, [paperId, paper, trackPaperView, location.state]);

    // Generate SEO metadata and structured data
    useEffect(() => {
        if (paper) {
            const structuredData = generatePaperStructuredData(paper);
            injectStructuredData(structuredData);
        }
    }, [paper]);

    const handleSetActiveTab = (tab: string) => {
        setActiveTab(tab as ActiveTabType);
    };

    const handleInitiateImplementationEffort = () => {
        if (!paperId || !currentUser) {
            console.warn("Paper ID or user not available for initiating implementation effort.");
            alert("You must be logged in to perform this action.");
            return;
        }
        setShowStartEffortConfirmModal(true);
    };

    const confirmAndStartEffort = async () => {
        if (!paperId || !currentUser) {
            console.warn("Paper ID or user not available for initiating implementation effort.");
            alert("You must be logged in to perform this action.");
            setShowStartEffortConfirmModal(false);
            return;
        }
        try {
            await handleInitiateJoinImplementationEffort();
        } finally {
            setShowStartEffortConfirmModal(false);
            await loadPaperAndActions();
        }
    };

    const handleImplementationProgressChange = async (updatedProgress: ImplementationProgress) => {
        if (!paperId) return;
        await updateImplementationProgress(updatedProgress);
    };
 
    if (isLoading) {
        return <LoadingSpinner />; 
    }
 
    if (error) {
        return (
            <ErrorPage
                title="Error loading paper"
                message={error}
                showBackButton={true}
                showHomeButton={true}
                showBrowsePapersButton={true}
                showRefreshButton={true}
            />
        );
    }
 
    if (!paper) {
        return (
            <ErrorPage
                errorCode="404"
                title="Paper not found"
                message="The paper you're looking for doesn't exist or failed to load."
                showBackButton={true}
                showHomeButton={true}
                showBrowsePapersButton={true}
                showRefreshButton={false}
            />
        );
    }

    const isCurrentUserContributor = paper.implementationProgress?.contributors?.some(
        (contributorId) => contributorId === currentUser?.id
    );

    // Prepare SEO data
    const paperAuthors = paper.authors?.filter(Boolean).join(', ') || 'Unknown authors';
    const truncatedAbstract = paper.abstract 
        ? paper.abstract.length > 160 
            ? paper.abstract.substring(0, 157) + '...'
            : paper.abstract
        : `Research paper on ${paper.title}`;
    
    const paperKeywords = [
        ...(paper.tasks || []),
        'machine learning',
        'AI research',
        'research paper',
        'code implementation',
        ...(paper.authors?.slice(0, 3) || [])
    ].join(', ');

    return (
        <div className="min-h-screen bg-background">
            {/* Dynamic SEO for this paper */}
            <SEO
                title={paper.title || 'Research Paper'}
                description={truncatedAbstract}
                keywords={paperKeywords}
                url={`https://papers2code.com/paper/${paper.id}`}
                type="article"
                author={paperAuthors}
                publishedTime={paper.publicationDate}
            />
            
            {/* Compact Header - Reduced z-index to allow tooltips to appear above */}
            <div className="bg-card/40 backdrop-blur border-b border-border/60 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-2">
                    <Link 
                        to="/papers" 
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                        <ArrowLeft size={14} />
                        Back to Papers
                    </Link>
                </div>
            </div>

            {/* Ultra Dense Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-2">
                {/* Error Message */}
                {updateError && (
                    <Card className="border-destructive/20 bg-destructive/5 mb-2">
                        <CardContent className="p-2">
                            <p className="text-destructive text-xs">{updateError}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Ultra Compact Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    {/* Main Paper Content - 8 columns */}
                    <div className="lg:col-span-8">
                        <Card className="bg-card/70 backdrop-blur border border-border/60">
                            <CardContent className="p-4 sm:p-5">
                                {/* Title & Metadata in Horizontal Layout */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight flex-1">
                                            {paper.title}
                                        </h1>
                                        {/* Upvote moved to top right */}
                                        {currentUser ? (
                                            <Button
                                                variant={paper.currentUserVote === 'up' ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handleUpvote(paper.currentUserVote === 'up' ? 'none' : 'up')}
                                                disabled={isVoting}
                                                className="gap-1.5 h-8 px-3 shrink-0"
                                            >
                                                <ThumbsUp className={`w-4 h-4 ${paper.currentUserVote === 'up' ? 'fill-current' : ''}`} />
                                                <span className="text-sm font-semibold">{paper.upvoteCount || 0}</span>
                                            </Button>
                                        ) : (
                                            <Badge variant="secondary" className="gap-1.5 h-8 px-3">
                                                <ThumbsUp className="w-4 h-4" />
                                                <span className="text-sm font-semibold">{paper.upvoteCount || 0}</span>
                                            </Badge>
                                        )}
                                    </div>
                                    
                                    {/* Horizontal Metadata Layout - without upvote */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                                <span className="font-medium text-foreground text-sm">{paper.authors?.slice(0, 3).join(', ') || 'Unknown'}{paper.authors && paper.authors.length > 3 && ', et al.'}</span>
                                            </div>
                                            {paper.proceeding && (
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                    <span className="font-semibold text-primary text-sm">{paper.proceeding}</span>
                                                </div>
                                            )}
                                            {paper.publicationDate && (
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                                                        <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                                                        <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                                                        <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                    <span className="text-foreground text-sm">{new Date(paper.publicationDate).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                        <ImplementabilityNotice paper={paper} />
                                    </div>
                                    
                                    {/* Tags and Links Section */}
                                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border/40">
                                        {/* Tags */}
                                        {paper.tasks && paper.tasks.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {paper.tasks.slice(0, 5).map((tag, index) => (
                                                    <Badge key={index} variant="secondary" className="text-xs px-2.5 py-1 bg-primary/10 text-primary border-primary/20">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Links */}
                                        <div className="flex items-center gap-2 ml-auto">
                                            {paper.urlPdf && (
                                                <a
                                                    href={paper.urlPdf}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/60 bg-card/60 hover:bg-accent/50 text-sm font-medium text-foreground hover:border-primary/40 transition-all shadow-sm"
                                                >
                                                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    PDF
                                                </a>
                                            )}
                                            {paper.urlAbs && (
                                                <a
                                                    href={paper.urlAbs}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/60 bg-card/60 hover:bg-accent/50 text-sm font-medium text-foreground hover:border-primary/40 transition-all shadow-sm"
                                                >
                                                    <ExternalLink className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                    Abstract
                                                </a>
                                            )}
                                            {paper.arxivId && (
                                                <a
                                                    href={`https://arxiv.org/abs/${paper.arxivId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/60 bg-card/60 hover:bg-accent/50 text-sm font-medium text-foreground hover:border-primary/40 transition-all shadow-sm"
                                                >
                                                    <Code className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                                    arXiv
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Compact Community Implementation Bar (only if no official code) */}
                                {currentUser && paper && !hasOfficialCode && !paper.implementationProgress && (
                                    <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded p-2 mt-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 rounded bg-primary/10 shrink-0">
                                                    <Rocket className="h-3 w-3 text-primary" />
                                                </div>
                                                <div>
                                                    <span className="font-medium text-xs">Community Implementation:</span>
                                                    <span className="text-muted-foreground text-xs ml-1">Be the first!</span>
                                                </div>
                                            </div>
                                            
                                            <Button onClick={handleInitiateImplementationEffort} disabled={isProcessingEffortAction} size="sm" className="gap-1 h-6 text-xs px-2">
                                                <Rocket size={10} />
                                                Start
                                            </Button>
                                        </div>
                                        
                                        {effortActionError && (
                                            <div className="text-destructive text-xs bg-destructive/5 p-1 rounded border border-destructive/20 mt-1">
                                                {effortActionError}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Abstract Section */}
                                <div className="border-t border-border/60 pt-3 mt-3">
                                    <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-primary" />
                                        Abstract
                                    </h3>
                                    <p className="text-foreground leading-relaxed text-sm">
                                        {paper.abstract || 'Abstract not available.'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Sidebar - 4 columns */}
                    <div className="lg:col-span-4 flex flex-col gap-2">
                        {/* Official Code Link (if available) */}
                        {hasOfficialCode && (
                            <Card className="bg-card/70 backdrop-blur border border-emerald-500/40 shadow-sm">
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-md bg-emerald-500/10">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-foreground">
                                            Official Implementation
                                        </h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                        Authors have released official code for this paper.
                                    </p>
                                    {paper.urlGithub ? (
                                        <a
                                            href={paper.urlGithub}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border/60 bg-background/60 hover:bg-accent/50 hover:border-emerald-500/40 transition-all duration-200 text-sm font-medium shadow-sm"
                                        >
                                            <Github className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                                            <span className="text-foreground">View Repository</span>
                                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                                        </a>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/40">
                                            <Code className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">Link pending</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                        
                        {/* Implementation Progress or Voting (only if no official code) */}
                        {!hasOfficialCode && (
                            paper.implementationProgress ? (
                                <ImplementationProgressCard 
                                    progress={paper.implementationProgress}
                                    paperId={paper.id}
                                    paperStatus={paper.status}
                                    currentUser={currentUser}
                                    onImplementationProgressChange={handleImplementationProgressChange}
                                    onRefreshPaper={loadPaperAndActions}
                                />
                            ) : (
                                <Card className="bg-card/70 backdrop-blur border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                                <Vote className="w-5 h-5 text-primary" />
                                            </div>
                                            <span>Paper Implementability</span>
                                        </h3>
                                        <ImplementabilityVotingTab
                                            paper={paper}
                                            currentUser={currentUser}
                                            isVoting={isVoting}
                                            handleImplementabilityVote={handleImplementabilityVote}
                                            actionUsers={actionUsers}
                                            isLoadingActionUsers={isLoadingActionUsers}
                                            actionUsersError={actionUsersError}
                                        />
                                    </CardContent>
                                </Card>
                            )
                        )}

                        {/* Admin Actions */}
                        {isAdminView && (
                            <Card className="bg-card/70 backdrop-blur border border-border/60">
                                <CardContent className="p-3">
                                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                                        <Settings className="w-3 h-3 text-primary" />
                                        Admin
                                    </h3>
                                    <OwnerActions
                                        paper={paper}
                                        currentUser={currentUser}
                                        onPaperUpdate={loadPaperAndActions}
                                        openConfirmStatusModal={openConfirmStatusModal as (status: AdminSettableImplementabilityStatus) => void}
                                        onRequestRemoveConfirmation={() => setShowConfirmRemoveModal(true)}
                                        isUpdatingStatus={isUpdatingStatus}
                                        isRemoving={isRemoving}
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
 
            {/* New Confirmation Modal for Starting/Joining Effort */}
            {showStartEffortConfirmModal && (
                <ConfirmationModal
                    isOpen={showStartEffortConfirmModal}
                    onClose={() => setShowStartEffortConfirmModal(false)}
                    onConfirm={confirmAndStartEffort}
                    title="Confirm Start Implementation Effort"
                    confirmText="Yes, Start Effort"
                    confirmButtonClass="btn-primary"
                    isConfirming={isProcessingEffortAction} 
                >
                    <p>Starting an implementation effort indicates this paper is considered implementable, you will work on it, and community implementability voting will be superseded.</p>
                    <p>Do you want to proceed?</p>
                </ConfirmationModal>
            )}

            <ConfirmationModal
                isOpen={showConfirmRemoveModal}
                onClose={() => setShowConfirmRemoveModal(false)}
                onConfirm={handleRemovePaper}
                title="Confirm Paper Removal"
                confirmText="Yes, Remove Paper"
                confirmButtonClass="button-danger"
                isConfirming={isRemoving}
            >
                <p>Are you sure you want to permanently remove this paper?</p>
                <p><strong>Title:</strong> {paper.title}</p>
                <p>This action cannot be undone.</p>
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={showConfirmStatusModal.show}
                onClose={() => setShowConfirmStatusModal({ show: false, status: null })}
                onConfirm={() => showConfirmStatusModal.status && handleSetImplementabilityStatus(showConfirmStatusModal.status as AdminSettableImplementabilityStatus)}
                title={`Confirm Status: ${
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Implementable' ? 'Implementable' :
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Not Implementable' ? 'Not-Implementable' :
                    'Revert to Voting'
                }`}
                confirmText={`Yes, ${
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Implementable' ? 'Confirm Implementable' :
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Not Implementable' ? 'Confirm Not-Implementable' :
                    'Revert to Voting'
                }`}
                confirmButtonClass={
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Implementable' ? 'button-secondary' :
                    (showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Not Implementable' ? 'button-warning' :
                    'button-secondary'
                }
                isConfirming={isUpdatingStatus}
            >
                {(showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Implementable' && (
                    <p>Are you sure you want to set the status to <strong>Confirmed Implementable</strong>? Community voting will be disabled.</p>
                )}
                {(showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Admin Not Implementable' && (
                    <p>Are you sure you want to set the status to <strong>Confirmed Not-Implementable</strong>? Community voting will be disabled.</p>
                )}
                {(showConfirmStatusModal.status as AdminSettableImplementabilityStatus) === 'Voting' && (
                    <p>Are you sure you want to revert to <strong>community voting</strong>? Community voting will be re-enabled.</p>
                )}
            </ConfirmationModal>
        </div>
    );
};

export default PaperDetailPage;