import { motion } from 'framer-motion';
import { Search, Github, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { debugLog } from '../../common/utils/logger';
import './HeroHeader.css';

const HeroHeader = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const searchUrl = `/papers?searchQuery=${encodeURIComponent(searchQuery.trim())}`;
      debugLog.navigation('Navigating to search URL:', searchUrl);
      navigate(searchUrl);
    }
  };

  const handleBrowsePapers = () => {
    debugLog.navigation('Navigating to browse papers');
    navigate('/papers');
  };

  const handleAddImplementation = () => {
    // Navigate to papers page with a filter for papers needing implementation
    // Use "Not Started" as the primary filter for papers needing implementation
    const filterUrl = '/papers?mainStatus=Not%20Started';
    debugLog.navigation('Navigating to filter URL:', filterUrl);
    navigate(filterUrl);
  };

  return (
    <section className="hero-header">
      <div className="hero-content">
        <motion.div 
          className="hero-text"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="hero-title">
            Papers<span className="highlight">2</span>Code
          </h1>
          <p className="hero-subtitle">
            The platform where the research community collaborates on reproducible machine learning
          </p>
          <p className="hero-description">
            Find implementations, share code, and make research reproducible. Connect researchers and developers to bridge the gap between papers and working code.
          </p>
          
          <div className="hero-actions">
            <form onSubmit={handleSearch} className="search-container">
              <Search className="search-icon" />
              <input 
                type="text" 
                placeholder="Search papers, models, implementations..." 
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <div className="action-buttons">
              <button className="btn-primary" onClick={handleBrowsePapers}>
                <BookOpen size={20} />
                Browse Papers
              </button>
              <button className="btn-secondary" onClick={handleAddImplementation}>
                <Github size={20} />
                Add Implementation
              </button>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="hero-stats"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="stat-item">
            <div className="stat-number">2.4K+</div>
            <div className="stat-label">Research Papers</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">1.8K+</div>
            <div className="stat-label">Implementations</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">890+</div>
            <div className="stat-label">Contributors</div>
          </div>
        </motion.div>
      </div>
      
      <motion.div 
        className="scroll-indicator"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
      >
        <div className="scroll-text">Scroll to see the problem</div>
        <div className="scroll-arrow"></div>
      </motion.div>
    </section>
  );
};

export default HeroHeader;
