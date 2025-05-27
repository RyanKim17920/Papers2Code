import React from 'react';
import './PaperAbstract.css';

interface PaperAbstractProps {
    abstract: string | null | undefined;
}

const PaperAbstract: React.FC<PaperAbstractProps> = ({ abstract }) => {
    return (
        <div className="paper-abstract">
            <h3>Abstract</h3>
            <p>{abstract || 'Abstract not available.'}</p>
        </div>
    );
};

export default PaperAbstract;