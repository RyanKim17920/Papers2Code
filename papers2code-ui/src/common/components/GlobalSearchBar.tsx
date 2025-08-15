import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './GlobalSearchBar.css';

const GlobalSearchBar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/papers?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/papers');
    }
  };

  return (
    <form onSubmit={handleSearch} className="global-search-bar">
      <div className="global-search-input-container">
        <input
          type="text"
          placeholder="Search papers, authors, conferences..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="global-search-input"
        />
        <button type="submit" className="global-search-button">
          Search
        </button>
      </div>
    </form>
  );
};

export default GlobalSearchBar;
