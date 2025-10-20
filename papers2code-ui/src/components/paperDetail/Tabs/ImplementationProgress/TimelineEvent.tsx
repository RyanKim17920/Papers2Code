import React, { useState } from 'react';
import { ProgressStatus } from '../../../../common/types/implementation';
import { LucideIcon } from 'lucide-react';

export interface TimelineEventData {
  id: string;
  type: string;
  status: ProgressStatus;
  timestamp: string;
  title: string;
  description: string;
  icon: LucideIcon;
  state: 'completed' | 'current' | 'future';
  isFuture?: boolean;
  isClickable?: boolean;
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
  const Icon = event.icon;

  const getNodeStyles = () => {
    const baseStyles = "relative z-10 w-12 h-12 rounded-full border-3 flex items-center justify-center transition-all duration-300 ease-out shadow-md";
    
    switch (event.state) {
      case 'completed':
        return `${baseStyles} bg-primary border-primary/20 text-primary-foreground hover:scale-105 cursor-pointer`;
      case 'current':
        return `${baseStyles} bg-gradient-to-br from-primary to-primary/80 border-primary/30 text-primary-foreground hover:scale-105 cursor-pointer ring-3 ring-primary/20`;
      case 'future':
        return `${baseStyles} bg-muted/50 border-muted-foreground/20 text-muted-foreground/50 hover:bg-muted/60 hover:text-muted-foreground/60 cursor-help`;
      default:
        return baseStyles;
    }
  };

  const formatDate = (dateString: string) => {
    if (event.isFuture) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div 
      className="absolute flex flex-col items-center group"
      style={{ 
        left: `${position}%`, 
        transform: 'translateX(-50%)',
        top: 0
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Event node - positioned so its center aligns with the timeline */}
      <div className="relative flex items-center justify-center" style={{ height: '48px' }}>
        <div className={getNodeStyles()}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      {/* Tooltip - positioned above the node to prevent scrolling */}
      {isHovered && (
        <div 
          className="fixed z-[100] w-72 bg-popover border border-border rounded-lg shadow-xl p-4 animate-in fade-in-0 zoom-in-95 duration-300"
          style={{ 
            // Position above the cursor to prevent modal scroll issues
            bottom: '50%',
            left: position < 30 ? `${position + 5}%` : position > 70 ? `${position - 20}%` : `${position}%`,
            transform: position >= 30 && position <= 70 ? 'translate(-50%, -50%)' : 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-bold text-sm text-foreground">{event.title}</h4>
                {!event.isFuture && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{formatDate(event.timestamp)}</p>
                )}
                {event.isFuture && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 italic">Not yet reached</p>
                )}
              </div>
              <div className={`ml-2 p-1.5 rounded-lg ${event.state === 'completed' ? 'bg-primary/10' : event.state === 'current' ? 'bg-primary/20' : 'bg-muted'}`}>
                <Icon className={`w-4 h-4 ${event.state === 'future' ? 'text-muted-foreground/50' : 'text-primary'}`} />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
            
            {event.details && event.details.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                {event.details.map((detail, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <span className="text-muted-foreground font-medium">{detail.label}</span>
                    <span className="font-semibold text-foreground bg-muted/50 px-1.5 py-0.5 rounded">{detail.value}</span>
                  </div>
                ))}
              </div>
            )}
            
            {event.isFuture && (
              <div className="pt-1.5 mt-1.5 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground italic">
                  This step will be completed as the implementation progresses.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Label below */}
      <div className={`mt-2 text-[10px] whitespace-nowrap font-semibold transition-colors ${
        event.state === 'future' 
          ? 'text-muted-foreground/60' 
          : event.state === 'current'
          ? 'text-primary'
          : 'text-foreground'
      }`}>
        {event.title}
      </div>
      
      {!event.isFuture && (
        <div className="mt-0.5 text-[9px] text-muted-foreground whitespace-nowrap">
          {formatDate(event.timestamp)}
        </div>
      )}
    </div>
  );
};
