import React, { useEffect, useState } from 'react';
import { ImplementationProgress, ProgressStatus, UpdateEventType } from '../../../../common/types/implementation';
import type { UserProfile } from '../../../../common/types/user';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../ui/dialog';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import { HorizontalTimeline } from './HorizontalTimeline';
import { GitBranch, Users, Mail, ExternalLink, Clock, CheckCircle } from 'lucide-react';
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
    if (progress.status === ProgressStatus.CODE_UPLOADED) {
      return { label: 'Completed', variant: 'default' as const };
    }
    return { label: paperStatus, variant: 'outline' as const };
  };

  const wipStatus = getWIPStatus();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="flex-1">
                <DialogTitle className="text-2xl mb-2">Implementation Progress</DialogTitle>
                <p className="text-sm text-muted-foreground">Track the journey from paper to code</p>
              </div>
              <Badge variant={wipStatus.variant} className={getStatusColorClasses(wipStatus.label)}>
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

            {/* Timeline */}
            <Card>
              <CardContent className="p-0">
                <HorizontalTimeline progress={progress} />
              </CardContent>
            </Card>

            {/* Actions */}
            {isContributor && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {/* Send Email Button */}
                    {!hasEmailBeenSent && canMarkAsSent && (
                      <Button
                        onClick={onSendEmail}
                        disabled={isSendingEmail || isUpdating}
                        className="w-full"
                        size="lg"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {isSendingEmail ? 'Sending Email...' : 'Send Author Outreach Email'}
                      </Button>
                    )}

                    {/* Status Update Button */}
                    {hasEmailBeenSent && canModifyPostSentStatus && progress.status === ProgressStatus.STARTED && (
                      <Button
                        onClick={() => handleStatusUpdate(ProgressStatus.RESPONSE_RECEIVED)}
                        disabled={isUpdating}
                        className="w-full"
                        size="lg"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Authors Responded
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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

      {/* Response Type Modal */}
      {showResponseModal && (
        <Modal
          isOpen={showResponseModal}
          onClose={() => setShowResponseModal(false)}
          title="What was the author's response?"
          maxWidth="600px"
          showCloseButton={true}
        >
          <p className="mb-6 text-sm text-muted-foreground">
            Please select the type of response you received from the paper's authors:
          </p>
          
          <div className="space-y-3 mb-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:bg-green-500/10 hover:border-green-500"
              onClick={() => confirmStatusUpdate(ProgressStatus.CODE_UPLOADED)}
              disabled={isUpdating}
            >
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Code Uploaded</div>
                  <div className="text-xs text-muted-foreground">Authors published their working implementation</div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:bg-yellow-500/10 hover:border-yellow-500"
              onClick={() => confirmStatusUpdate(ProgressStatus.CODE_NEEDS_REFACTORING)}
              disabled={isUpdating}
            >
              <div className="flex items-start gap-3 text-left">
                <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Code Needs Refactoring</div>
                  <div className="text-xs text-muted-foreground">Authors shared code but it needs improvement</div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:bg-red-500/10 hover:border-red-500"
              onClick={() => confirmStatusUpdate(ProgressStatus.REFUSED_TO_UPLOAD)}
              disabled={isUpdating}
            >
              <div className="flex items-start gap-3 text-left">
                <Mail className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Refused to Upload</div>
                  <div className="text-xs text-muted-foreground">Authors declined to share their implementation</div>
                </div>
              </div>
            </Button>
          </div>
        </Modal>
      )}

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
