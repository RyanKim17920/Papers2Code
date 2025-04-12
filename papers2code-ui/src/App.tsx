// src/App.tsx
import React, { useState, useEffect } from 'react'; // Add useState, useEffect
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PaperListPage from './pages/PaperListPage';
import PaperDetailPage from './pages/PaperDetailPage';
import logo from './images/papers2codelogo.png';
import { UserProfile, checkCurrentUser, redirectToGitHubLogin, logoutUser } from './services/auth'; // Import auth functions/types
import './App.css';

function App() {
  // State to hold user info and loading status
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true); // Track initial auth check

  // Check login status when the app loads
  useEffect(() => {
    const verifyUser = async () => {
      setAuthLoading(true);
      const user = await checkCurrentUser();
      setCurrentUser(user);
      setAuthLoading(false);
    };
    verifyUser();
  }, []); // Run only once on initial mount

  // Handle Logout
  const handleLogout = async () => {
    await logoutUser(); // Call API to clear backend session
    setCurrentUser(null); // Clear frontend state
  };

  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <Link to="/" className="logo-link">
            <img src={logo} alt="Papers To Code Community Logo" className="app-logo" />
          </Link>
          <nav className="main-nav"> {/* Wrap nav elements */}
            {/* Add other nav links here if needed */}
          </nav>
          <div className="auth-section"> {/* Section for auth button/info */}
            {authLoading ? (
              <span className="auth-loading">Loading...</span>
            ) : currentUser ? (
              // Logged In State
              <div className="user-info">
                {currentUser.avatar_url && (
                  <img
                    src={currentUser.avatar_url}
                    alt={`${currentUser.username}'s avatar`}
                    className="user-avatar"
                  />
                )}
                <span className="username">{currentUser.username}</span>
                <button onClick={handleLogout} className="auth-button logout-button">
                  Logout
                </button>
              </div>
            ) : (
              // Logged Out State
              <button onClick={redirectToGitHubLogin} className="auth-button connect-button">
                Connect with GitHub
              </button>
            )}
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<PaperListPage />} />
            <Route path="/paper/:paperId" element={<PaperDetailPage />} />
            {/* Note: No /auth/callback route needed on frontend if backend redirects home */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>© {new Date().getFullYear()} Papers2Code Community. Data sourced from PapersWithCode.</p>
        </footer>
      </div>
    </Router>
  );
}

// Simple 404 component (keep as is)
const NotFoundPage: React.FC = () => {
    // ... (no changes) ...
    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2>404 - Page Not Found</h2>
            <p>Sorry, the page you are looking for does not exist.</p>
            <Link to="/">Go back to the homepage</Link>
        </div>
    );
}

export default App;