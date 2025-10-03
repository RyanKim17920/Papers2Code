import React from 'react';
import { ProgressStatus } from '../../../../common/types/implementation';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';
import { Code, Mail, CheckCircle, AlertCircle, XCircle, Clock, GitBranch } from 'lucide-react';

export interface TimelineEventData {
  id: string;
  type: 'initiated' | 'email_sent' | 'response' | 'final';
  status: ProgressStatus;
  timestamp: string;
  title: string;
  description: string;
  details?: {
    label: string;
    value: string;
  }[];
}

interface TimelineEventProps {
  event: TimelineEventData;
  position: number; // Position in percentage (0-100)
  isLast: boolean;
}

export const TimelineEvent: React.FC<TimelineEventProps> = ({ event, position, isLast }) => {
  const getEventIcon = () => {
    switch (event.type) {
      case 'initiated':
        return <Code className="w-4 h-4" />;
      case 'email_sent':
        return <Mail className="w-4 h-4" />;
      case 'response':
        if (event.status === ProgressStatus.CODE_UPLOADED) {
          return <CheckCircle className="w-4 h-4" />;
        } else if (event.status === ProgressStatus.CODE_NEEDS_REFACTORING) {
          return <AlertCircle className="w-4 h-4" />;
        } else if (event.status === ProgressStatus.REFUSED_TO_UPLOAD) {
          return <XCircle className="w-4 h-4" />;
        } else if (event.status === ProgressStatus.NO_RESPONSE) {
          return <Clock className="w-4 h-4" />;
        }
        return <Mail className="w-4 h-4" />;
      case 'final':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Code className="w-4 h-4" />;
    }
  };

  const getEventColor = () => {
    switch (event.status) {
      case ProgressStatus.CODE_UPLOADED:
        return 'bg-green-500 border-green-600 text-white';
      case ProgressStatus.CODE_NEEDS_REFACTORING:
        return 'bg-yellow-500 border-yellow-600 text-white';
      case ProgressStatus.REFUSED_TO_UPLOAD:
      case ProgressStatus.NO_RESPONSE:
        return 'bg-red-500 border-red-600 text-white';
      case ProgressStatus.RESPONSE_RECEIVED:
        return 'bg-blue-500 border-blue-600 text-white';
      case ProgressStatus.STARTED:
        return 'bg-muted border-border text-muted-foreground';
      default:
        return 'bg-primary border-primary text-primary-foreground';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div 
      className="absolute flex flex-col items-center"
      style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
    >
      {/* Connecting line (if not last) */}
      {!isLast && (
        <div 
          className="absolute top-6 left-1/2 h-0.5 bg-border"
          style={{ 
            width: `calc((100vw - 2rem) * ${(100 - position) / 100})`,
            maxWidth: '100%'
          }}
        />
      )}
      
      {/* Event node */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`relative z-10 w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 ${getEventColor()}`}
          >
            {getEventIcon()}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-foreground">{event.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{formatDate(event.timestamp)}</p>
            </div>
            
            <p className="text-sm text-foreground">{event.description}</p>
            
            {event.details && event.details.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                {event.details.map((detail, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{detail.label}:</span>
                    <span className="font-medium text-foreground">{detail.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Date label below */}
      <div className="mt-2 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(event.timestamp)}
      </div>
    </div>
  );
};
