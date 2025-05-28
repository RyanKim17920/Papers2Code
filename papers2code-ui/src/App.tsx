// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PaperListPage from './pages/PaperListPage';
import PaperDetailPage from './pages/PaperDetailPage';
import logo from './images/papers2codelogo.png';
import { UserProfile, checkCurrentUser, redirectToGitHubLogin, logoutUser, fetchAndStoreCsrfToken } from './services/auth';
import UserAvatar from './components/UserAvatar'; // Import the UserAvatar component
import { ModalProvider } from './context/ModalContext'; // Import ModalProvider
import LoginPromptModal from './components/common/LoginPromptModal'; // Import LoginPromptModal
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Check login status and fetch CSRF token when the app loads
  useEffect(() => {
    const initializeApp = async () => {
      setAuthLoading(true);
      await fetchAndStoreCsrfToken(); // Fetch and store the token
      const user = await checkCurrentUser();
      setCurrentUser(user);
      setAuthLoading(false);
    };
    initializeApp();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    localStorage.removeItem('csrfToken'); // Clear token on logout
  };

  return (
    <ModalProvider>
      <Router>
        <div className="app-container">
          <header className="app-header">
            <Link to="/" className="logo-link">
              <img src={logo} alt="Papers To Code Community Logo" className="app-logo" />
            </Link>
            <nav className="main-nav">
              {/* Add other nav links here if needed */}
            </nav>
            <div className="auth-section">
              {authLoading ? (
                <span className="auth-loading">Loading...</span>
              ) : currentUser ? (
                <div className="user-info">
                  <UserAvatar
                    avatarUrl={currentUser.avatarUrl}
                    username={currentUser.username}
                    className="user-avatar" // This class is defined in UserAvatar.css
                  />
                  <span className="username">{currentUser.username}</span>
                  <button onClick={handleLogout} className="auth-button logout-button">
                    Logout
                  </button>
                </div>
              ) : (
                <button onClick={redirectToGitHubLogin} className="auth-button connect-button">
                  Connect with GitHub
                </button>
              )}
            </div>
          </header>

          <main className="app-main">
            <Routes>
              <Route path="/" element={<PaperListPage authLoading={authLoading} />} />
              <Route
                path="/paper/:paperId"
                element={<PaperDetailPage currentUser={currentUser} />}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>

          <LoginPromptModal /> {/* Add LoginPromptModal here so it can be displayed globally */}

          <footer className="app-footer">
            <p>© {new Date().getFullYear()} Papers2Code Community. Data sourced from PapersWithCode.</p>
          </footer>
        </div>
      </Router>
    </ModalProvider>
  );
}

const NotFoundPage: React.FC = () => {
    return (
        <div style={{ textAlign: 'center', marginTop: '50px', width: '100vw' }}>
            <h1>404 - Page Not Found</h1>
            <p>Sorry, the page you are looking for does not exist.</p>
            <Link to="/">Go back to the homepage</Link>
        </div>
    );
}

export default App;