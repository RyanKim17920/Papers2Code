import React from 'react';
import type { Paper } from '@/common/types/paper';
import { getStatusClass } from '@/common/utils/statusUtils';
import '@/components/paperList/PaperCard.css';

interface StatusBadgeProps {
  paper: Paper;
  className?: string;
  hideIfUnknown?: boolean;
}

/**
 * Unified status badge without emojis or forced uppercase.
 * Relies on existing status-* classes produced by getStatusClass.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ paper, className = '', hideIfUnknown }) => {
  const statusClass = getStatusClass(paper);
  if (hideIfUnknown && statusClass === 'status-unknown') return null;
  return (
    <span
      className={`status normal-case ${statusClass} ${className}`.trim()}
      style={{ textTransform: 'none', letterSpacing: 0 }}
    >
      <span className="status-text">{paper.status}</span>
    </span>
  );
};

export default StatusBadge;
