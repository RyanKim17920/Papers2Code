import React, { useEffect, useState } from 'react';
import { ImplementationProgress, ProgressStatus, UpdateEventType } from '@/shared/types/implementation';
import type { UserProfile } from '@/shared/types/user';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { HorizontalTimeline } from './HorizontalTimeline';
import { GitBranch, Users, Mail, ExternalLink, Clock, CheckCircle, MessageCircle, Code } from 'lucide-react';
import { getStatusColorClasses } from '@/shared/utils/statusUtils';
import { useContributorProfiles } from '@/shared/hooks/useContributorProfiles';
import { UserDisplayList } from '../../UserDisplayList';
import Modal from '@/shared/components/Modal';
import { updateImplementationProgressInApi, createGitHubRepositoryForPaper } from '@/shared/services/api';
import ConfirmationModal from '@/shared/components/ConfirmationModal';

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
  const [githubRepoInput, setGithubRepoInput] = useState(progress.githubRepoId || '');
  const [selectedResponseStatus, setSelectedResponseStatus] = useState<ProgressStatus | null>(null);
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Handle Dialog close - prevent closing if any modal is open
  const handleDialogOpenChange = (open: boolean) => {
    // If trying to close the dialog (open = false), check if any modal is open
    if (!open && (showContributorsModal || showResponseModal || showConfirmModal || showSuccessModal)) {
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
  
  // Check if response has been received (moved beyond waiting state)
  const hasResponseBeenReceived = progress.status !== ProgressStatus.STARTED && 
                                  progress.status !== ProgressStatus.EMAIL_SENT;
  
  // Only show "Log Author Response" button if email sent and still waiting for response
  const isWaitingForResponse = progress.status === ProgressStatus.STARTED || progress.status === ProgressStatus.EMAIL_SENT;
  const canModifyPostSentStatus = isLoggedIn && hasEmailBeenSent && isWaitingForResponse && (isInitiator || isContributor);
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
    progress.status === ProgressStatus.GITHUB_CREATED
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
      const updateData: any = { status };
      
      // If GitHub repo input is provided, include it
      if (githubRepoInput && githubRepoInput.trim()) {
        updateData.githubRepoId = githubRepoInput.trim();
      }
      
      const updatedProgress = await updateImplementationProgressInApi(paperId, updateData);
      await onImplementationProgressChange(updatedProgress);
      setShowConfirmModal(false);
      setShowResponseModal(false);
      setSelectedResponseStatus(null);
      setGithubRepoInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateGitHubRepo = async () => {
    try {
      setIsCreatingRepo(true);
      setError(null);
      
      // Simply call the API without any parameters - the backend will handle everything
      const result = await createGitHubRepositoryForPaper(paperId);
      
      // Check if README was successfully updated
      if (!result.repository?.readme_updated) {
        console.warn('Repository created but README was not updated with paper information');
      }
      
      // Automatically fill in the created repository full name
      setGithubRepoInput(result.repository.full_name);
      
      // Update the progress with the newly created repository
      await onImplementationProgressChange(result.progress);
      
      // Automatically update status to GITHUB_CREATED
      const updateData = { 
        status: ProgressStatus.GITHUB_CREATED,
        githubRepoId: result.repository.full_name
      };
      const updatedProgress = await updateImplementationProgressInApi(paperId, updateData);
      await onImplementationProgressChange(updatedProgress);
      
      // Show success modal
      setShowSuccessModal(true);
      setError(null);
      
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create GitHub repository. Please try again.');
      }
    } finally {
      setIsCreatingRepo(false);
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
                <DialogTitle className="text-xl mb-1 font-bold">Implementation Progress</DialogTitle>
                <p className="text-xs text-foreground/70 font-medium">Track the journey from paper to code</p>
              </div>
              <Badge variant={wipStatus.variant} className={`${getStatusColorClasses(wipStatus.label)} whitespace-nowrap`}>
                {wipStatus.label}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Status Bar */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  {/* Contributors */}
                  <button
                    onClick={() => setShowContributorsModal(true)}
                    className="flex items-center gap-2 hover:bg-accent rounded-lg p-2 transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold text-foreground">{progress.contributors.length}</div>
                      <div className="text-[10px] text-foreground/70 font-semibold">
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
                      className="flex items-center gap-2 hover:bg-accent rounded-lg p-2 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                        <GitBranch className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-medium flex items-center gap-1 text-foreground">
                          View Repository <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                        <div className="text-[10px] text-foreground/70 font-medium truncate max-w-[200px]">
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
                      size="sm"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {isSendingEmail ? 'Sending...' : 'Send Email'}
                    </Button>
                  )}

                  {/* Email Status */}
                  <div className="flex items-center gap-2 p-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      hasEmailBeenSent ? 'bg-green-500/10 text-green-600' : 'bg-muted'
                    }`}>
                      {hasEmailBeenSent ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-medium">
                        {hasEmailBeenSent 
                          ? (hasResponseBeenReceived ? 'Response Received' : 'Authors Contacted')
                          : 'Ready to Contact'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {hasEmailBeenSent 
                          ? (hasResponseBeenReceived ? 'Moving forward' : 'Awaiting response')
                          : 'Send outreach email'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prominent Author Response Button - Only show if user can update after email sent */}
            {canModifyPostSentStatus && (
              <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-accent/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground mb-0.5">
                        Update Implementation Status
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Have you received a response from the authors? Log the update here.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowResponseModal(true)}
                      disabled={isUpdating}
                      size="sm"
                      className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Log Response
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* GitHub Repo Required Warning */}
            {needsGithubRepo && (
              <Card className="border-2 border-yellow-500/40 bg-gradient-to-br from-yellow-500/5 to-accent/5">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <GitBranch className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground mb-0.5">
                        Create GitHub Repository
                      </h3>
                      <p className="text-xs text-foreground/80 font-medium mb-3">
                        We'll automatically create a repository from our template with the paper details pre-filled.
                      </p>
                      
                      {/* One-Click Repository Creation */}
                      <Button
                        onClick={handleCreateGitHubRepo}
                        disabled={isCreatingRepo}
                        className="w-full flex items-center justify-center gap-2 mb-3"
                        size="sm"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        {isCreatingRepo ? 'Creating Repository...' : 'Create Repository from Template'}
                      </Button>
                      
                      {/* Manual Link Option */}
                      <div className="pt-3 border-t border-border">
                        <p className="text-[10px] text-muted-foreground mb-2">Or link an existing repository:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g., username/repo-name"
                            value={githubRepoInput}
                            onChange={(e) => setGithubRepoInput(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                            disabled={isUpdating}
                          />
                          <Button
                            onClick={async () => {
                              if (!githubRepoInput.trim()) return;
                              try {
                                setIsUpdating(true);
                                const updatedProgress = await updateImplementationProgressInApi(paperId, { 
                                  githubRepoId: githubRepoInput.trim() 
                                });
                                await onImplementationProgressChange(updatedProgress);
                                setGithubRepoInput('');
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Failed to link repository');
                              } finally {
                                setIsUpdating(false);
                              }
                            }}
                            disabled={isUpdating || !githubRepoInput.trim()}
                            variant="outline"
                            size="sm"
                          >
                            {isUpdating ? 'Linking...' : 'Link'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Refactoring Path - Link Repository if missing */}
            {canProgressRefactoring && !progress.githubRepoId && (
              <Card className="border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/5 to-accent/5">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <GitBranch className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground mb-0.5">
                        Link Author's Repository
                      </h3>
                      <p className="text-xs text-foreground/80 font-medium mb-3">
                        The authors shared code that needs refactoring. Please link their repository here.
                      </p>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., username/repo-name or full URL"
                          value={githubRepoInput}
                          onChange={(e) => setGithubRepoInput(e.target.value)}
                          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                          disabled={isUpdating}
                        />
                        <Button
                          onClick={async () => {
                            if (!githubRepoInput.trim()) return;
                            try {
                              setIsUpdating(true);
                              const updatedProgress = await updateImplementationProgressInApi(paperId, { 
                                githubRepoId: githubRepoInput.trim() 
                              });
                              await onImplementationProgressChange(updatedProgress);
                              setGithubRepoInput('');
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Failed to link repository');
                            } finally {
                              setIsUpdating(false);
                            }
                          }}
                          disabled={isUpdating || !githubRepoInput.trim()}
                          size="sm"
                        >
                          {isUpdating ? 'Linking...' : 'Link Repository'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Refactoring Path Progression */}
            {canProgressRefactoring && progress.githubRepoId && (
              <Card className="border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/5 to-accent/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          Refactoring Progress
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Update the refactoring status as you make progress.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap flex-shrink-0">
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
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Code className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          Community Implementation Progress
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Update the implementation status as you make progress.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap flex-shrink-0">
                      {progress.status === ProgressStatus.GITHUB_CREATED && (
                        <Button
                          onClick={() => confirmStatusUpdate(ProgressStatus.IMPLEMENTATION_COMPLETE)}
                          disabled={isUpdating}
                          variant="default"
                          size="sm"
                        >
                          Mark Implementation Complete
                        </Button>
                      )}
                      {progress.status === ProgressStatus.IMPLEMENTATION_COMPLETE && (
                        <Button
                          onClick={() => confirmStatusUpdate(ProgressStatus.PEER_REVIEW_REQUIRED)}
                          disabled={isUpdating}
                          variant="default"
                          size="sm"
                        >
                          Request Peer Review
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Implementation Complete - Request Review */}
            {progress.status === ProgressStatus.IMPLEMENTATION_COMPLETE && (
              <Card className="border-2 border-green-500/40 bg-gradient-to-br from-green-500/5 to-green-400/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Implementation Complete!
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Great work! Click "Request Peer Review" above to submit your implementation for review.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Peer Review Required State */}
            {progress.status === ProgressStatus.PEER_REVIEW_REQUIRED && (
              <Card className="border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-amber-400/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Peer Review Required
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Implementation submitted! Waiting for a non-contributor to review the code before final approval.
                        {isContributor && " As a contributor, you cannot review your own work."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

                    <div className="space-y-2">
                        {/* Timeline section - Compressed */}
                        <div className="bg-gradient-to-br from-card/80 to-card/40 rounded-lg p-3 border border-border/60 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-foreground">Progress Journey</h3>
                                <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full font-medium">
                                    {progress.updates.length} {progress.updates.length === 1 ? 'update' : 'updates'}
                                </span>
                            </div>
                            <HorizontalTimeline progress={progress} />
                        </div>
                    </div>

            {/* Login/Contributor Prompts */}
            {!isLoggedIn && (
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Please log in to update implementation progress
                  </p>
                </CardContent>
              </Card>
            )}

            {isLoggedIn && !isContributor && (
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-xs text-muted-foreground">
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

      {/* Response Type Modal - Direct status update without GitHub input */}
      <Dialog open={showResponseModal} onOpenChange={(open) => {
        if (!open) {
          setShowResponseModal(false);
          setSelectedResponseStatus(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              What was the author's response?
            </DialogTitle>
          </DialogHeader>
          
          <p className="mb-6 text-sm text-foreground/80 font-medium">
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

      {/* Success Modal */}
      {showSuccessModal && (
        <Modal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          title="Repository Created Successfully!"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Your GitHub repository has been created and populated with paper details.</p>
                <p className="text-xs text-foreground/70 mt-1">Status automatically updated to "GitHub Created"</p>
              </div>
            </div>
            
            {githubRepoInput && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Repository URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={getGithubUrl(githubRepoInput)}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted/50 text-foreground"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(getGithubUrl(githubRepoInput));
                    }}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink size={14} />
                    Copy
                  </Button>
                  <a
                    href={getGithubUrl(githubRepoInput)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    <ExternalLink size={14} />
                    View
                  </a>
                </div>
              </div>
            )}

            <Button
              onClick={() => setShowSuccessModal(false)}
              className="w-full"
              type="button"
            >
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};
