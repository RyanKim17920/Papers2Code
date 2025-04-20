import React from 'react';
import SearchBar from './SearchBar';
import { SortPreference } from '../../hooks/usePaperList'; // Import updated type

interface ListControlsProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeSortDisplay: 'relevance' | SortPreference; // Use updated type
  onSortChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  isSearchActive: boolean;
}

const ListControls: React.FC<ListControlsProps> = ({
  searchTerm,
  onSearchChange,
  activeSortDisplay,
  onSortChange,
  isSearchActive,
}) => {
  return (
    <div className="list-controls">
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        placeholder="Search by title, abstract, or author..."
      />
      <div className="sort-control">
        <label htmlFor="sort-order">Sort by:</label>
        <select id="sort-order" value={activeSortDisplay} onChange={onSortChange}>
          {isSearchActive && <option value="relevance">Relevance</option>}
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="upvotes">Most Upvoted</option> {/* Add Upvotes option */}
        </select>
      </div>
    </div>
  );
};

export default ListControls;