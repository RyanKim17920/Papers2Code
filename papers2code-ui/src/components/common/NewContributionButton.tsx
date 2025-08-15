import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NewContributionButton.css';

interface NewContributionButtonProps {
  className?: string;
  onClick?: () => void;
}

const NewContributionButton: React.FC<NewContributionButtonProps> = ({
  className = '',
  onClick
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: navigate to papers page to start contributing
      navigate('/papers');
    }
  };

  return (
    <button
      className={`new-contribution-button ${className}`}
      onClick={handleClick}
    >
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 16 16" 
        fill="currentColor"
        className="plus-icon"
      >
        <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/>
      </svg>
      New Contribution
    </button>
  );
};

export default NewContributionButton;
