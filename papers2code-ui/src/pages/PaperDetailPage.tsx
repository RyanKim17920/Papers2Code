import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Rocket, Users, ExternalLink, FileText, Code, Vote, Settings } from 'lucide-react';

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

interface PaperDetailPageProps {
    currentUser: UserProfile | null;
}

const PaperDetailPage: React.FC<PaperDetailPageProps> = ({ currentUser }) => {
    const { paperId } = useParams<{ paperId: string }>();
    const location = useLocation();
    const [showStartEffortConfirmModal, setShowStartEffortConfirmModal] = useState<boolean>(false); // New state for the modal

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
        updateImplementationProgress // Added from usePaperDetail hook (will be implemented next)
    } = usePaperDetail(paperId, currentUser);
    // Debug log removed for production
    const isAdminView = (currentUser?.isAdmin === true || currentUser?.isOwner == true);

    // Track paper view when component mounts or paper changes
    useEffect(() => {
        if (paperId && paper) {
            // Track paper view
            trackPaperView({ 
                paperId, 
                cameFrom: location.state?.from || 'direct' 
            });
        }
    }, [paperId, paper, trackPaperView, location.state]);

    const handleSetActiveTab = (tab: string) => {
        setActiveTab(tab as ActiveTabType);
    };

    // Modified to show confirmation modal first
    const handleInitiateImplementationEffort = () => {
        if (!paperId || !currentUser) {
            console.warn("Paper ID or user not available for initiating implementation effort.");
            // Consider using a more integrated notification system if available
            alert("You must be logged in to perform this action.");
            return;
        }
        setShowStartEffortConfirmModal(true); // Show the confirmation modal
    };

    const confirmAndStartEffort = async () => { // Make async
        if (!paperId || !currentUser) { // Add guard clause
            console.warn("Paper ID or user not available for initiating implementation effort.");
            alert("You must be logged in to perform this action.");
            setShowStartEffortConfirmModal(false); // Close modal on error too
            return;
        }
        try {
            await handleInitiateJoinImplementationEffort(); // Call the function from the hook
            // No need to manually set isCurrentUserContributor, it will be derived from refreshed paper data
        } finally {
            setShowStartEffortConfirmModal(false);    // Close modal regardless of success or failure of the call
            await loadPaperAndActions(); // Re-fetch paper data to update UI
        }
    };

    // New handler for implementation progress changes
    const handleImplementationProgressChange = async (updatedProgress: ImplementationProgress) => {
        if (!paperId) return;
        // Call the function from the hook to update local state and make API call
        // This function will be added to usePaperDetail hook
        await updateImplementationProgress(updatedProgress);
        // Optionally, refetch paper data or rely on optimistic update
        // loadPaperAndActions(); // Or a more specific refresh if available
    };
 
    if (isLoading) {
        return <LoadingSpinner />; 
    }
 
    if (error) {
        return <div className="error-message">Error loading paper: {error}</div>;
    }
 
    if (!paper) {
        return <div className="error-message">Paper not found or failed to load.</div>;
    }

    const isCurrentUserContributor = paper.implementationProgress?.contributors?.some(
        (contributorId) => contributorId === currentUser?.id
    );

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-card/40 backdrop-blur border-b border-border/60 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <Link 
                        to="/papers" 
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back to Papers
                    </Link>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="space-y-8">
                    {/* Error Message */}
                    {updateError && (
                        <Card className="border-destructive/20 bg-destructive/5">
                            <CardContent className="p-4">
                                <p className="text-destructive text-sm">{updateError}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Paper Header */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight mb-3">
                                {paper.title}
                            </h1>
                            <ImplementabilityNotice paper={paper} />
                        </div>
                    </div>

                    {/* Community Implementation Effort Section */}
                    {currentUser && paper && (
                        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        {paper.implementationProgress ? <Users className="h-5 w-5 text-primary" /> : <Rocket className="h-5 w-5 text-primary" />}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <h3 className="font-semibold text-lg">Community Implementation Progress</h3>
                                        
                                        {paper.implementationProgress ? (
                                            // Effort exists
                                            isCurrentUserContributor ? (
                                                <div className="space-y-3">
                                                    <p className="text-muted-foreground">
                                                        You are contributing to this paper's implementation.
                                                    </p>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => setActiveTab('implementationProgress')}
                                                        className="gap-2"
                                                    >
                                                        <ExternalLink size={14} />
                                                        View Progress
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <p className="text-muted-foreground">
                                                        A community effort to implement this paper is active or has been initiated.
                                                    </p>
                                                    <Button 
                                                        variant="secondary"
                                                        onClick={handleInitiateImplementationEffort} 
                                                        disabled={isProcessingEffortAction}
                                                        className="gap-2"
                                                    >
                                                        <Users size={14} />
                                                        View or Join Effort
                                                    </Button>
                                                </div>
                                            )
                                        ) : (
                                            // No effort exists yet
                                            <div className="space-y-3">
                                                <p className="text-muted-foreground">
                                                    Be the first to lead or join a community effort to implement this paper!
                                                </p>
                                                <Button 
                                                    onClick={handleInitiateImplementationEffort}
                                                    disabled={isProcessingEffortAction}
                                                    className="gap-2"
                                                >
                                                    <Rocket size={14} />
                                                    Start Implementation Effort
                                                </Button>
                                            </div>
                                        )}
                                        
                                        {effortActionError && (
                                            <div className="text-destructive text-sm bg-destructive/5 p-2 rounded border border-destructive/20">
                                                {effortActionError}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Main Content - Information Dense Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Main Paper Info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Paper Metadata & Abstract */}
                            <Card className="bg-card/70 backdrop-blur border border-border/60">
                                <CardContent className="p-6">
                                    <div className="space-y-6">
                                        <PaperMetadata 
                                            paper={paper}
                                            currentUser={currentUser}
                                            handleUpvote={handleUpvote}
                                            isVoting={isVoting}
                                            actionUsers={actionUsers}
                                            isLoadingActionUsers={isLoadingActionUsers}
                                            actionUsersError={actionUsersError}
                                        />
                                        <div className="border-t border-border/60 pt-6">
                                            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-primary" />
                                                Abstract
                                            </h3>
                                            <p className="text-muted-foreground leading-relaxed">
                                                {paper.abstract || 'Abstract not available.'}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column - Implementation Progress or Voting */}
                        <div className="space-y-6">
                            {paper.implementationProgress ? (
                                /* Implementation Progress Summary */
                                <ImplementationProgressCard 
                                    progress={paper.implementationProgress}
                                    paperId={paper.id}
                                    currentUser={currentUser}
                                    onImplementationProgressChange={handleImplementationProgressChange}
                                />
                            ) : (
                                /* Implementability Voting */
                                <Card className="bg-card/70 backdrop-blur border border-border/60">
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                            <Vote className="w-5 h-5 text-primary" />
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
                            )}

                            {/* Admin Actions */}
                            {isAdminView && (
                                <Card className="bg-card/70 backdrop-blur border border-border/60">
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                            <Settings className="w-5 h-5 text-primary" />
                                            Admin Actions
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
            </div>
 
            {/* New Confirmation Modal for Starting/Joining Effort */}
            {showStartEffortConfirmModal && (
                <ConfirmationModal
                    isOpen={showStartEffortConfirmModal}
                    onClose={() => setShowStartEffortConfirmModal(false)}
                    onConfirm={confirmAndStartEffort} // Use the new wrapper function
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