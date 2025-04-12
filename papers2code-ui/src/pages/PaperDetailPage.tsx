// src/pages/PaperDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// Remove imports from samplePapers
// import { fetchPaperById, updateStepStatus, flagPaperImplementability } from '../data/samplePapers';
import { fetchPaperByIdFromApi, updateStepStatusInApi, flagPaperImplementabilityInApi } from '../services/api'; // Import from API service
import { Paper, ImplementationStep } from '../types/paper';
import LoadingSpinner from '../components/LoadingSpinner';
import ProgressTracker from '../components/ProgressTracker';
import './PaperDetailPage.css';

const PaperDetailPage: React.FC = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate(); // Keep navigate if used elsewhere
  const [paper, setPaper] = useState<Paper | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPaper = async () => {
      if (!paperId) {
          setError("No paper ID provided.");
          setIsLoading(false);
          return;
      }
      setIsLoading(true);
      setError(null);
      try {
          // Fetch from the API
          const fetchedPaper = await fetchPaperByIdFromApi(paperId);
          if (fetchedPaper) {
              setPaper(fetchedPaper);
          } else {
              setError("Paper not found.");
          }
      } catch (err) {
          console.error(`Failed to fetch paper ${paperId}:`, err);
          setError(err instanceof Error ? err.message : "Failed to load paper details. Is the backend running?");
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    loadPaper();
  }, [paperId]);

  const handleStepUpdate = async (
    pId: string,
    stepId: number,
    newStatus: ImplementationStep['status']
  ) => {
     // --- Temporarily disable until backend is ready ---
     alert("Updating status via API is not implemented yet.");
     return;
    /*
    try {
        const updatedPaperData = await updateStepStatusInApi(pId, stepId, newStatus);
        if (updatedPaperData) {
            setPaper(updatedPaperData);
        } else {
            console.error("Failed to update step status - no data returned");
            loadPaper(); // Reload to be safe
        }
    } catch (err) {
        console.error("Error updating step status:", err);
        setError(err instanceof Error ? `Failed to update progress: ${err.message}` : "Failed to update progress.");
        loadPaper(); // Revert optimistic update or reload
    }
    */
  };

  const handleToggleImplementability = async () => {
      if (!paper) return;
      // --- Temporarily disable until backend is ready ---
      alert("Updating implementability via API is not implemented yet.");
      return;
     /*
      const newImplementability = !paper.isImplementable;
      try {
          const updatedPaper = await flagPaperImplementabilityInApi(paper.id, newImplementability);
          if (updatedPaper) {
              setPaper(updatedPaper);
          }
      } catch (err) {
          console.error("Error toggling implementability:", err);
          setError(err instanceof Error ? `Failed to update paper status: ${err.message}` : "Failed to update paper status.");
      }
     */
  };

  // --- Rest of the component remains the same (render logic) ---
  if (isLoading) return <LoadingSpinner />;
  // Display specific error message
  if (error) return <p className="error-message">Error: {error} <Link to="/">Go back to list</Link></p>;
  if (!paper) return <p>Paper data could not be loaded.</p>;

  const authors = paper.authors.map(a => a.name).join(', ');

  return (
    <div className="paper-detail-page">
      {/* ... (rest of the JSX rendering - no changes needed here) ... */}
       <Link to="/" className="back-link">Back to List</Link>

        <h2>{paper.title}</h2>

        {!paper.isImplementable && (
            <p className="not-implementable-notice">
                This paper has been marked as likely not suitable for implementation (e.g., theoretical, survey).
            </p>
        )}

        <div className="paper-meta">
            <p><strong>Authors:</strong> {authors}</p>
            <p><strong>Date:</strong> {paper.date}</p> {/* Display formatted date string */}
            {paper.proceeding && <p><strong>Venue:</strong> {paper.proceeding}</p>}
            {paper.arxivId && <p><strong>ArXiv ID:</strong> {paper.arxivId}</p>}
            <p>
                <strong>Links:</strong>{' '}
                {paper.urlAbs && <> <a href={paper.urlAbs} target="_blank" rel="noopener noreferrer">Abstract</a> |</> }
                {paper.urlPdf && <> <a href={paper.urlPdf} target="_blank" rel="noopener noreferrer">PDF</a> |</> }
                {paper.pwcUrl && <a href={paper.pwcUrl} target="_blank" rel="noopener noreferrer">PapersWithCode Page</a>}
            </p>
            {paper.tasks && paper.tasks.length > 0 && (
                  <p><strong>Tasks:</strong> {paper.tasks.join(', ')}</p>
              )}
        </div>

        {paper.abstract && (
          <div className="paper-abstract">
              <h3>Abstract</h3>
              <p>{paper.abstract}</p>
          </div>
        )}

        {paper.isImplementable ? (
            <ProgressTracker
              steps={paper.implementationSteps}
              paperId={paper.id}
              onStepUpdate={handleStepUpdate} // Still uses the (now disabled) handler
            />
        ) : (
            <p>Implementation tracking is disabled as this paper is marked as not implementable.</p>
        )}


        <div className="paper-actions">
            <button onClick={handleToggleImplementability} className="flag-button">
                {paper.isImplementable ? 'Flag as Not Implementable' : 'Mark as Potentially Implementable'}
            </button>
        </div>

    </div>
  );
};

export default PaperDetailPage;