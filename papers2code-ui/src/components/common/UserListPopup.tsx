import React, { useEffect, useRef } from 'react';
import { UserDisplayList } from '../paperDetail/UserDisplayList';
import type { UserProfile } from '../../common/types/user';
import './UserListPopup.css';

interface UserListPopupProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[] | undefined;
  title: string;
  isLoading: boolean;
  error: string | null;
  emptyMessage?: string;
  anchorElement?: HTMLElement | null;
}

const UserListPopup: React.FC<UserListPopupProps> = ({
  isOpen,
  onClose,
  users,
  title,
  isLoading,
  error,
  emptyMessage,
  anchorElement,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && anchorElement && popupRef.current) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const popupElement = popupRef.current;
      
      // Position popup near the anchor element
      const scrollX = window.scrollX || 0;
      const scrollY = window.scrollY || 0;
      
      // Calculate preferred position (bottom-right of anchor)
      let left = anchorRect.right + scrollX + 8;
      let top = anchorRect.top + scrollY;
      
      // Ensure popup doesn't go off screen
      const popupWidth = 300; // Approximate width
      const popupHeight = 400; // Approximate max height
      
      // Adjust horizontal position if it would go off screen
      if (left + popupWidth > window.innerWidth + scrollX) {
        left = anchorRect.left + scrollX - popupWidth - 8;
      }
      
      // Adjust vertical position if it would go off screen
      if (top + popupHeight > window.innerHeight + scrollY) {
        top = anchorRect.bottom + scrollY - popupHeight;
      }
      
      // Final bounds check
      left = Math.max(8, Math.min(left, window.innerWidth + scrollX - popupWidth - 8));
      top = Math.max(8, Math.min(top, window.innerHeight + scrollY - 100));
      
      popupElement.style.left = `${left}px`;
      popupElement.style.top = `${top}px`;
    }
  }, [isOpen, anchorElement]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="user-list-popup-backdrop">
      <div 
        ref={popupRef} 
        className="user-list-popup"
      >
        <div className="popup-header">
          <button 
            className="popup-close-button" 
            onClick={onClose} 
            aria-label="Close popup"
            type="button"
          >
            ×
          </button>
        </div>
        
        <div className="popup-content">
          <UserDisplayList
            title={title}
            users={users}
            isLoading={isLoading}
            error={error}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>
    </div>
  );
};

export default UserListPopup;