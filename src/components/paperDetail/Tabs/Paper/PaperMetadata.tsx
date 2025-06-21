import React from 'react';
import { Paper } from '../../../../common/types/paper'; // Import Status
import './PaperMetadata.css';
import { getStatusClass, getStatusSymbol } from '../../../../common/utils/statusUtils';
interface PaperMetadataProps {
    paper: Paper;
}

const PaperMetadata: React.FC<PaperMetadataProps> = ({ paper }) => {
    // --- Determine Display Status, Class, and Symbol based on paper object ---
    let displayStatus: string = paper.status;
    if (paper.status === 'Not Started' && paper.nonImplementableVotes > 0 && paper.implementabilityStatus === 'Voting') {
        displayStatus = 'Disputed'; // Or 'Community Concern'
    }
    let statusClass = 'status-default'; 
    let statusSymbol = '⏳'; 

    statusClass = getStatusClass(paper); // Pass the whole paper object
    statusSymbol = getStatusSymbol(paper); // Pass the whole paper object
    

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