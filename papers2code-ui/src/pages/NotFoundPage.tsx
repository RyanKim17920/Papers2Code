import React from 'react';
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

const NotFoundPage: React.FC = () => {
    return (
        <div className="not-found-container">
            <div className="not-found-content">
                <div className="not-found-animation">
                    <div className="error-code">404</div>
                    <div className="error-icon">📄</div>
                </div>
                <div className="not-found-text">
                    <h1>Page Not Found</h1>
                    <p>The page you're looking for seems to have wandered off into the research void.</p>
                    <p className="sub-text">Don't worry, even the best papers sometimes get lost in citation loops.</p>
                </div>
                <div className="not-found-actions">
                    <Link to="/" className="home-button">
                        Return to Homepage
                    </Link>
                    <Link to="/papers" className="papers-button">
                        Browse Papers
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default NotFoundPage;