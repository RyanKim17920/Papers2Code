// src/App.tsx
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import PaperListPage from './pages/PaperListPage';
import PaperDetailPage from './pages/PaperDetailPage';
import logo from './assets/images/papers2codelogo.png';
import { checkCurrentUser, redirectToGitHubLogin, logoutUser, fetchAndStoreCsrfToken } from './common/services/auth';
import type { UserProfile } from './common/types/user';
import { UserAvatar } from './common/components';
import AuthInitializer from './common/components/AuthInitializer'; // Import AuthInitializer
import { ModalProvider } from './common/context/ModalContext'; // Import ModalProvider
import LoginPromptModal from './common/components/LoginPromptModal'; // Import LoginPromptModal
import { ErrorBoundary, PaperListErrorBoundary, PaperDetailErrorBoundary } from './common/components/ErrorBoundary';
import { AuthenticationError } from './common/services/api'; // Import AuthenticationError

import ProfilePage from './pages/ProfilePage'; // Added import for ProfilePage
import SettingsPage from './pages/SettingsPage'; // Added import for SettingsPage
import NotFoundPage from './pages/NotFoundPage';
import './App.css';
  
function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false); // State for dropdown
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for dropdown click outside

  // Check login status and fetch CSRF token when the app loads or location changes
  useEffect(() => {
    const initializeApp = async () => {
      setAuthLoading(true);
      await fetchAndStoreCsrfToken(); // Fetch and store the token
      try {
        const user = await checkCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        if (error instanceof AuthenticationError) {
          setCurrentUser(null);
        } else {
          console.error("Error initializing app:", error);
        }
      } finally {
        setAuthLoading(false);
      }
    };
    initializeApp();
  }, [location.pathname]); // Re-run when the path changes

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
  console.log(currentUser);
  return (
    <ModalProvider>
      <AuthInitializer /> {/* Initialize Auth-related hooks here */}
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
                  </button>                  {isDropdownOpen && (
                    <div className={`user-dropdown-menu ${isDropdownOpen ? 'open' : ''}`}>
                      <Link to={`/user/${currentUser.username}`} className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>Profile</Link>
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
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route 
                  path="/papers" 
                  element={
                    <PaperListErrorBoundary>
                      <PaperListPage authLoading={authLoading} />
                    </PaperListErrorBoundary>
                  } 
                />
                <Route
                  path="/paper/:paperId"
                  element={
                    <PaperDetailErrorBoundary>
                      <PaperDetailPage currentUser={currentUser} />
                    </PaperDetailErrorBoundary>
                  }
                />              
                <Route path="/user/:github_username" element={<ProfilePage />} /> {/* Added route for ProfilePage */}
                <Route path="/settings" element={<SettingsPage />} /> {/* Added route for SettingsPage */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ErrorBoundary>
          </main>          
          <LoginPromptModal /> {/* Add LoginPromptModal here so it can be displayed globally */}

          <footer className="app-footer"> 
          </footer>
        </div>
    </ModalProvider>
  );
}


export default App;