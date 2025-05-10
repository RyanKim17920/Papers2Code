// src/components/SearchBar.tsx
import React from 'react';
import './SearchBar.css'; // We'll create this file for styling

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (newSearchTerm: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  placeholder = "Search papers...", // Default placeholder
}) => {

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  return (
    <div className="search-bar-container">
      <input
        type="search" // Using "search" type for potential browser features (like clear button)
        className="search-input"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleChange}
        aria-label="Search papers" // Accessibility label
      />
      {/* Optional: Add a search icon here if desired */}
      {/* <i className="search-icon fas fa-search"></i> */}
    </div>
  );
};

export default SearchBar;