import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/images/papers2codelogo.png';
import type { UserProfile } from '../../common/types/user';
import './GlobalHeader.css';

interface GlobalHeaderProps {
  showSearch?: boolean;
  currentUser?: UserProfile | null;
  authSection?: React.ReactNode;
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  showSearch = true,
  currentUser,
  authSection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/papers?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/papers');
    }
  };

  // Add keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="global-header">
      <div className="header-content">
        <div className="header-left">
          <Link to={currentUser ? "/dashboard" : "/"} className="logo-link">
            <img src={logo} alt="Papers2Code" className="header-logo" />
          </Link>
        </div>
        
        {showSearch && (
          <div className="header-center">
            <form onSubmit={handleSearchSubmit} className="global-search-form">
              <div className="global-search-container">
                <div className="search-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search papers, authors, conferences..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="global-search-input"
                />
                <div className="search-shortcut">
                  <kbd>⌘K</kbd>
                </div>
                <button type="submit" className="global-search-button">
                  Search
                </button>
              </div>
            </form>
          </div>
        )}
        
        <div className="header-right">
          {authSection}
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;
