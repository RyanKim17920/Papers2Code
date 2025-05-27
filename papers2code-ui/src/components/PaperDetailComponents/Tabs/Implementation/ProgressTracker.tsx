import React from 'react';
import { ImplementationStep, ProgressStatus } from '../../../../types/paper'; // Import ProgressStatus
import './ProgressTracker.css'; // Add styles

interface ProgressTrackerProps {
  steps: ImplementationStep[];
  paperId: string;
  onStepUpdate: (paperId: string, stepId: number, newStatus: ProgressStatus) => void; // Use ProgressStatus
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ steps, paperId, onStepUpdate }) => {

  const handleStatusChange = (stepId: number, currentStatus: ProgressStatus) => {
    let nextStatus: ProgressStatus;

    switch (currentStatus) {
      case 'Not Started':
        nextStatus = 'Started';
        break;
      case 'Started':
        nextStatus = 'Work in Progress';
        break;
      case 'Work in Progress':
        nextStatus = 'Completed';
        break;
      case 'Completed':
        nextStatus = 'Not Started'; // Cycle back for demo purposes
        break;
      default:
        nextStatus = 'Not Started'; // Default for any unexpected status
        break;
    }
    onStepUpdate(paperId, stepId, nextStatus);
  };

  return (
    <div className="progress-tracker">
      <h4>Implementation Progress</h4>
      <ul>
        {steps.map((step) => (
          <li key={step.id} className={`step-item status-${step.status.replace(/\s+/g, '-').toLowerCase()}`}>
            <span className="step-name">{step.name}</span>
            <span className="step-description">{step.description}</span>
            <button
                className="step-status-button"
                onClick={() => handleStatusChange(step.id, step.status)}
                title={`Current: ${step.status}. Click to change.`}
            >
              {step.status}
            </button>
             {/* Future: Add details like assigned user, notes link */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProgressTracker;