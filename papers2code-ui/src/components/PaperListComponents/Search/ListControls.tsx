import React from 'react';
import SearchBar from './SearchBar';
import { SortPreference } from '../../../hooks/usePaperList';

interface ListControlsProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeSortDisplay: 'relevance' | SortPreference;
  onSortChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  isSearchActive: boolean;
  onToggleAdvancedSearch: () => void; // <-- Add toggle handler prop
  showAdvancedSearch: boolean; // <-- Add state prop
}

const ListControls: React.FC<ListControlsProps> = ({
  searchTerm,
  onSearchChange,
  activeSortDisplay,
  onSortChange,
  isSearchActive,
  onToggleAdvancedSearch, // <-- Destructure
  showAdvancedSearch,     // <-- Destructure
}) => {
  return (
    <div className="list-controls-wrapper"> {/* Add a wrapper */}
      <div className="list-controls">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          placeholder="Search by title or abstract..." // <-- Updated placeholder
        />
        <div className="sort-and-advanced"> {/* Group sort and advanced button */}
          <div className="sort-control">
            <label htmlFor="sort-order">Sort by:</label>
            <select id="sort-order" value={activeSortDisplay} onChange={onSortChange}>
              {/* Conditionally show Relevance based on *any* search criteria */}
              {isSearchActive && <option value="relevance">Relevance</option>}
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="upvotes">Most Upvoted</option>
            </select>
          </div>
          {/* --- NEW: Advanced Search Toggle Button --- */}
          <button
            onClick={onToggleAdvancedSearch}
            className="btn btn-secondary btn-advanced-toggle" // Add specific class
            style={{'width':'175px'}}
            aria-expanded={showAdvancedSearch}
          >
            {showAdvancedSearch ? 'Hide Advanced' : 'Advanced Search'}
          </button>
          {/* --- End NEW --- */}
        </div>
      </div>
    </div>
  );
};

export default ListControls;
