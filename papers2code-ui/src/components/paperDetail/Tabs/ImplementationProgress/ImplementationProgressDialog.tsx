import React, { useEffect, useState } from 'react';
import { ImplementationProgress, ProgressStatus, UpdateEventType } from '../../../../common/types/implementation';
import type { UserProfile } from '../../../../common/types/user';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../ui/dialog';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { HorizontalTimeline } from './HorizontalTimeline';
import { GitBranch, Users, Mail, ExternalLink, Clock, CheckCircle, MessageCircle, Code } from 'lucide-react';
import { getStatusColorClasses } from '../../../../common/utils/statusUtils';
import { useContributorProfiles } from '../../../../common/hooks/useContributorProfiles';
import { UserDisplayList } from '../../UserDisplayList';
import Modal from '../../../../common/components/Modal';
import { updateImplementationProgressInApi } from '../../../../common/services/api';
import ConfirmationModal from '../../../../common/components/ConfirmationModal';

interface ImplementationProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  progress: ImplementationProgress;
  paperId: string;
  paperStatus: string;
  currentUser: UserProfile | null;
  onImplementationProgressChange: (updatedProgress: ImplementationProgress) => void;
  onRefreshPaper: () => Promise<void>;
  onSendEmail: () => Promise<void>;
  isSendingEmail: boolean;
}

