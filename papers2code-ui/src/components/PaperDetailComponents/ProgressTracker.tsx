import React from 'react';
import { ImplementationStep } from '../../types/paper';
import './ProgressTracker.css'; // Add styles

interface ProgressTrackerProps {
  steps: ImplementationStep[];
  paperId: string;
  onStepUpdate: (paperId: string, stepId: number, newStatus: ImplementationStep['status']) => void; // Callback to update status
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ steps, paperId, onStepUpdate }) => {

  // Basic handler - in a real app, you might have dropdowns or confirmation
  const handleStatusChange = (stepId: number, currentStatus: ImplementationStep['status']) => {
    // Simple cycle for demo: pending -> in-progress -> completed -> skipped -> pending
    let nextStatus: ImplementationStep['status'] = 'pending';
    if (currentStatus === 'pending') nextStatus = 'in-progress';
    else if (currentStatus === 'in-progress') nextStatus = 'completed';
    else if (currentStatus === 'completed') nextStatus = 'skipped';
    else if (currentStatus === 'skipped') nextStatus = 'pending';

    onStepUpdate(paperId, stepId, nextStatus);
  };

  return (
    <div className="progress-tracker">
      <h4>Implementation Progress</h4>
      <ul>
        {steps.map((step) => (
          <li key={step.id} className={`step-item status-${step.status}`}>
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