import React from 'react';
import { ImplementationProgress as ImplementationProgressType } from '../../../../common/types/implementation';
import { ImplementationRoadmapView } from './ImplementationStepView';
import './ImplementationProgressTab.css';

interface ImplementationProgressProps {
    progress: ImplementationProgressType;
    onImplementationProgressChange: (updatedProgress: ImplementationProgressType) => void; // Add this for detailed changes from the flow
}

export const ImplementationProgressTab: React.FC<ImplementationProgressProps> = ({ progress, onImplementationProgressChange }) => {
    if (!progress) {
        return <div className="implementation-progress-view"><p>No implementation progress data available.</p></div>;
    }

    return (
        <div className="implementation-progress-view">
            <h2>Implementation Progress</h2>
            <ImplementationRoadmapView 
                implementationProgress={progress} 
                onImplementationProgressChange={onImplementationProgressChange} // Pass it down
            />
            
            {/* TODOs for editing functionality remain for future work */}
        </div>
    );
};
