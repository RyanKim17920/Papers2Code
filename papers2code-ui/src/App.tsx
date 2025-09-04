// src/App.tsx

// 1. Import QueryClient and QueryClientProvider
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const PaperListPage = lazy(() => import('@/pages/PaperListPage'));
const PaperDetailPage = lazy(() => import('@/pages/PaperDetailPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
import { checkCurrentUser, redirectToGitHubLogin, logoutUser, fetchAndStoreCsrfToken } from '@/common/services/auth';
import type { UserProfile } from '@/common/types/user';
import { UserAvatar } from '@/common/components';
import AuthInitializer from '@/common/components/AuthInitializer';
import { ModalProvider } from '@/common/context/ModalContext';
import LoginPromptModal from '@/common/components/LoginPromptModal';
import { ErrorBoundary, PaperListErrorBoundary, PaperDetailErrorBoundary } from '@/common/components/ErrorBoundary';
import { AuthenticationError } from '@/common/services/api';
import GlobalHeader from '@/components/common/GlobalHeader';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
import '@/App.css';

// 2. Create a new instance of the QueryClient
// This is done outside the component to prevent it from being recreated on every render.
const queryClient = new QueryClient();
  
function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // ... (rest of your existing useEffect and handler functions remain the same)
  useEffect(() => {
    const initializeApp = async () => {
      setAuthLoading(true);
      await fetchAndStoreCsrfToken();
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
  }, [location.pathname]);

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

  if (authLoading) {
    return null;
  }

  if (currentUser && location.pathname === "/") {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    localStorage.removeItem('csrfToken');
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  
  const authSection = (
    <>
      <nav className="main-nav">
        <Link to="/papers" className="nav-link">Papers</Link>
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
                <Link to="/dashboard" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>Dashboard</Link>
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
    </>
  );

  // 3. Wrap your existing providers and components with QueryClientProvider
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <AuthInitializer />
          <div className="app-container">
            <GlobalHeader 
              currentUser={currentUser}
              authSection={authSection}
            />
            <main className="app-main">
              <ErrorBoundary>
                <Suspense fallback={null}>
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
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/user/:github_username" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>          
            <LoginPromptModal />

            <footer className="app-footer"> 
            </footer>
          </div>
      </ModalProvider>
    </QueryClientProvider>
  );
}

export default App;