import React from 'react';
import { Paper } from '../../types/paper'; // Assuming Paper type
import './PaperTabs.css';

interface PaperTabsProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    paper: Paper;
    isOwner: boolean;
}

const PaperTabs: React.FC<PaperTabsProps> = ({ activeTab, setActiveTab, paper, isOwner }) => {
    return (
        <div className="paper-tabs">
            <button
                className={`tab-button ${activeTab === 'paperInfo' ? 'active' : ''}`}
                onClick={() => setActiveTab('paperInfo')}
            >
                Paper Information
            </button>
            <button
                className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
            >
                Implementation Details
            </button>
            <button
                className={`tab-button ${activeTab === 'upvotes' ? 'active' : ''}`}
                onClick={() => setActiveTab('upvotes')}
            >
                Upvotes ({paper.upvoteCount ?? 0})
            </button>
            <button
                className={`tab-button ${activeTab === 'implementability' ? 'active' : ''}`}
                onClick={() => setActiveTab('implementability')}
            >
                Implementability Votes ({paper.nonImplementableVotes + paper.disputeImplementableVotes})
            </button>
            {isOwner && (
                <button
                    className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
                    onClick={() => setActiveTab('admin')}
                >
                    Admin Actions
                </button>
            )}
        </div>
    );
};

export default PaperTabs;