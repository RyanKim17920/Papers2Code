import React from 'react';
import { Paper } from '../../types/paper'; // Assuming Paper type is defined
import { getStatusClass } from '../../utils/statusUtils'; // Assuming you'll create this
import './PaperMetadata.css';
import { Author } from '../../types/paper';

interface PaperMetadataProps {
    paper: Paper;
}

const PaperMetadata: React.FC<PaperMetadataProps> = ({ paper }) => {
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
                <span className={`status ${getStatusClass(paper.implementationStatus)}`}>
                    {paper.implementationStatus || 'Unknown'}
                </span>
            </p>
            <p>
                <strong>Upvotes:</strong> {paper.upvoteCount}
            </p>
        </div>
    );
};

export default PaperMetadata;