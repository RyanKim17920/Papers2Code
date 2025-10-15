import React, { useState } from 'react';
import { ProgressStatus } from '../../../../common/types/implementation';
import { Code, Mail, CheckCircle, AlertCircle, XCircle, Clock, GitBranch, UserPlus } from 'lucide-react';

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
  const [isHovered, setIsHovered] = useState(false);

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
    // Use consistent color scheme matching statusUtils
    switch (event.type) {
      case 'initiated':
        // Cyan for started/initiated - matches 'Started' status
        return 'bg-cyan-500 border-cyan-600 text-white hover:bg-cyan-600 shadow-cyan-500/20';
      case 'email_sent':
        // Amber/Yellow for waiting - matches 'Waiting for Author Response'
        return 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600 shadow-amber-500/20';
      case 'response':
        if (event.status === ProgressStatus.CODE_UPLOADED) {
          // Green for completed/uploaded - matches 'Completed'
          return 'bg-green-500 border-green-600 text-white hover:bg-green-600 shadow-green-500/20';
        } else if (event.status === ProgressStatus.CODE_NEEDS_REFACTORING) {
          // Orange for needs work - matches 'Code Needs Refactoring'
          return 'bg-orange-500 border-orange-600 text-white hover:bg-orange-600 shadow-orange-500/20';
        } else if (event.status === ProgressStatus.REFUSED_TO_UPLOAD || event.status === ProgressStatus.NO_RESPONSE) {
          // Red for negative responses
          return 'bg-red-500 border-red-600 text-white hover:bg-red-600 shadow-red-500/20';
        }
        // Blue for in progress - matches 'In Progress'
        return 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600 shadow-blue-500/20';
      case 'final':
        // Green for final completion
        return 'bg-green-500 border-green-600 text-white hover:bg-green-600 shadow-green-500/20';
      default:
        return 'bg-gray-500 border-gray-600 text-white hover:bg-gray-600 shadow-gray-500/20';
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
      style={{ 
        left: `${position}%`, 
        transform: 'translateX(-50%)',
        top: 0
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Event node - positioned so the timeline line goes through the center */}
      <div className="relative">
        <div
          className={`relative z-10 w-12 h-12 rounded-full border-4 border-background flex items-center justify-center transition-all cursor-pointer shadow-md ${getEventColor()}`}
          style={{
            transform: isHovered ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          {getEventIcon()}
        </div>
      </div>
      
      {/* Hover tooltip - positioned to avoid overflow */}
      {isHovered && (
        <div 
          className="absolute top-16 w-72 bg-popover border border-border rounded-lg shadow-xl p-4 z-50 animate-in fade-in-0 zoom-in-95"
          style={{ 
            pointerEvents: 'none',
            left: position < 30 ? '0' : position > 70 ? 'auto' : '50%',
            right: position > 70 ? '0' : 'auto',
            transform: position >= 30 && position <= 70 ? 'translateX(-50%)' : 'none'
          }}
        >
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-foreground">{event.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{formatDate(event.timestamp)}</p>
            </div>
            
            <p className="text-sm text-foreground leading-relaxed">{event.description}</p>
            
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
        </div>
      )}
      
      {/* Date label below */}
      <div className="mt-2 text-xs text-muted-foreground whitespace-nowrap font-medium">
        {formatDate(event.timestamp)}
      </div>
    </div>
  );
};
