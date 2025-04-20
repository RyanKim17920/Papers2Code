// src/pages/PaperDetailPage.tsx
import React, { useState, useEffect } from 'react';
// Import useNavigate for redirection after delete
import { useParams, Link, useNavigate } from 'react-router-dom'; 
// Import the remove function and fetch function
import { fetchPaperByIdFromApi, removePaperFromApi } from '../services/api'; 
import { Paper, ImplementationStep } from '../types/paper';
// Import UserProfile type
import { UserProfile } from '../services/auth'; 
import LoadingSpinner from '../components/LoadingSpinner';
// Assuming ProgressTracker is in this location based on current code
import ProgressTracker from '../components/PaperDetailComponents/ProgressTracker'; 
import './PaperDetailPage.css';

// Define props to include currentUser
interface PaperDetailPageProps {
    currentUser: UserProfile | null;
}

// Update component definition to accept props
const PaperDetailPage: React.FC<PaperDetailPageProps> = ({ currentUser }) => {
    const { paperId } = useParams<{ paperId: string }>();
    const navigate = useNavigate(); // Hook for navigation after delete
    const [paper, setPaper] = useState<Paper | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null); 
    // Add state for removal process
    const [isRemoving, setIsRemoving] = useState<boolean>(false); 

    // --- Load Paper Logic (Keep as is) ---
    const loadPaper = async () => {
        if (!paperId) {
            setError("No paper ID provided.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        setUpdateError(null);
        setIsRemoving(false); // Reset removal state on load
        try {
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

    // --- handleStepUpdate (Keep simulated version) ---
    const handleStepUpdate = ( 
        pId: string,
        stepId: number,
        newStatus: ImplementationStep['status']
    ) => {
        setUpdateError(null); 
        if (!paper || paper.id !== pId) {
            console.warn("Attempted step update but paper state is null or ID mismatch");
            return;
        }
        const stepIndex = paper.implementationSteps.findIndex(step => step.id === stepId);
        if (stepIndex === -1) {
            console.warn(`Step with ID ${stepId} not found in current paper state.`);
            return; 
        }
        const updatedStep = {
            ...paper.implementationSteps[stepIndex], 
            status: newStatus,                     
            lastUpdatedAt: new Date().toISOString(), 
            lastUpdatedBy: "(Local Change)"          
        };
        const newSteps = paper.implementationSteps.map(step =>
            step.id === stepId ? updatedStep : step 
        );
        const updatedPaper = {
            ...paper, 
            implementationSteps: newSteps 
        };
        setPaper(updatedPaper);
        console.log(`Simulated LOCAL update for paper ${pId}, step ${stepId} to ${newStatus}`);
    };

    // --- handleToggleImplementability (Keep simulated version) ---
    const handleToggleImplementability = () => { 
        if (!paper) return;
        setUpdateError(null);
        const newImplementability = !paper.isImplementable;
        setPaper({
            ...paper,
            isImplementable: newImplementability
        });
        console.log(`Simulated LOCAL toggle implementability to ${newImplementability}`);
    };

    // --- NEW: Handle Paper Removal ---
    const handleRemovePaper = async () => {
        if (!paper || !paperId || !currentUser?.isOwner) {
            console.warn("Remove paper called without necessary permissions or paper data.");
            setUpdateError("Cannot remove paper: Missing permissions or data.");
            return;
        }

        if (!window.confirm(`Are you sure you want to permanently remove the paper "${paper.title}"? This action cannot be undone.`)) {
            return;
        }

        setIsRemoving(true);
        setUpdateError(null);
        setError(null);

        try {
            await removePaperFromApi(paperId);
            console.log(`Paper ${paperId} successfully removed.`);
            // Navigate away after successful removal
            navigate('/', { replace: true, state: { message: 'Paper removed successfully.' } });
        } catch (err) {
            console.error(`Failed to remove paper ${paperId}:`, err);
            setUpdateError(err instanceof Error ? err.message : "Failed to remove paper. Please try again.");
            setIsRemoving(false); // Only reset if removal fails
        }
    };


    // --- Render Logic ---
    if (isLoading && !paper) return <LoadingSpinner />;
    if (error) return <p className="error-message">Error: {error} <Link to="/">Go back to list</Link></p>;
    if (!paper && !isLoading) return <p>Paper data could not be loaded or was not found.</p>;
    if (!paper) return <LoadingSpinner />; // Fallback if still loading or null

    const authors = paper.authors.map(a => a.name).join(', ');

    return (
        <div className="paper-detail-page">
            <div className="paper-content">
                <Link to="/" className="back-link">Back to List</Link>

                {/* Display update/removal errors */}
                {updateError && <p className="error-message update-error">Error: {updateError}</p>}
                {isRemoving && <p className="loading-message">Removing paper...</p>}

                <h2>{paper.title}</h2>

                {!paper.isImplementable && (<p className="not-implementable-notice">This paper has been marked as likely not suitable for implementation (e.g., theoretical, survey).</p>)}
                <div className="paper-meta">
                    <p><strong>Authors:</strong> {authors}</p>
                    <p><strong>Date:</strong> {paper.date}</p> 
                    {paper.proceeding && <p><strong>Venue:</strong> {paper.proceeding}</p>} 
                    {paper.arxivId && <p><strong>ArXiv ID:</strong> {paper.arxivId}</p>}
                    <p><strong>Links:</strong>{' '} 
                        {paper.urlAbs && <><a href={paper.urlAbs} target="_blank" rel="noopener noreferrer">Abstract</a> |</>} 
                        {paper.urlPdf && <><a href={paper.urlPdf} target="_blank" rel="noopener noreferrer">PDF</a> |</>} 
                        {paper.pwcUrl && <a href={paper.pwcUrl} target="_blank" rel="noopener noreferrer">PapersWithCode Page</a>}
                    </p> 
                    {paper.tasks && paper.tasks.length > 0 && (<p><strong>Tasks:</strong> {paper.tasks.join(', ')}</p>)}
                </div>
                {paper.abstract && (<div className="paper-abstract"><h3>Abstract</h3><p>{paper.abstract}</p></div>)}

                {paper.isImplementable ? (
                    <ProgressTracker
                        steps={paper.implementationSteps}
                        paperId={paper.id}
                        onStepUpdate={handleStepUpdate} 
                    />
                ) : (
                    <p>Implementation tracking is disabled as this paper is marked as not implementable.</p>
                )}

                <div className="paper-actions">
                    <button onClick={handleToggleImplementability} className="flag-button">
                        {paper.isImplementable ? 'Flag as Not Implementable' : 'Mark as Potentially Implementable'}
                    </button>
                </div>

                {/* --- NEW: Owner Actions Section --- */}
                {currentUser?.isOwner && (
                    <div className="owner-actions">
                        <h3>Owner Actions</h3>
                        <button
                            onClick={handleRemovePaper}
                            disabled={isRemoving} // Disable button while removal is in progress
                            className="button-danger remove-button" // Add appropriate classes for styling
                        >
                            {isRemoving ? 'Removing...' : 'Remove Paper Permanently'}
                        </button>
                        <p className="warning-text">
                            Warning: Removing a paper moves it to a separate collection and removes it from public view. This action cannot be easily undone.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaperDetailPage;