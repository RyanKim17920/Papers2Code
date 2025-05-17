import React from 'react';
import { Paper, ImplementationStatus } from '../../../../types/paper'; // Import ImplementationStatus
import './PaperMetadata.css';
import { Author } from '../../../../types/paper';
interface PaperMetadataProps {
    paper: Paper;
}

const PaperMetadata: React.FC<PaperMetadataProps> = ({ paper }) => {
    // --- Determine Display Status, Class, and Symbol (mimicking PaperCard.tsx) ---
    let displayStatus: string | null | undefined = paper.implementationStatus;
    let statusClass = 'status-default'; // Default class
    let statusSymbol = '⏳'; // Default symbol, often for 'Not Started' or undefined states

    if (paper.nonImplementableStatus === 'confirmed_non_implementable') {
        displayStatus = ImplementationStatus.ConfirmedNonImplementable;
        statusClass = 'status-non-implementable';
        statusSymbol = '🚫';
    } else if (paper.implementationStatus === ImplementationStatus.Completed) {
        displayStatus = ImplementationStatus.Completed;
        statusClass = 'status-completed';
        statusSymbol = '✅';
    } else if (paper.implementationStatus === ImplementationStatus.ImplementationInProgress) {
        displayStatus = ImplementationStatus.ImplementationInProgress;
        statusClass = 'status-in-progress';
        statusSymbol = '🚧';
    } else if (paper.implementationStatus === ImplementationStatus.NeedsCode) {
        // displayStatus is already paper.implementationStatus (e.g., "Needs Code")
        statusClass = 'status-needs-code'; // Specific class for NeedsCode
        statusSymbol = '❓'; // Specific symbol for NeedsCode
    }

    return (
        <div className="paper-meta">
            <p>
                <strong>Authors:</strong> {paper.authors?.map((a: Author) => a.name).join(', ') || 'N/A'}
            </p>
            <p>
                <strong>Date:</strong> {paper.date ? new Date(paper.date).toLocaleDateString() : 'N/A'}
                {paper.proceeding && <span> | <strong>Proceeding:</strong> {paper.proceeding}</span>}
            </p>
            {paper.arxivId && <p><strong>ArXiv ID:</strong> {paper.arxivId}</p>}
            <p>
                {paper.urlAbs && <a href={paper.urlAbs} target="_blank" rel="noopener noreferrer">Abstract Link</a>}
                {paper.urlPdf && <> | <a href={paper.urlPdf} target="_blank" rel="noopener noreferrer">PDF Link</a></>}
                {paper.pwcUrl && <> | <a href={paper.pwcUrl} target="_blank" rel="noopener noreferrer">PapersWithCode</a></>}
            </p>
            {paper.tasks && paper.tasks.length > 0 && (<p><strong>Tasks:</strong> {paper.tasks.join(', ')}</p>)}
            <p>
                <strong>Status:</strong>
                <span className={`status ${statusClass}`}>
                    <span className="status-symbol">{statusSymbol}</span>
                    {displayStatus || 'Unknown'}
                </span>
            </p>
            <p>
                <strong>Upvotes:</strong> {paper.upvoteCount}
            </p>
        </div>
    );
};

export default PaperMetadata;