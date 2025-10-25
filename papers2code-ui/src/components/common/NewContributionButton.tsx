import React from 'react';
import { useNavigate } from 'react-router-dom';

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
      className={`flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#2EA44F] text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-all duration-200 no-underline hover:bg-[#2c974b] hover:-translate-y-px hover:shadow-[0_4px_8px_rgba(46,164,79,0.25)] active:translate-y-0 active:shadow-[0_2px_4px_rgba(46,164,79,0.25)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(46,164,79,0.25)] md:px-3.5 md:py-2.5 md:text-[0.8rem] ${className}`}
      onClick={handleClick}
    >
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 16 16" 
        fill="currentColor"
        className="flex-shrink-0"
      >
        <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/>
      </svg>
      New Contribution
    </button>
  );
};

export default NewContributionButton;
