import React from 'react';
import { Paper, OverallProgressStatusTs } from '../../types/paper'; // Assuming Paper type
import './PaperTabs.css';

interface PaperTabsProps {
    activeTab: string;
    onSelectTab: (tab: string) => void; 
    paper: Paper;
    isAdminView: boolean; 
}

const PaperTabs: React.FC<PaperTabsProps> = ({ 
    activeTab, 
    onSelectTab, 
    paper, 
    isAdminView 
}) => {
    const showImplementationDetailsTab = paper.implementationProgress && 
        paper.implementationProgress.status !== OverallProgressStatusTs.AUTHOR_OUTREACH_PENDING &&
        paper.implementationProgress.status !== OverallProgressStatusTs.AUTHOR_CONTACT_INITIATED &&
        paper.implementationProgress.status !== OverallProgressStatusTs.ROADMAP_DEFINITION;

    return (
        <div className="paper-tabs">
            <button
                className={`tab-button ${activeTab === 'paperInfo' ? 'active' : ''}`}
                onClick={() => onSelectTab('paperInfo')}
            >
                Paper Information
            </button>
            {showImplementationDetailsTab && (
                <button
                    className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => onSelectTab('details')}
                >
                    Implementation Details
                </button>
            )}
            <button
                className={`tab-button ${activeTab === 'upvotes' ? 'active' : ''}`}
                onClick={() => onSelectTab('upvotes')}
            >
                Upvotes ({paper.upvoteCount ?? 0})
            </button>
            <button
                className={`tab-button ${activeTab === 'implementability' ? 'active' : ''}`}
                onClick={() => onSelectTab('implementability')}
            >
                Implementability Votes ({paper.nonImplementableVotes + paper.isImplementableVotes})
            </button>
            {isAdminView && (
                <button
                    className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
                    onClick={() => onSelectTab('admin')}
                >
                    Admin Actions
                </button>
            )}
        </div>
    );
};

export default PaperTabs;