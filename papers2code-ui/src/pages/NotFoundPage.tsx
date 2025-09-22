import React from 'react';
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

const NotFoundPage: React.FC = () => {
    return (
        <div className="not-found-container">
            <div className="not-found-content">
                <div className="not-found-icon">
                    <div className="error-code">404</div>
                    <div className="error-illustration">
                        <div className="paper-stack">
                            <div className="paper paper-1"></div>
                            <div className="paper paper-2"></div>
                            <div className="paper paper-3"></div>
                        </div>
                        <div className="magnifying-glass">
                            <div className="glass-circle"></div>
                            <div className="glass-handle"></div>
                        </div>
                    </div>
                </div>
                <h1 className="not-found-title">Page Not Found</h1>
                <p className="not-found-description">
                    Looks like this research paper got lost in the digital archives. 
                    Don't worry, there are plenty more discoveries waiting for you!
                </p>
                <div className="not-found-actions">
                    <Link to="/" className="btn btn-primary">
                        Back to Home
                    </Link>
                    <Link to="/papers" className="btn btn-outline-primary">
                        Explore Papers
                    </Link>
                </div>
                <div className="fun-fact">
                    <small>💡 Fun fact: Even Einstein had papers that went missing sometimes!</small>
                </div>
            </div>
        </div>
    );
}

export default NotFoundPage;