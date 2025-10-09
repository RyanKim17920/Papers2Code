import React, { useMemo } from 'react';
import { ImplementationProgress, UpdateEventType, ProgressStatus } from '../../../../common/types/implementation';
import { TimelineEvent, TimelineEventData } from './TimelineEvent';

interface HorizontalTimelineProps {
  progress: ImplementationProgress;
}

export const HorizontalTimeline: React.FC<HorizontalTimelineProps> = ({ progress }) => {
  // Generate timeline events from progress updates array
  const events = useMemo((): TimelineEventData[] => {
    return progress.updates.map((update, index) => {
      const eventData: TimelineEventData = {
        id: `event-${index}`,
        type: mapEventTypeToDisplay(update.eventType),
        status: progress.status,
        timestamp: update.timestamp,
        title: getEventTitle(update.eventType, update.details),
        description: getEventDescription(update.eventType, update.details),
        details: getEventDetails(update.eventType, update.details, progress)
      };
      return eventData;
    });
  }, [progress]);

  // Calculate positions with logarithmic-like scaling for long durations
  const eventPositions = useMemo(() => {
    if (events.length === 0) return [];
    if (events.length === 1) return [50]; // Center single event

    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    const minTime = timestamps[0];
    const maxTime = timestamps[timestamps.length - 1];
    const totalDuration = maxTime - minTime;

    if (totalDuration === 0) {
      // All events at same time, distribute evenly
      return events.map((_, idx) => (idx / (events.length - 1)) * 80 + 10);
    }

    // Use logarithmic scaling for very long durations (more than 30 days)
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const useLogScale = totalDuration > thirtyDaysMs;

    return timestamps.map((timestamp, idx) => {
      if (idx === 0) return 10; // First event at 10%
      if (idx === timestamps.length - 1) return 90; // Last event at 90%

      const timeSinceStart = timestamp - minTime;
      
      if (useLogScale) {
        // Logarithmic scaling
        const logTotal = Math.log(totalDuration + 1);
        const logCurrent = Math.log(timeSinceStart + 1);
        return 10 + (logCurrent / logTotal) * 80;
      } else {
        // Linear scaling
        return 10 + (timeSinceStart / totalDuration) * 80;
      }
    });
  }, [events]);

  return (
    <div className="relative w-full px-8 py-12 min-h-[200px]">
      {/* Base timeline line */}
      <div className="absolute top-6 left-8 right-8 h-0.5 bg-border" />
      
      {/* Timeline events */}
      <div className="relative">
        {events.map((event, idx) => (
          <TimelineEvent
            key={event.id}
            event={event}
            position={eventPositions[idx]}
            isLast={idx === events.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

// Helper functions
function mapEventTypeToDisplay(eventType: UpdateEventType): 'initiated' | 'email_sent' | 'response' | 'final' {
  switch (eventType) {
    case UpdateEventType.INITIATED:
      return 'initiated';
    case UpdateEventType.EMAIL_SENT:
      return 'email_sent';
    case UpdateEventType.STATUS_CHANGED:
    case UpdateEventType.GITHUB_REPO_LINKED:
    case UpdateEventType.GITHUB_REPO_UPDATED:
      return 'response';
    case UpdateEventType.CONTRIBUTOR_JOINED:
      return 'response';
    default:
      return 'response';
  }
}

function getEventTitle(eventType: UpdateEventType, details?: Record<string, any>): string {
  switch (eventType) {
    case UpdateEventType.INITIATED:
      return 'Implementation Initiated';
    case UpdateEventType.CONTRIBUTOR_JOINED:
      return 'Contributor Joined';
    case UpdateEventType.EMAIL_SENT:
      return 'Author Contacted';
    case UpdateEventType.STATUS_CHANGED:
      return getStatusTitle(details?.newStatus);
    case UpdateEventType.GITHUB_REPO_LINKED:
      return 'GitHub Repository Linked';
    case UpdateEventType.GITHUB_REPO_UPDATED:
      return 'GitHub Repository Updated';
    default:
      return 'Update';
  }
}

function getEventDescription(eventType: UpdateEventType, details?: Record<string, any>): string {
  switch (eventType) {
    case UpdateEventType.INITIATED:
      return 'Implementation progress tracking started for this paper.';
    case UpdateEventType.CONTRIBUTOR_JOINED:
      return 'A new contributor joined the implementation effort.';
    case UpdateEventType.EMAIL_SENT:
      return 'Email sent to paper authors requesting code implementation.';
    case UpdateEventType.STATUS_CHANGED:
      return getStatusDescription(details?.newStatus);
    case UpdateEventType.GITHUB_REPO_LINKED:
      return 'GitHub repository has been linked to this implementation.';
    case UpdateEventType.GITHUB_REPO_UPDATED:
      return 'GitHub repository information has been updated.';
    default:
      return '';
  }
}

function getEventDetails(eventType: UpdateEventType, details?: Record<string, any>, progress?: ImplementationProgress): Array<{ label: string; value: string }> {
  const detailsList: Array<{ label: string; value: string }> = [];
  
  if (eventType === UpdateEventType.INITIATED && progress) {
    detailsList.push({ label: 'Contributors', value: progress.contributors.length.toString() });
  }
  
  if (eventType === UpdateEventType.STATUS_CHANGED && details?.previousStatus) {
    detailsList.push({ label: 'Previous Status', value: details.previousStatus });
  }
  
  if (eventType === UpdateEventType.GITHUB_REPO_LINKED || eventType === UpdateEventType.GITHUB_REPO_UPDATED) {
    if (details?.githubRepoId) {
      detailsList.push({ label: 'Repository', value: 'Available' });
    }
  }
  
  return detailsList;
}

function getStatusTitle(status?: string): string {
  if (!status) return 'Status Changed';
  
  switch (status) {
    case ProgressStatus.CODE_UPLOADED:
      return 'Code Published';
    case ProgressStatus.CODE_NEEDS_REFACTORING:
      return 'Code Needs Work';
    case ProgressStatus.REFUSED_TO_UPLOAD:
      return 'Authors Declined';
    case ProgressStatus.NO_RESPONSE:
      return 'No Response Received';
    case ProgressStatus.RESPONSE_RECEIVED:
      return 'Authors Responded';
    case ProgressStatus.REFACTORING_IN_PROGRESS:
      return 'Refactoring in Progress';
    case ProgressStatus.STARTED:
      return 'Implementation Started';
    default:
      return status;
  }
}

function getStatusDescription(status?: string): string {
  if (!status) return '';
  
  switch (status) {
    case ProgressStatus.CODE_UPLOADED:
      return 'Authors successfully published their working implementation.';
    case ProgressStatus.CODE_NEEDS_REFACTORING:
      return 'Authors shared code but it requires improvements.';
    case ProgressStatus.REFUSED_TO_UPLOAD:
      return 'Authors declined to share their implementation.';
    case ProgressStatus.NO_RESPONSE:
      return 'No response received from authors after 4 weeks.';
    case ProgressStatus.RESPONSE_RECEIVED:
      return 'Authors have responded to the outreach email.';
    case ProgressStatus.REFACTORING_IN_PROGRESS:
      return 'Code refactoring is in progress.';
    case ProgressStatus.STARTED:
      return 'Implementation has been started.';
    default:
      return '';
  }
}
