import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GlobalSearchBar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/papers?searchQuery=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/papers');
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex-1 max-w-[500px] mx-8 md:hidden">
      <div className="flex items-center bg-white border border-[#D0D7DE] rounded-md px-3 py-2 transition-all duration-200 focus-within:border-[#0969da] focus-within:shadow-[0_0_0_3px_rgba(9,105,218,0.12)]">
        <input
          type="text"
          placeholder="Search papers, authors, conferences..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 border-none outline-none bg-transparent text-[0.9rem] text-[var(--text-color)] font-[inherit] placeholder:text-[var(--text-muted-color)]"
        />
        <button 
          type="submit" 
          className="bg-[var(--primary-color)] text-white border-none px-4 py-1.5 rounded text-[0.8rem] font-semibold cursor-pointer transition-all duration-200 ml-2 hover:bg-[var(--primary-hover-color)] hover:-translate-y-px"
        >
          Search
        </button>
      </div>
    </form>
  );
};

export default GlobalSearchBar;
