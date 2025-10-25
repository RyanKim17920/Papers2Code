// src/components/SearchBar.tsx
import React from 'react';

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
    <div className="relative w-full mb-6">
      <input
        type="search" // Using "search" type for potential browser features (like clear button)
        className="w-full px-5 py-3 pr-10 text-base font-[inherit] text-[var(--text-color)] bg-[var(--card-background-color)] border-2 border-[var(--secondary-accent-color)] rounded-lg box-border transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--text-muted-color)] placeholder:opacity-80 focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb,25,124,154),0.2)] [&::-webkit-search-cancel-button]:cursor-pointer"
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