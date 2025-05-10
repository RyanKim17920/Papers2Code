import React from 'react';
import ProgressTracker from './ProgressTracker'; // Assuming this is correctly pathed
import { Paper } from '../../../../types/paper';

interface DetailsTabProps {
    paper: Paper;
    onStepUpdate: () => Promise<void>; // Function to call when a step is updated
}

const DetailsTab: React.FC<DetailsTabProps> = ({ paper, onStepUpdate }) => {
    return (
        <div className="tab-pane-container">
            <ProgressTracker
                steps={paper.implementationSteps || []}
                paperId={String(paper.id)} // Ensure paperId is a string
                onStepUpdate={onStepUpdate} // Pass the handler
            />
            {paper.implementationNotes && (
                <div className="implementation-notes">
                    <h4>Notes:</h4>
                    <p>{paper.implementationNotes}</p>
                </div>
            )}
            {/* You can add more content specific to the details tab here */}
        </div>
    );
};

export default DetailsTab;
