import React from 'react';
import SearchBar from './SearchBar';
import { SortPreference } from '../../../hooks/usePaperList';

interface ListControlsProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeSortDisplay: 'relevance' | SortPreference; // This will be uiSortValue from the hook
  onSortChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  // isSearchActive: boolean; // No longer needed directly if using more specific flags
  onToggleAdvancedSearch: () => void;
  showAdvancedSearch: boolean;  // NEW PROPS
  isSearchInputActive: boolean;
}

const ListControls: React.FC<ListControlsProps> = ({
  searchTerm,
  onSearchChange,
  activeSortDisplay,
  onSortChange,
  onToggleAdvancedSearch,
  showAdvancedSearch,  // NEW PROPS
  isSearchInputActive,
}) => {
  return (
    <div className="list-controls-wrapper">
      <div className="list-controls">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          placeholder="Search by title or abstract..."
        />
        <div className="sort-and-advanced">
          <div className="sort-control">
            <label htmlFor="sort-order">Sort by:</label>            <select 
              id="sort-order" 
              value={activeSortDisplay} 
              onChange={onSortChange}
              disabled={isSearchInputActive} // Disable if title/abstract search
            >
              {/* Show Relevance if title/abstract search OR author search is active */}
              {isSearchInputActive && <option value="relevance">Relevance</option>}
              
              {/* Show other sort options only if not a title/abstract search */}
              {!isSearchInputActive && (
                <>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="upvotes">Most Upvoted</option>
                </>
              )}
            </select>
          </div>
          <button
            onClick={onToggleAdvancedSearch}
            className="btn btn-secondary btn-advanced-toggle"
            style={{'width':'175px'}}
            aria-expanded={showAdvancedSearch}
          >
            {showAdvancedSearch ? 'Hide Advanced' : 'Advanced Search'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListControls;