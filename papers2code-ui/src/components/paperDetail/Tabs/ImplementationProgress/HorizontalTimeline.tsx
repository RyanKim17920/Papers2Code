import React, { useMemo } from 'react';
import { ImplementationProgress, UpdateEventType, ProgressStatus } from '../../../../common/types/implementation';
import { TimelineEvent, TimelineEventData } from './TimelineEvent';
import { FileText, Send, MessageCircle, CheckCircle, Code, Clock, GitBranch } from 'lucide-react';

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
  path?: 'common' | 'official' | 'refactoring' | 'community';
}

// Common steps for all paths
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
    id: 'email_sent',
    title: 'Authors Contacted',
    description: 'Outreach email sent to paper authors requesting code implementation.',
    icon: Send,
    order: 2,
    path: 'common',
  },
];

// Path 1: Official Code Path (direct from email to completion)
const OFFICIAL_CODE_PATH: JourneyStep[] = [
  {
    id: 'official_code_posted',
    title: 'Official Code Posted',
    description: 'Authors published their official implementation directly.',
    icon: CheckCircle,
    order: 3,
    path: 'official',
  },
];

// Path 2: Refactoring Path
const REFACTORING_PATH: JourneyStep[] = [
  {
    id: 'code_needs_refactoring',
    title: 'Code Needs Work',
    description: 'Authors shared code that needs improvement.',
    icon: MessageCircle,
    order: 3,
    path: 'refactoring',
  },
  {
    id: 'refactoring_started',
    title: 'Refactoring Started',
    description: 'Working on improving the code.',
    icon: Clock,
    order: 4,
    path: 'refactoring',
  },
  {
    id: 'refactoring_finished',
    title: 'Refactoring Complete',
    description: 'Code improvements finished.',
    icon: Code,
    order: 5,
    path: 'refactoring',
  },
  {
    id: 'validation',
    title: 'Validation',
    description: 'Working with authors to validate the implementation.',
    icon: CheckCircle,
    order: 6,
    path: 'refactoring',
  },
];

// Path 3: Community Implementation Path
const COMMUNITY_PATH: JourneyStep[] = [
  {
    id: 'no_code_from_author',
    title: 'No Author Code',
    description: 'Authors don\'t have code available.',
    icon: MessageCircle,
    order: 3,
    path: 'community',
  },
  {
    id: 'github_created',
    title: 'Repository Created',
    description: 'GitHub repository set up for implementation.',
    icon: GitBranch,
    order: 4,
    path: 'community',
  },
  {
    id: 'code_needed',
    title: 'Implementation Started',
    description: 'Community is building the implementation.',
    icon: Code,
    order: 5,
    path: 'community',
  },
  {
    id: 'implementation_complete',
    title: 'Implementation Complete',
    description: 'Community implementation finished.',
    icon: CheckCircle,
    order: 6,
    path: 'community',
  },
];

