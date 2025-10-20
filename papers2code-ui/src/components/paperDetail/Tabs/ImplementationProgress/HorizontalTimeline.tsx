import React, { useMemo } from 'react';
import { ImplementationProgress, UpdateEventType, ProgressStatus } from '../../../../common/types/implementation';
import { TimelineEvent, TimelineEventData } from './TimelineEvent';
import { FileText, Send, MessageCircle, CheckCircle, Code, AlertCircle, XCircle, Clock } from 'lucide-react';

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
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'initiated',
    title: 'Tracking Started',
    description: 'Implementation progress tracking has been set up for this paper.',
    icon: FileText,
    order: 1,
  },
  {
    id: 'author_contacted',
    title: 'Author Contacted',
    description: 'Outreach email sent to paper authors requesting code implementation.',
    icon: Send,
    order: 2,
  },
  {
    id: 'response_received',
    title: 'Response Received',
    description: 'Authors have responded to the outreach request.',
    icon: MessageCircle,
    order: 3,
  },
  {
    id: 'code_started',
    title: 'Code Started',
    description: 'Authors have begun working on the implementation.',
    icon: Clock,
    order: 4,
  },
  {
    id: 'code_received',
    title: 'Code Published',
    description: 'Authors have shared their working implementation code.',
    icon: CheckCircle,
    order: 5,
  },
  {
    id: 'verified',
    title: 'Implementation Verified',
    description: 'Code has been reviewed and verified to work correctly.',
    icon: Code,
    order: 6,
  },
];

export const HorizontalTimeline: React.FC<HorizontalTimelineProps> = ({ progress }) => {
  // Map actual events to journey steps and determine completion status
  const timelineSteps = useMemo(() => {
    const completedStepIds = new Set<string>();
    const stepTimestamps: Record<string, string> = {};
    const stepDetails: Record<string, any> = {};
    
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
      JOURNEY_STEPS.find(s => s.id === id)?.order || 0
    ));
    
    return JOURNEY_STEPS.map((step): TimelineEventData => {
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
  }, [progress]);

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
      return 'author_contacted';
    case UpdateEventType.STATUS_CHANGED:
      if (status === ProgressStatus.RESPONSE_RECEIVED) {
        return 'response_received';
      }
      if (status === ProgressStatus.CODE_NEEDS_REFACTORING) {
        return 'code_started';
      }
      if (status === ProgressStatus.CODE_UPLOADED) {
        return 'code_received';
      }
      // TODO: Backend should track verification status separately
      // For now, we don't automatically mark as verified
      return null;
    case UpdateEventType.GITHUB_REPO_LINKED:
      return 'code_received';
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
  
  if (stepId === 'code_received' && progress?.githubRepoId) {
    detailsList.push({ label: 'Repository', value: 'Linked' });
  }
  
  return detailsList;
}
