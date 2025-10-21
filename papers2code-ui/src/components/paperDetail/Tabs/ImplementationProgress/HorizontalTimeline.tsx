import React, { useMemo } from 'react';
import { ImplementationProgress, UpdateEventType, ProgressStatus } from '../../../../common/types/implementation';
import { TimelineEvent, TimelineEventData } from './TimelineEvent';
import { FileText, Send, MessageCircle, CheckCircle, Code, AlertCircle, XCircle, Clock, GitBranch, Wrench, ShieldCheck } from 'lucide-react';

interface HorizontalTimelineProps {
  progress: ImplementationProgress;
}

// Define the complete journey with all possible steps
interface JourneyStep {
  id: string;
  title: string;
  description: string;
  icon: typeof FileText;
  order: number;
  path?: 'common' | 'official' | 'refactoring' | 'community'; // Which path this step belongs to
}

// Common steps (always shown)
const COMMON_STEPS: JourneyStep[] = [
  {
    id: 'initiated',
    title: 'Tracking Started',
    description: 'Implementation progress tracking has been set up for this paper.',
    icon: FileText,
    order: 1,
    path: 'common',
  },
  {
    id: 'author_contacted',
    title: 'Author Contacted',
    description: 'Outreach email sent to paper authors requesting code implementation.',
    icon: Send,
    order: 2,
    path: 'common',
  },
];

// Path 1: Official Code Posted (authors upload directly)
const OFFICIAL_PATH_STEPS: JourneyStep[] = [
  {
    id: 'official_code_posted',
    title: 'Official Code Posted',
    description: 'Authors published their official working implementation.',
    icon: CheckCircle,
    order: 3,
    path: 'official',
  },
];

// Path 2: Refactoring Path
const REFACTORING_PATH_STEPS: JourneyStep[] = [
  {
    id: 'code_needs_refactoring',
    title: 'Code Needs Refactoring',
    description: 'Authors shared code but it needs improvement.',
    icon: AlertCircle,
    order: 3,
    path: 'refactoring',
  },
  {
    id: 'refactoring_started',
    title: 'Refactoring Started',
    description: 'Community has begun refactoring the code.',
    icon: Wrench,
    order: 4,
    path: 'refactoring',
  },
  {
    id: 'refactoring_finished',
    title: 'Refactoring Finished',
    description: 'Code refactoring has been completed.',
    icon: Code,
    order: 5,
    path: 'refactoring',
  },
  {
    id: 'validation_in_progress',
    title: 'Validation In Progress',
    description: 'Code is being validated by authors.',
    icon: ShieldCheck,
    order: 6,
    path: 'refactoring',
  },
  {
    id: 'official_code_posted',
    title: 'Official Code Posted',
    description: 'Validated code is now officially published.',
    icon: CheckCircle,
    order: 7,
    path: 'refactoring',
  },
];

// Path 3: Community Implementation Path (when authors refuse or don't respond)
const COMMUNITY_PATH_STEPS: JourneyStep[] = [
  {
    id: 'refused_or_no_response',
    title: 'No Author Code',
    description: 'Authors declined or did not respond to sharing code.',
    icon: XCircle,
    order: 3,
    path: 'community',
  },
  {
    id: 'github_created',
    title: 'GitHub Created',
    description: 'Repository created for community implementation.',
    icon: GitBranch,
    order: 4,
    path: 'community',
  },
  {
    id: 'code_started',
    title: 'Code Started',
    description: 'Community has begun implementing the paper.',
    icon: Clock,
    order: 5,
    path: 'community',
  },
  {
    id: 'code_completed',
    title: 'Implementation Complete',
    description: 'Community implementation is complete and verified.',
    icon: CheckCircle,
    order: 6,
    path: 'community',
  },
];

export const HorizontalTimeline: React.FC<HorizontalTimelineProps> = ({ progress }) => {
    // Determine which path the progress is on based on the current state
  const currentPath = useMemo((): 'common' | 'official' | 'refactoring' | 'community' => {
    const hasEmailSent = progress.updates.some(u => u.eventType === UpdateEventType.EMAIL_SENT);
    
    if (!hasEmailSent && progress.status !== ProgressStatus.EMAIL_SENT) {
      return 'common';
    }
    
    // Check which path based on status
    if (progress.status === ProgressStatus.OFFICIAL_CODE_POSTED || progress.status === ProgressStatus.CODE_UPLOADED) {
      // Check if we went through refactoring
      const hasRefactoring = progress.updates.some(u => 
        u.eventType === UpdateEventType.STATUS_CHANGED && 
        u.details?.newStatus && 
        (u.details.newStatus === ProgressStatus.CODE_NEEDS_REFACTORING || 
         u.details.newStatus === ProgressStatus.REFACTORING_STARTED ||
         u.details.newStatus === ProgressStatus.REFACTORING_FINISHED ||
         u.details.newStatus === ProgressStatus.VALIDATION_IN_PROGRESS)
      );
      
      if (hasRefactoring) {
        return 'refactoring';
      }
      return 'official';
    }
    
    if (progress.status === ProgressStatus.CODE_NEEDS_REFACTORING || 
        progress.status === ProgressStatus.REFACTORING_STARTED ||
        progress.status === ProgressStatus.REFACTORING_FINISHED ||
        progress.status === ProgressStatus.VALIDATION_IN_PROGRESS) {
      return 'refactoring';
    }
    
    if (progress.status === ProgressStatus.REFUSED_TO_UPLOAD || 
        progress.status === ProgressStatus.NO_RESPONSE ||
        progress.status === ProgressStatus.GITHUB_CREATED ||
        progress.status === ProgressStatus.CODE_STARTED) {
      return 'community';
    }
    
    // Default to community path for future steps display
    return 'community';
  }, [progress]);

  // Build the journey steps based on the current path
  const journeySteps = useMemo(() => {
    let pathSteps: JourneyStep[] = [];
    
    if (currentPath === 'official') {
      pathSteps = [...COMMON_STEPS, ...OFFICIAL_PATH_STEPS];
    } else if (currentPath === 'refactoring') {
      pathSteps = [...COMMON_STEPS, ...REFACTORING_PATH_STEPS];
    } else if (currentPath === 'community') {
      pathSteps = [...COMMON_STEPS, ...COMMUNITY_PATH_STEPS];
    } else {
      // Default: show common steps + community path as ideal future
      pathSteps = [...COMMON_STEPS, ...COMMUNITY_PATH_STEPS];
    }
    
    return pathSteps;
  }, [currentPath]);

  // Map actual events to journey steps and determine completion status
  const timelineSteps = useMemo(() => {
    const completedStepIds = new Set<string>();
    const stepTimestamps: Record<string, string> = {};
    const stepDetails: Record<string, any> = {};
    
    // Map progress updates to journey steps
    progress.updates.forEach((update) => {
      const stepId = mapUpdateToJourneyStep(update.eventType, progress.status, update.details);
      if (stepId) {
        completedStepIds.add(stepId);
        // Keep the earliest timestamp for each step
        if (!stepTimestamps[stepId]) {
          stepTimestamps[stepId] = update.timestamp;
          stepDetails[stepId] = update.details;
        }
      }
    });
    
    // Determine the current step (last completed)
    const currentStepOrder = Math.max(...Array.from(completedStepIds).map(id => 
      journeySteps.find(s => s.id === id)?.order || 0
    ));
    
    return journeySteps.map((step): TimelineEventData => {
      const isCompleted = completedStepIds.has(step.id);
      const isCurrent = step.order === currentStepOrder && isCompleted;
      const isFuture = step.order > currentStepOrder;
      
      return {
        id: step.id,
        type: step.id as any,
        status: progress.status,
        timestamp: stepTimestamps[step.id] || new Date().toISOString(),
        title: step.title,
        description: step.description,
        icon: step.icon,
        state: isFuture ? 'future' : isCurrent ? 'current' : 'completed',
        details: stepDetails[step.id] ? getStepDetails(step.id, stepDetails[step.id], progress) : undefined,
        isFuture,
        isClickable: true,
      };
    });
  }, [progress, journeySteps]);

  // Evenly distribute steps across the timeline
  const stepPositions = useMemo(() => {
    const totalSteps = timelineSteps.length;
    if (totalSteps === 0) return [];
    if (totalSteps === 1) return [50];
    
    // Distribute evenly with 10% padding on each side
    return timelineSteps.map((_, idx) => {
      return 10 + (idx / (totalSteps - 1)) * 80;
    });
  }, [timelineSteps]);

  // Calculate the progress percentage for the colored line
  const progressPercentage = useMemo(() => {
    const completedCount = timelineSteps.filter(s => s.state === 'completed').length;
    const currentStepIndex = timelineSteps.findIndex(s => s.state === 'current');
    
    // If there's a current step, the line should reach it
    if (currentStepIndex >= 0) {
      return stepPositions[currentStepIndex] || 0;
    }
    
    // If only completed steps, reach the last completed step
    if (completedCount > 0) {
      const lastCompletedIndex = timelineSteps.length - 1 - 
        [...timelineSteps].reverse().findIndex(s => s.state === 'completed');
      return stepPositions[lastCompletedIndex] || 0;
    }
    
    return 0;
  }, [timelineSteps, stepPositions]);

  return (
    <div className="relative w-full py-10 min-h-[180px] flex items-center">
      {/* Container with padding to prevent text overflow */}
      <div className="relative w-full px-16">
        {/* Base timeline line - full width in muted color */}
        <div className="absolute left-0 right-0 h-1 bg-muted/40 rounded-full" style={{ top: '28px' }} />
        
        {/* Progress line - colored portion showing completion */}
        <div 
          className="absolute left-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full transition-all duration-700 ease-in-out"
          style={{ 
            top: '28px',
            width: `${progressPercentage}%`
          }}
        />
        
        {/* Timeline steps - all steps including future ones */}
        <div className="relative h-16">
          {timelineSteps.map((step, idx) => (
            <TimelineEvent
              key={step.id}
              event={step}
              position={stepPositions[idx]}
              isLast={idx === timelineSteps.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper functions
function mapUpdateToJourneyStep(eventType: UpdateEventType, currentStatus: ProgressStatus, details?: Record<string, any>): string | null {
  switch (eventType) {
    case UpdateEventType.INITIATED:
      return 'initiated';
    case UpdateEventType.EMAIL_SENT:
      return 'author_contacted';
    case UpdateEventType.STATUS_CHANGED:
      if (details?.newStatus) {
        const newStatus = details.newStatus;
        
        // Map status changes to journey steps
        if (newStatus === ProgressStatus.EMAIL_SENT) {
          return 'author_contacted';
        }
        if (newStatus === ProgressStatus.OFFICIAL_CODE_POSTED || newStatus === ProgressStatus.CODE_UPLOADED) {
          return 'official_code_posted';
        }
        if (newStatus === ProgressStatus.CODE_NEEDS_REFACTORING) {
          return 'code_needs_refactoring';
        }
        if (newStatus === ProgressStatus.REFACTORING_STARTED) {
          return 'refactoring_started';
        }
        if (newStatus === ProgressStatus.REFACTORING_FINISHED) {
          return 'refactoring_finished';
        }
        if (newStatus === ProgressStatus.VALIDATION_IN_PROGRESS) {
          return 'validation_in_progress';
        }
        if (newStatus === ProgressStatus.REFUSED_TO_UPLOAD || newStatus === ProgressStatus.NO_RESPONSE) {
          return 'refused_or_no_response';
        }
        if (newStatus === ProgressStatus.GITHUB_CREATED) {
          return 'github_created';
        }
        if (newStatus === ProgressStatus.CODE_STARTED) {
          return 'code_started';
        }
      }
      return null;
    case UpdateEventType.GITHUB_REPO_LINKED:
      // GitHub linking can be part of different paths
      if (currentStatus === ProgressStatus.CODE_NEEDS_REFACTORING || 
          currentStatus === ProgressStatus.REFACTORING_STARTED) {
        return 'code_needs_refactoring';
      }
      if (currentStatus === ProgressStatus.GITHUB_CREATED || currentStatus === ProgressStatus.CODE_STARTED) {
        return 'github_created';
      }
      return null;
    default:
      return null;
  }
}

function getStepDetails(stepId: string, details?: Record<string, any>, progress?: ImplementationProgress): Array<{ label: string; value: string }> {
  const detailsList: Array<{ label: string; value: string }> = [];
  
  if (stepId === 'initiated' && progress) {
    detailsList.push({ label: 'Contributor', value: progress.initiatedBy || 'Unknown' });
    if (progress.contributors.length > 0) {
      detailsList.push({ label: 'Total Contributors', value: progress.contributors.length.toString() });
    }
  }
  
  if ((stepId === 'official_code_posted' || stepId === 'github_created' || stepId === 'code_needs_refactoring') && progress?.githubRepoId) {
    detailsList.push({ label: 'Repository', value: 'Linked' });
  }
  
  return detailsList;
}
