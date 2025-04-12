// src/pages/PaperDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom'; // Removed useNavigate as it wasn't used here
import { fetchPaperByIdFromApi /* Remove updateStepStatusInApi if only simulating */ } from '../services/api'; // Removed unused API imports for clarity
import { Paper, ImplementationStep } from '../types/paper';
import LoadingSpinner from '../components/LoadingSpinner';
import ProgressTracker from '../components/ProgressTracker';
import './PaperDetailPage.css';

const PaperDetailPage: React.FC = () => {
    const { paperId } = useParams<{ paperId: string }>();
    // const navigate = useNavigate(); // Keep if needed elsewhere, otherwise remove
    const [paper, setPaper] = useState<Paper | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null); // Keep for potential future use

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

    // --- MODIFIED: handleStepUpdate for LOCAL state change only ---
    const handleStepUpdate = ( // No longer async
        pId: string,
        stepId: number,
        newStatus: ImplementationStep['status']
    ) => {
        // --- Simulate Frontend Update Only ---
        setUpdateError(null); // Clear any previous errors

        if (!paper || paper.id !== pId) {
            console.warn("Attempted step update but paper state is null or ID mismatch");
            // Optionally set an error: setUpdateError("Cannot update: Paper data not loaded correctly.");
            return;
        }

        // Find the index of the step to update immutably
        const stepIndex = paper.implementationSteps.findIndex(step => step.id === stepId);

        if (stepIndex === -1) {
            console.warn(`Step with ID ${stepId} not found in current paper state.`);
            // Optionally set an error: setUpdateError(`Cannot update: Step ${stepId} not found.`);
            return; // Step not found, do nothing
        }

        // Create the updated step object immutably
        const updatedStep = {
            ...paper.implementationSteps[stepIndex], // Copy existing properties
            status: newStatus,                     // Set the new status
            // Add simulated attribution fields for visual feedback
            lastUpdatedAt: new Date().toISOString(), // Simulate a timestamp
            lastUpdatedBy: "(Local Change)"          // Indicate it's local
        };

        // Create the new steps array immutably
        const newSteps = paper.implementationSteps.map(step =>
            step.id === stepId ? updatedStep : step // Replace the specific step
        );

        // Create the new paper object immutably
        const updatedPaper = {
            ...paper, // Copy existing paper properties
            implementationSteps: newSteps // Use the new steps array
            // --- Optional: Update overall paper status based on newSteps ---
            // This logic would depend on your rules (e.g., if all complete -> 'Completed')
            // implementationStatus: calculateOverallStatus(newSteps),
        };

        // Update the local state to re-render the component
        setPaper(updatedPaper);

        console.log(`Simulated LOCAL update for paper ${pId}, step ${stepId} to ${newStatus}`);

        // --- Backend API call is intentionally skipped ---
    };

    // --- handleToggleImplementability (Keep disabled/simulated if needed) ---
    const handleToggleImplementability = () => { // Removed async
        if (!paper) return;

        // Simulate frontend update only
        setUpdateError(null);
        const newImplementability = !paper.isImplementable;
        setPaper({
            ...paper,
            isImplementable: newImplementability
            // Maybe reset steps if marking as not implementable?
            // implementationSteps: newImplementability ? paper.implementationSteps : paper.implementationSteps.map(s => ({...s, status: 'skipped'}))
        });
        console.log(`Simulated LOCAL toggle implementability to ${newImplementability}`);
        // alert("Updating implementability via API is not implemented yet.");
    };

    // --- Render Logic ---
    if (isLoading && !paper) return <LoadingSpinner />;
    if (error) return <p className="error-message">Error: {error} <Link to="/">Go back to list</Link></p>;
    // Added check for finished loading but paper still null
    if (!paper && !isLoading) return <p>Paper data could not be loaded or was not found.</p>;
    // If paper is still null after checks (shouldn't happen often) show loading
    if (!paper) return <LoadingSpinner />;

    const authors = paper.authors.map(a => a.name).join(', ');

    return (
        <div className="paper-detail-page">
            <Link to="/" className="back-link">Back to List</Link>

            {/* Display update error if it occurs during simulation (e.g., step not found) */}
            {updateError && <p className="error-message update-error">Update Error: {updateError}</p>}

            <h2>{paper.title}</h2>

            {/* ... (rest of meta, abstract rendering - no changes) ... */}
            {!paper.isImplementable && (<p className="not-implementable-notice">This paper has been marked as likely not suitable for implementation (e.g., theoretical, survey).</p>)}
            <div className="paper-meta"><p><strong>Authors:</strong> {authors}</p><p><strong>Date:</strong> {paper.date}</p> {paper.proceeding && <p><strong>Venue:</strong> {paper.proceeding}</p>} {paper.arxivId && <p><strong>ArXiv ID:</strong> {paper.arxivId}</p>}<p><strong>Links:</strong>{' '} {paper.urlAbs && <><a href={paper.urlAbs} target="_blank" rel="noopener noreferrer">Abstract</a> |</>} {paper.urlPdf && <><a href={paper.urlPdf} target="_blank" rel="noopener noreferrer">PDF</a> |</>} {paper.pwcUrl && <a href={paper.pwcUrl} target="_blank" rel="noopener noreferrer">PapersWithCode Page</a>}</p> {paper.tasks && paper.tasks.length > 0 && (<p><strong>Tasks:</strong> {paper.tasks.join(', ')}</p>)}</div>
            {paper.abstract && (<div className="paper-abstract"><h3>Abstract</h3><p>{paper.abstract}</p></div>)}

            {paper.isImplementable ? (
                <ProgressTracker
                    steps={paper.implementationSteps}
                    paperId={paper.id}
                    onStepUpdate={handleStepUpdate} // Uses the modified local handler
                />
            ) : (
                <p>Implementation tracking is disabled as this paper is marked as not implementable.</p>
            )}

            <div className="paper-actions">
                {/* Also simulate the implementability toggle */}
                <button onClick={handleToggleImplementability} className="flag-button">
                    {paper.isImplementable ? 'Flag as Not Implementable' : 'Mark as Potentially Implementable'}
                </button>
            </div>

        </div>
    );
};

export default PaperDetailPage;