export const ImplementationProgressDialog: React.FC<ImplementationProgressDialogProps> = ({
  isOpen,
  onClose,
  progress,
  paperId,
  paperStatus,
  currentUser,
  onImplementationProgressChange,
  onRefreshPaper,
  onSendEmail,
  isSendingEmail
}) => {
  const [showContributorsModal, setShowContributorsModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);

  // Handle Dialog close - prevent closing if any modal is open
  const handleDialogOpenChange = (open: boolean) => {
    // If trying to close the dialog (open = false), check if any modal is open
    if (!open && (showContributorsModal || showResponseModal || showConfirmModal)) {
      // Don't close the dialog if a modal is open
      return;
    }
    // Otherwise, allow the dialog to close
    onClose();
  };

  // Permission helpers
  const isLoggedIn = !!currentUser;
  const isContributor = isLoggedIn && progress.contributors.includes(currentUser!.id);
  const isInitiator = isLoggedIn && progress.initiatedBy === currentUser!.id;
  const hasEmailBeenSent = progress.updates.some(u => u.eventType === UpdateEventType.EMAIL_SENT);
  const canModifyPostSentStatus = isLoggedIn && hasEmailBeenSent && (isInitiator || isContributor);
  const canMarkAsSent = isLoggedIn && isContributor && !hasEmailBeenSent;
  
  // Determine what actions are available based on current status
  const canProgressRefactoring = isLoggedIn && isContributor && (
    progress.status === ProgressStatus.CODE_NEEDS_REFACTORING ||
    progress.status === ProgressStatus.REFACTORING_STARTED ||
    progress.status === ProgressStatus.REFACTORING_FINISHED ||
    progress.status === ProgressStatus.VALIDATION_IN_PROGRESS
  );
  
  const canProgressCommunity = isLoggedIn && isContributor && (
    progress.status === ProgressStatus.REFUSED_TO_UPLOAD ||
    progress.status === ProgressStatus.NO_RESPONSE ||
    progress.status === ProgressStatus.GITHUB_CREATED ||
    progress.status === ProgressStatus.CODE_STARTED
  );
  
  const needsGithubRepo = !progress.githubRepoId && (
    progress.status === ProgressStatus.CODE_NEEDS_REFACTORING ||
    progress.status === ProgressStatus.REFUSED_TO_UPLOAD ||
    progress.status === ProgressStatus.NO_RESPONSE ||
    progress.status === ProgressStatus.GITHUB_CREATED
  );

  // Fetch contributors
  const { contributorUsers, isLoading: isLoadingContributors } = useContributorProfiles({
    contributorIds: progress.contributors,
    enabled: isOpen
  });

  // GitHub helpers
  const getGithubUrl = (repoId: string): string => {
    if (repoId.startsWith('http://') || repoId.startsWith('https://')) {
      return repoId;
    }
    return `https://github.com/${repoId}`;
  };

  const handleStatusUpdate = async (newStatus: ProgressStatus) => {
    if (newStatus === ProgressStatus.RESPONSE_RECEIVED) {
      setShowResponseModal(true);
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmStatusUpdate = async (status: ProgressStatus) => {
    try {
      setIsUpdating(true);
      const updatedProgress = await updateImplementationProgressInApi(paperId, { status });
      await onImplementationProgressChange(updatedProgress);
      setShowConfirmModal(false);
      setShowResponseModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getWIPStatus = () => {
    if (progress.status === ProgressStatus.CODE_UPLOADED || progress.status === ProgressStatus.OFFICIAL_CODE_POSTED) {
      return { label: 'Completed', variant: 'default' as const };
    }
    return { label: paperStatus, variant: 'outline' as const };
  };

  const wipStatus = getWIPStatus();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="flex-1">
                <DialogTitle className="text-2xl mb-2">Implementation Progress</DialogTitle>
                <p className="text-sm text-muted-foreground">Track the journey from paper to code</p>
              </div>
              <Badge variant={wipStatus.variant} className={`${getStatusColorClasses(wipStatus.label)} whitespace-nowrap`}>
                {wipStatus.label}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Status Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  {/* Contributors */}
                  <button
                    onClick={() => setShowContributorsModal(true)}
                    className="flex items-center gap-3 hover:bg-accent rounded-lg p-3 transition-colors"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-2xl font-bold">{progress.contributors.length}</div>
                      <div className="text-xs text-muted-foreground">
                        {progress.contributors.length === 1 ? 'Contributor' : 'Contributors'}
                      </div>
                    </div>
                  </button>

                  {/* GitHub Repository */}
                  {progress.githubRepoId && (
                    <a
                      href={getGithubUrl(progress.githubRepoId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 hover:bg-accent rounded-lg p-3 transition-colors"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                        <GitBranch className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium flex items-center gap-1">
                          View Repository <ExternalLink className="w-3 h-3" />
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {progress.githubRepoId}
                        </div>
                      </div>
                    </a>
                  )}

                  {/* Send Email Button */}
                  {canMarkAsSent && (
                    <Button
                      onClick={onSendEmail}
                      disabled={isSendingEmail}
                      className="flex items-center gap-2"
                      variant="default"
                    >
                      <Mail className="w-4 h-4" />
                      {isSendingEmail ? 'Sending...' : 'Send Outreach Email'}
                    </Button>
                  )}

                  {/* Email Status */}
                  <div className="flex items-center gap-3 p-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      hasEmailBeenSent ? 'bg-green-500/10 text-green-600' : 'bg-muted'
                    }`}>
                      {hasEmailBeenSent ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Mail className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">
                        {hasEmailBeenSent ? 'Authors Contacted' : 'Ready to Contact'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {hasEmailBeenSent ? 'Awaiting response' : 'Send outreach email'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prominent Author Response Button - Only show if user can update after email sent */}
            {canModifyPostSentStatus && (
              <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-accent/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-foreground mb-1">
                        Update Implementation Status
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Have you received a response from the authors? Log the update here.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowResponseModal(true)}
                      disabled={isUpdating}
                      size="lg"
                      className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Log Author Response
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* GitHub Repo Required Warning */}
            {needsGithubRepo && (
              <Card className="border-2 border-yellow-500/40 bg-gradient-to-br from-yellow-500/5 to-accent/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-foreground mb-1">
                        GitHub Repository Required
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Please link a GitHub repository before proceeding with {progress.status === ProgressStatus.CODE_NEEDS_REFACTORING ? 'refactoring' : 'implementation'}.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Refactoring Path Progression */}
            {canProgressRefactoring && progress.githubRepoId && (
              <Card className="border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/5 to-accent/5">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-3">
                      <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-foreground">
                          Refactoring Progress
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Update the refactoring status as you make progress.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {progress.status === ProgressStatus.CODE_NEEDS_REFACTORING && (
                        <Button
                          onClick={() => confirmStatusUpdate(ProgressStatus.REFACTORING_STARTED)}
                          disabled={isUpdating}
                          variant="default"
                          size="sm"
                        >
                          Mark Refactoring Started
                        </Button>
                      )}
                      {progress.status === ProgressStatus.REFACTORING_STARTED && (
                        <Button
                          onClick={() => confirmStatusUpdate(ProgressStatus.REFACTORING_FINISHED)}
                          disabled={isUpdating}
                          variant="default"
                          size="sm"
                        >
                          Mark Refactoring Finished
                        </Button>
                      )}
                      {progress.status === ProgressStatus.REFACTORING_FINISHED && (
                        <Button
                          onClick={() => confirmStatusUpdate(ProgressStatus.VALIDATION_IN_PROGRESS)}
                          disabled={isUpdating}
                          variant="default"
                          size="sm"
                        >
                          Start Validation with Authors
                        </Button>
                      )}
                      {progress.status === ProgressStatus.VALIDATION_IN_PROGRESS && (
                        <Button
                          onClick={() => confirmStatusUpdate(ProgressStatus.OFFICIAL_CODE_POSTED)}
                          disabled={isUpdating}
                          variant="default"
                          size="sm"
                        >
                          Mark as Official Code Posted
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Community Path Progression */}
            {canProgressCommunity && progress.githubRepoId && (
              <Card className="border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/5 to-accent/5">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-3">
                      <Code className="w-5 h-5 text-purple-600 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-foreground">
                          Community Implementation Progress
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Update the implementation status as you make progress.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(progress.status === ProgressStatus.REFUSED_TO_UPLOAD || progress.status === ProgressStatus.NO_RESPONSE) && (
                        <Button
                          onClick={() => confirmStatusUpdate(ProgressStatus.GITHUB_CREATED)}
                          disabled={isUpdating}
                          variant="default"
                          size="sm"
                        >
                          Mark GitHub Created
                        </Button>
                      )}
                      {progress.status === ProgressStatus.GITHUB_CREATED && (
                        <Button
                          onClick={() => confirmStatusUpdate(ProgressStatus.CODE_STARTED)}
                          disabled={isUpdating}
                          variant="default"
                          size="sm"
                        >
                          Mark Code Started
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

                    <div className="space-y-3">
                        {/* Subtitle */}
                        <p className="text-sm text-muted-foreground -mt-2">
                            Track the journey from paper to working code
                        </p>
                        
                        {/* Timeline section - Compressed */}
                        <div className="bg-gradient-to-br from-card/80 to-card/40 rounded-lg p-4 border border-border/60 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-bold text-foreground">Progress Journey</h3>
                                <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-medium">
                                    {progress.updates.length} {progress.updates.length === 1 ? 'update' : 'updates'}
                                </span>
                            </div>
                            <HorizontalTimeline progress={progress} />
                        </div>
                    </div>

            {/* Login/Contributor Prompts */}
            {!isLoggedIn && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Please log in to update implementation progress
                  </p>
                </CardContent>
              </Card>
            )}

            {isLoggedIn && !isContributor && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Only contributors can update implementation progress. Express interest in this paper to contribute.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contributors Modal */}
      <Modal
        isOpen={showContributorsModal}
        onClose={() => setShowContributorsModal(false)}
        title="Contributors"
        maxWidth="600px"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          People working on implementing this paper
        </p>
        <UserDisplayList
          users={contributorUsers}
          title="Contributors"
          isLoading={isLoadingContributors}
          error={null}
          emptyMessage="No contributors yet."
        />
      </Modal>

      {/* Response Type Modal - Using Dialog instead of Modal for better compatibility */}
      <Dialog open={showResponseModal} onOpenChange={(open) => !open && setShowResponseModal(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>What was the author's response?</DialogTitle>
          </DialogHeader>
          
          <p className="mb-6 text-sm text-muted-foreground">
            Please select the type of response you received from the paper's authors:
          </p>
          
          <div className="space-y-3 mb-4">
            <button
              className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-green-500 hover:bg-green-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => confirmStatusUpdate(ProgressStatus.OFFICIAL_CODE_POSTED)}
              disabled={isUpdating}
              type="button"
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">Official Code Posted</div>
                  <div className="text-xs text-muted-foreground">Authors published their official working implementation</div>
                </div>
              </div>
            </button>

            <button
              className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-yellow-500 hover:bg-yellow-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => confirmStatusUpdate(ProgressStatus.CODE_NEEDS_REFACTORING)}
              disabled={isUpdating}
              type="button"
            >
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">Code Needs Refactoring</div>
                  <div className="text-xs text-muted-foreground">Authors shared code but it needs improvement before publishing</div>
                </div>
              </div>
            </button>

            <button
              className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => confirmStatusUpdate(ProgressStatus.REFUSED_TO_UPLOAD)}
              disabled={isUpdating}
              type="button"
            >
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">Refused to Upload / No Response</div>
                  <div className="text-xs text-muted-foreground">Authors declined to share or did not respond</div>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={() => confirmStatusUpdate(ProgressStatus.RESPONSE_RECEIVED)}
          title="Confirm Status Update"
          confirmText={isUpdating ? 'Updating...' : 'Confirm'}
          cancelText="Cancel"
          isConfirming={isUpdating}
        >
          <p>Are you sure you want to update the status?</p>
        </ConfirmationModal>
      )}
    </>
  );
};
