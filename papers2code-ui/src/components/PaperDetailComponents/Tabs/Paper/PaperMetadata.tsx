import React from 'react';
import { Paper, Status } from '../../../../types/paper'; // Import Status
import './PaperMetadata.css';
interface PaperMetadataProps {
    paper: Paper;
}

const PaperMetadata: React.FC<PaperMetadataProps> = ({ paper }) => {
    // --- Determine Display Status, Class, and Symbol based on paper.status ---
    const displayStatus: Status = paper.status;
    let statusClass = 'status-default'; 
    let statusSymbol = '⏳'; 

    switch (paper.status) {
        case 'Not Implementable':
            statusClass = 'status-non-implementable';
            statusSymbol = '🚫';
            break;
        case 'Completed':
            statusClass = 'status-completed';
            statusSymbol = '✅';
            break;
        case 'Work in Progress':
            statusClass = 'status-in-progress';
            statusSymbol = '🚧';
            break;
        case 'Not Started':
            statusClass = 'status-needs-code'; 
            statusSymbol = '⏳';
            break;
        case 'Started':
            statusClass = 'status-started'; 
            statusSymbol = '🛠️'; 
            break;
        case 'Waiting for Author Response':
            statusClass = 'status-waiting';
            statusSymbol = '💬'; 
            break;
        case 'Official Code Posted':
            statusClass = 'status-official-code';
            statusSymbol = '🎉'; 
            break;
        // No default needed as paper.status should always be a valid Status type
    }

    return (
        <div className="paper-meta">
            <p>
                <strong>Authors:</strong> {paper.authors?.join(', ') || 'N/A'}
            </p>
            <p>
                <strong>Date:</strong> {paper.publicationDate ? new Date(paper.publicationDate).toLocaleDateString() : 'N/A'}
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
                    {displayStatus}
                </span>
            </p>
            <p>
                <strong>Upvotes:</strong> {paper.upvoteCount}
            </p>
        </div>
    );
};

export default PaperMetadata;