export const HorizontalTimeline: React.FC<HorizontalTimelineProps> = ({ progress }) => {
  // Determine which path we're on based on the status
  const currentPath = useMemo(() => {
    const status = progress.status;
    
    if (status === ProgressStatus.OFFICIAL_CODE_POSTED) {
      return 'official';
    }
    
    if ([
      ProgressStatus.CODE_NEEDS_REFACTORING,
      ProgressStatus.REFACTORING_STARTED,
      ProgressStatus.REFACTORING_FINISHED,
      ProgressStatus.VALIDATION_IN_PROGRESS,
      ProgressStatus.VALIDATION_COMPLETED
    ].includes(status)) {
      return 'refactoring';
    }
    
    if ([
      ProgressStatus.NO_CODE_FROM_AUTHOR,
      ProgressStatus.GITHUB_CREATED,
      ProgressStatus.CODE_NEEDED
    ].includes(status)) {
      return 'community';
    }
    
    return 'common';
  }, [progress.status]);
  
  // Get the journey steps for the current path
  const journeySteps = useMemo(() => {
    let pathSteps: JourneyStep[] = [];
    
    if (currentPath === 'official') {
      pathSteps = [...COMMON_STEPS, ...OFFICIAL_CODE_PATH];
    } else if (currentPath === 'refactoring') {
      pathSteps = [...COMMON_STEPS, ...REFACTORING_PATH];
    } else if (currentPath === 'community') {
      pathSteps = [...COMMON_STEPS, ...COMMUNITY_PATH];
    } else {
      pathSteps = [...COMMON_STEPS];
    }
    
    return pathSteps;
  }, [currentPath]);

  // Map actual events to journey steps and determine completion status
  const timelineSteps = useMemo(() => {
    const completedStepIds = new Set<string>();
    const stepTimestamps: Record<string, string> = {};
    const stepDetails: Record<string, Record<string, unknown>> = {};
    
    // Map progress updates to journey steps
    progress.updates.forEach((update) => {
      const stepId = mapUpdateToJourneyStep(update.eventType, progress.status);
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
        type: step.id,
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
    <div className="relative w-full py-6 min-h-[140px] flex items-center">
      {/* Container with padding to prevent text overflow */}
      <div className="relative w-full px-12">
        {/* Base timeline line - full width in muted color */}
        <div className="absolute left-0 right-0 h-1 bg-muted/40 rounded-full" style={{ top: '24px' }} />
        
        {/* Progress line - colored portion showing completion */}
        <div 
          className="absolute left-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full transition-all duration-700 ease-in-out"
          style={{ 
            top: '24px',
            width: `${progressPercentage}%`
          }}
        />
        
        {/* Timeline steps - all steps including future ones */}
        <div className="relative h-12">
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
function mapUpdateToJourneyStep(eventType: UpdateEventType, status: ProgressStatus): string | null {
  switch (eventType) {
    case UpdateEventType.INITIATED:
      return 'initiated';
    case UpdateEventType.EMAIL_SENT:
      return 'email_sent';
    case UpdateEventType.STATUS_CHANGED:
      // Official code path
      if (status === ProgressStatus.OFFICIAL_CODE_POSTED) {
        return 'official_code_posted';
      }
      // Refactoring path
      if (status === ProgressStatus.CODE_NEEDS_REFACTORING) {
        return 'code_needs_refactoring';
      }
      if (status === ProgressStatus.REFACTORING_STARTED) {
        return 'refactoring_started';
      }
      if (status === ProgressStatus.REFACTORING_FINISHED) {
        return 'refactoring_finished';
      }
      if (status === ProgressStatus.VALIDATION_IN_PROGRESS || status === ProgressStatus.VALIDATION_COMPLETED) {
        return 'validation';
      }
      // Community path
      if (status === ProgressStatus.NO_CODE_FROM_AUTHOR) {
        return 'no_code_from_author';
      }
      if (status === ProgressStatus.GITHUB_CREATED) {
        return 'github_created';
      }
      if (status === ProgressStatus.CODE_NEEDED) {
        return 'code_needed';
      }
      return null;
    case UpdateEventType.GITHUB_REPO_LINKED:
      // Could be part of any path where repo is linked
      if (status === ProgressStatus.GITHUB_CREATED) {
        return 'github_created';
      }
      return null;
    case UpdateEventType.VALIDATION_STARTED:
    case UpdateEventType.VALIDATION_COMPLETED:
      return 'validation';
    default:
      return null;
  }
}

function getStepDetails(stepId: string, details?: Record<string, unknown>, progress?: ImplementationProgress): Array<{ label: string; value: string }> {
  const detailsList: Array<{ label: string; value: string }> = [];
  
  if (stepId === 'initiated' && progress) {
    detailsList.push({ label: 'Contributor', value: progress.initiatedBy || 'Unknown' });
    if (progress.contributors.length > 0) {
      detailsList.push({ label: 'Total Contributors', value: progress.contributors.length.toString() });
    }
  }
  
  if (stepId === 'code_received' && progress?.githubRepoId) {
    detailsList.push({ label: 'Repository', value: 'Linked' });
  }
  
  return detailsList;
}
