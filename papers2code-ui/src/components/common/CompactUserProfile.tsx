import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserAvatar } from '../../common/components';
import type { UserProfile } from '../../common/types/user';
import { logoutUser } from '../../common/services/auth';
import './CompactUserProfile.css';

interface CompactUserProfileProps {
  user: UserProfile;
  onLogout?: () => void;
}

const CompactUserProfile: React.FC<CompactUserProfileProps> = ({ user, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      if (onLogout) {
        onLogout();
      }
      navigate('/papers');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="compact-user-profile" ref={dropdownRef}>
      <button onClick={toggleDropdown} className="profile-trigger">
        <UserAvatar
          avatarUrl={user.avatarUrl}
          username={user.username}
          className="compact-avatar"
        />
        <span className="username">{user.username}</span>
        <svg 
          className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}
          width="16" 
          height="16" 
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
        </svg>
      </button>

      {isDropdownOpen && (
        <div className="profile-dropdown">
          <div className="dropdown-header">
            <UserAvatar
              avatarUrl={user.avatarUrl}
              username={user.username}
              className="dropdown-avatar"
            />
            <div className="user-info">
              <div className="user-name">{user.username}</div>
              {user.name && <div className="user-display-name">{user.name}</div>}
            </div>
          </div>
          
          <div className="dropdown-divider"></div>
          
          <Link to="/dashboard" className="dropdown-item" onClick={closeDropdown}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 0a8 8 0 100 16A8 8 0 008 0zm.5 4.75a.75.75 0 00-1.5 0v3.5h-2a.75.75 0 000 1.5h2.75a.75.75 0 00.75-.75v-4.25z"/>
            </svg>
            Dashboard
          </Link>
          
          <Link to={`/user/${user.username}`} className="dropdown-item" onClick={closeDropdown}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2 8a6 6 0 1112 0 6 6 0 01-12 0zm6-3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
            </svg>
            Profile
          </Link>
          
          <div className="dropdown-divider"></div>
          
          <button onClick={handleLogout} className="dropdown-item logout-item">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 010 1.5h-2.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h2.5a.75.75 0 010 1.5h-2.5A1.75 1.75 0 012 14.25V2.75zm6.56 4.5l1.97-1.97a.75.75 0 10-1.06-1.06L6.22 7.47a.75.75 0 000 1.06l3.25 3.25a.75.75 0 101.06-1.06L8.56 8.75h5.69a.75.75 0 000-1.5H8.56z"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default CompactUserProfile;
