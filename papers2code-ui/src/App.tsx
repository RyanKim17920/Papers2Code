// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import PaperListPage from './pages/PaperListPage';
import PaperDetailPage from './pages/PaperDetailPage';
import logo from './images/papers2codelogo.png';
import { checkCurrentUser, redirectToGitHubLogin, logoutUser, fetchAndStoreCsrfToken } from './services/auth';
import type { UserProfile } from './types/user';
import { UserAvatar } from './components/common';
import { ModalProvider } from './context/ModalContext'; // Import ModalProvider
import LoginPromptModal from './components/common/LoginPromptModal'; // Import LoginPromptModal
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false); // State for dropdown
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for dropdown click outside

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

  // Handle clicking outside of dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  // Handle Logout
  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    localStorage.removeItem('csrfToken'); // Clear token on logout
    setIsDropdownOpen(false); // Close dropdown on logout
  };

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  return (
    <ModalProvider>
      <Router>
        <div className="app-container">
          <header className="app-header">
            <Link to="/" className="logo-link">
              <img src={logo} alt="Papers To Code Community Logo" className="app-logo" />
            </Link>
            <nav className="main-nav">
              <Link to="/papers" className="nav-link">Papers</Link>
              {/* Add other nav links here if needed */}
            </nav>
            <div className="auth-section">
              {authLoading ? (
                <span className="auth-loading">Loading...</span>
              ) : currentUser ? (
                <div className="user-info-container" ref={dropdownRef}>
                  <button onClick={toggleDropdown} className="user-avatar-button">
                    <UserAvatar
                      avatarUrl={currentUser.avatarUrl}
                      username={currentUser.username}
                      className="user-avatar"
                    />
                  </button>
                  {isDropdownOpen && (
                    <div className={`user-dropdown-menu ${isDropdownOpen ? 'open' : ''}`}>
                      <Link to="/profile" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>Profile</Link>
                      <Link to="/settings" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>Settings</Link>
                      <Link to="" onClick={handleLogout} className="dropdown-item">
                        Logout
                      </Link>
                    </div>
                  )}
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
              <Route path="/" element={<LandingPage />} />
              <Route path="/papers" element={<PaperListPage authLoading={authLoading} />} />
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