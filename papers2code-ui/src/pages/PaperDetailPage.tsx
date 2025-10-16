import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Rocket, Users, ExternalLink, FileText, Code, Vote, Settings, Github, CheckCircle2 } from 'lucide-react';

import { usePaperDetail } from '../common/hooks/usePaperDetail';
import { useActivityTracking } from '../common/hooks/useActivityTracking';
import type { ActiveTab as ActiveTabType, AdminSettableImplementabilityStatus } from '../common/hooks/usePaperDetail';
import type { UserProfile } from '../common/types/user';
import type { ImplementationProgress } from '../common/types/implementation';

import { LoadingSpinner } from '../common/components';
import ConfirmationModal from '../common/components/ConfirmationModal';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

import PaperMetadata from '../components/paperDetail/Tabs/Paper/PaperMetadata';

import PaperTabs from '../components/paperDetail/PaperTabs';
import ImplementabilityNotice from '../components/paperDetail/Tabs/ImplementationVoting/ImplementabilityNotice';

import { ImplementabilityVotingTab } from '../components/paperDetail/Tabs/ImplementationVoting/ImplementabilityVotingTab';
import { OwnerActions } from '../components/paperDetail/Tabs/Admin/OwnerActions';
import { ImplementationProgressTab } from '../components/paperDetail/Tabs/ImplementationProgress/ImplementationProgressTab';
import ImplementationProgressCard from '../components/paperDetail/ImplementationProgressCard';
import ErrorPage from './ErrorPage';

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

    return (
        <div className="min-h-screen bg-background">
            {/* Compact Header */}
            <div className="bg-card/40 backdrop-blur border-b border-border/60 sticky top-0 z-40">
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                    {/* Main Paper Content - 8 columns */}
                    <div className="lg:col-span-8">
                        <Card className="bg-card/70 backdrop-blur border border-border/60">
                            <CardContent className="p-3">
                                {/* Title & Metadata in Horizontal Layout */}
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                                        {paper.title}
                                    </h1>
                                    
                                    {/* Horizontal Metadata Layout */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <PaperMetadata 
                                            paper={paper}
                                            currentUser={currentUser}
                                            handleUpvote={handleUpvote}
                                            isVoting={isVoting}
                                            actionUsers={actionUsers}
                                            isLoadingActionUsers={isLoadingActionUsers}
                                            actionUsersError={actionUsersError}
                                        />
                                        <ImplementabilityNotice paper={paper} />
                                    </div>
                                </div>
                                
                                {/* Compact Community Implementation Bar (only if no official code) */}
                                {currentUser && paper && !hasOfficialCode && (
                                    <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded p-2 mt-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 rounded bg-primary/10 shrink-0">
                                                    {paper.implementationProgress ? <Users className="h-3 w-3 text-primary" /> : <Rocket className="h-3 w-3 text-primary" />}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-xs">Community Implementation:</span>
                                                    <span className="text-muted-foreground text-xs ml-1">
                                                        {paper.implementationProgress ? (
                                                            isCurrentUserContributor ? "You're contributing" : "Active effort"
                                                        ) : "Be the first!"}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-1">
                                                {paper.implementationProgress ? (
                                                    isCurrentUserContributor ? (
                                                        <Button variant="outline" size="sm" onClick={() => setActiveTab('implementationProgress')} className="gap-1 h-6 text-xs px-2">
                                                            <ExternalLink size={10} />
                                                            Progress
                                                        </Button>
                                                    ) : (
                                                        <Button variant="secondary" size="sm" onClick={handleInitiateImplementationEffort} disabled={isProcessingEffortAction} className="gap-1 h-6 text-xs px-2">
                                                            <Users size={10} />
                                                            Join
                                                        </Button>
                                                    )
                                                ) : (
                                                    <Button onClick={handleInitiateImplementationEffort} disabled={isProcessingEffortAction} size="sm" className="gap-1 h-6 text-xs px-2">
                                                        <Rocket size={10} />
                                                        Start
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {effortActionError && (
                                            <div className="text-destructive text-xs bg-destructive/5 p-1 rounded border border-destructive/20 mt-1">
                                                {effortActionError}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Abstract Section */}
                                <div className="border-t border-border/60 pt-2 mt-2">
                                    <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1">
                                        <FileText className="w-3 h-3 text-primary" />
                                        Abstract
                                    </h3>
                                    <p className="text-muted-foreground leading-relaxed text-xs">
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
                                <Card className="bg-card/70 backdrop-blur border border-border/60">
                                    <CardContent className="p-3">
                                        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                                            <Vote className="w-3 h-3 text-primary" />
                                            Implementability
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