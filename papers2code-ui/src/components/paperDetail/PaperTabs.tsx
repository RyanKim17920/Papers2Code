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

    return (
        <div className="paper-tabs">
            <button
                className={`tab-button ${activeTab === 'paperInfo' ? 'active' : ''}`}
                onClick={() => onSelectTab('paperInfo')}
            >
                Paper Information
            </button>
            {paper.implementationProgress && (
                <button
                    className={`tab-button ${activeTab === 'implementationProgress' ? 'active' : ''}`}
                    onClick={() => onSelectTab('implementationProgress')}
                >
                    Implementation Progress
                </button>
            )}
            <button
                className={`tab-button ${activeTab === 'upvotes' ? 'active' : ''}`}
                onClick={() => onSelectTab('upvotes')}
            >
                Upvotes ({paper.upvoteCount ?? 0})
            </button>
            {!paper.implementationProgress && (
                <button
                    className={`tab-button ${activeTab === 'implementability' ? 'active' : ''}`}
                    onClick={() => onSelectTab('implementability')}
                >
                    Implementability Votes ({paper.nonImplementableVotes + paper.isImplementableVotes})
                </button>
            )}
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