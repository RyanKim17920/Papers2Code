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
    const baseStyles = "relative z-10 w-14 h-14 rounded-full border-4 flex items-center justify-center transition-all shadow-lg";
    
    switch (event.state) {
      case 'completed':
        return `${baseStyles} bg-primary border-primary/20 text-primary-foreground hover:scale-110 cursor-pointer`;
      case 'current':
        return `${baseStyles} bg-gradient-to-br from-primary to-primary/80 border-primary/30 text-primary-foreground hover:scale-115 cursor-pointer ring-4 ring-primary/20 animate-pulse`;
      case 'future':
        return `${baseStyles} bg-muted/50 border-muted-foreground/20 text-muted-foreground/50 hover:bg-muted/70 hover:text-muted-foreground/70 cursor-help`;
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
      {/* Event node */}
      <div className="relative">
        <div className={getNodeStyles()}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      
      {/* Tooltip with arrow/stem */}
      {isHovered && (
        <>
          {/* Arrow/stem pointing to the node */}
          <div 
            className="absolute w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-popover z-40"
            style={{ 
              top: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
          
          <div 
            className="absolute top-[68px] w-80 bg-popover border-2 border-border rounded-xl shadow-2xl p-5 z-50 animate-in fade-in-0 zoom-in-95 duration-200"
            style={{ 
              pointerEvents: 'none',
              left: position < 30 ? '0' : position > 70 ? 'auto' : '50%',
              right: position > 70 ? '0' : 'auto',
              transform: position >= 30 && position <= 70 ? 'translateX(-50%)' : 'none'
            }}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-base text-foreground">{event.title}</h4>
                  {!event.isFuture && (
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{formatDate(event.timestamp)}</p>
                  )}
                  {event.isFuture && (
                    <p className="text-xs text-muted-foreground mt-1 italic">Not yet reached</p>
                  )}
                </div>
                <div className={`ml-3 p-2 rounded-lg ${event.state === 'completed' ? 'bg-primary/10' : event.state === 'current' ? 'bg-primary/20' : 'bg-muted'}`}>
                  <Icon className={`w-5 h-5 ${event.state === 'future' ? 'text-muted-foreground/50' : 'text-primary'}`} />
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
              
              {event.details && event.details.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border/50">
                  {event.details.map((detail, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">{detail.label}</span>
                      <span className="font-semibold text-foreground bg-muted/50 px-2 py-1 rounded">{detail.value}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {event.isFuture && (
                <div className="pt-2 mt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground italic">
                    This step will be completed as the implementation progresses.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Label below */}
      <div className={`mt-3 text-xs whitespace-nowrap font-semibold transition-colors ${
        event.state === 'future' 
          ? 'text-muted-foreground/60' 
          : event.state === 'current'
          ? 'text-primary'
          : 'text-foreground'
      }`}>
        {event.title}
      </div>
      
      {!event.isFuture && (
        <div className="mt-1 text-[10px] text-muted-foreground whitespace-nowrap">
          {formatDate(event.timestamp)}
        </div>
      )}
    </div>
  );
};
