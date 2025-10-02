import React, { useMemo } from 'react';
import { ImplementationProgress, EmailStatus } from '../../../../common/types/implementation';
import { TimelineEvent, TimelineEventData } from './TimelineEvent';

interface HorizontalTimelineProps {
  progress: ImplementationProgress;
}

export const HorizontalTimeline: React.FC<HorizontalTimelineProps> = ({ progress }) => {
  // Generate timeline events from progress data
  const events = useMemo((): TimelineEventData[] => {
    const eventList: TimelineEventData[] = [];

    // Event 1: Implementation initiated
    eventList.push({
      id: 'initiated',
      type: 'initiated',
      status: EmailStatus.NOT_SENT,
      timestamp: progress.createdAt,
      title: 'Implementation Initiated',
      description: 'Implementation progress tracking started for this paper.',
      details: [
        { label: 'Contributors', value: progress.contributors.length.toString() }
      ]
    });

    // Event 2: Email sent (if applicable)
    if (progress.emailSentAt) {
      eventList.push({
        id: 'email_sent',
        type: 'email_sent',
        status: EmailStatus.SENT,
        timestamp: progress.emailSentAt,
        title: 'Author Contacted',
        description: 'Email sent to paper authors requesting code implementation.',
        details: []
      });
    }

    // Event 3: Final status (if not just "sent" or "not sent")
    if (progress.emailStatus !== EmailStatus.NOT_SENT && progress.emailStatus !== EmailStatus.SENT) {
      eventList.push({
        id: 'final_status',
        type: 'final',
        status: progress.emailStatus,
        timestamp: progress.updatedAt,
        title: getStatusTitle(progress.emailStatus),
        description: getStatusDescription(progress.emailStatus),
        details: progress.githubRepoId ? [
          { label: 'Repository', value: 'Available' }
        ] : []
      });
    }

    return eventList;
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
function getStatusTitle(status: EmailStatus): string {
  switch (status) {
    case EmailStatus.CODE_UPLOADED:
      return 'Code Published';
    case EmailStatus.CODE_NEEDS_REFACTORING:
      return 'Code Needs Work';
    case EmailStatus.REFUSED_TO_UPLOAD:
      return 'Authors Declined';
    case EmailStatus.NO_RESPONSE:
      return 'No Response Received';
    case EmailStatus.RESPONSE_RECEIVED:
      return 'Authors Responded';
    default:
      return status;
  }
}

function getStatusDescription(status: EmailStatus): string {
  switch (status) {
    case EmailStatus.CODE_UPLOADED:
      return 'Authors successfully published their working implementation.';
    case EmailStatus.CODE_NEEDS_REFACTORING:
      return 'Authors shared code but it requires improvements.';
    case EmailStatus.REFUSED_TO_UPLOAD:
      return 'Authors declined to share their implementation.';
    case EmailStatus.NO_RESPONSE:
      return 'No response received from authors after 4 weeks.';
    case EmailStatus.RESPONSE_RECEIVED:
      return 'Authors have responded to the outreach email.';
    default:
      return '';
  }
}
