import React from 'react';
import {
  ImplementationProgress,
  OverallProgressStatusTs,
  // ImplementationSection, // No longer directly used here
  // ImplementationComponent // No longer directly used here
} from '../../../../types/paper';
// import ImplementationFlow from './ImplementationFlow'; // REMOVED
import ProgressTracker from './ProgressTracker'; // RENAMED

interface ImplementationRoadmapViewProps {
  implementationProgress: ImplementationProgress;
  onImplementationProgressChange: (updatedProgress: ImplementationProgress) => void;
}

export const ImplementationRoadmapView: React.FC<ImplementationRoadmapViewProps> = ({ implementationProgress, onImplementationProgressChange }) => {
  const { implementationRoadmap, status: overallStatus } = implementationProgress;

  // The complex handleNodeDataChange is removed. 
  // Logic for updates will be handled within EnhancedProgressTracker and its children,
  // which will then call onImplementationProgressChange with the modified ImplementationProgress object.

  return (
    <div className="implementation-roadmap-view p-3">
      {!implementationRoadmap || implementationRoadmap.sections === undefined || implementationRoadmap.sections.length === 0 ? (
        <div className="alert alert-warning mt-3" role="alert">
          <h5 className="alert-heading">Roadmap Not Yet Defined</h5>
          <p>The detailed implementation roadmap is not yet available for display.</p>
          {overallStatus === OverallProgressStatusTs.ROADMAP_DEFINITION && (
            <p className="mb-0">The process is currently in the '<strong>{OverallProgressStatusTs.ROADMAP_DEFINITION}</strong>' phase. The roadmap details should appear here soon.</p>
          )}
          {overallStatus !== OverallProgressStatusTs.ROADMAP_DEFINITION &&
           overallStatus !== OverallProgressStatusTs.JUST_CREATED && (
             <p className="mb-0">Please check back later. If you are a contributor, ensure the roadmap has been populated in the system.</p>
           )}
        </div>
      ) : (
        <ProgressTracker 
          implementationProgress={implementationProgress} 
          onImplementationProgressChange={onImplementationProgressChange} 
        />
      )}
    </div>
  );
};
