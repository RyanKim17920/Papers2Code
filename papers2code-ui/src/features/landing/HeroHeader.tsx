import { motion } from 'framer-motion';
import { Search, Github, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { debugLog } from '@/shared/utils/logger';

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
    <section className="min-h-[calc(100vh-65px)] bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] flex flex-col justify-center items-center relative text-[#1e293b] text-center py-8 px-4 overflow-hidden">
      <div className="max-w-[800px] w-full space-y-6">
        <motion.div 
          className="space-y-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="space-y-3">
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.1] tracking-[-0.02em]">
              Papers<span className="text-[#3b82f6]">2</span>Code
            </h1>
            <p className="text-[clamp(1rem,2.2vw,1.25rem)] font-semibold opacity-95">
              The platform where the research community collaborates on reproducible machine learning
            </p>
            <p className="text-[clamp(0.875rem,1.6vw,1rem)] opacity-85 max-w-[600px] mx-auto">
              Find implementations, share code, and make research reproducible. Connect researchers and developers to bridge the gap between papers and working code.
            </p>
          </div>
          
          <div className="flex flex-col gap-4 items-center">
            <form onSubmit={handleSearch} className="relative w-full max-w-[600px]">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b] w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search papers, models, implementations..." 
                className="w-full py-3.5 pr-12 pl-5 border-2 border-[#cbd5e1] rounded-full bg-white text-[#1e293b] transition-all duration-300 placeholder:text-[#64748b] focus:outline-none focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <div className="flex gap-3 justify-center items-center flex-wrap max-w-full">
              <button className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-[#3b82f6] text-white border-2 border-[#3b82f6] transition-all duration-300 hover:bg-[#2563eb] hover:border-[#2563eb] hover:-translate-y-0.5" onClick={handleBrowsePapers}>
                <BookOpen size={20} />
                Browse Papers
              </button>
              <button className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-white text-[#3b82f6] border-2 border-[#cbd5e1] transition-all duration-300 hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:-translate-y-0.5" onClick={handleAddImplementation}>
                <Github size={20} />
                Add Implementation
              </button>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="grid grid-cols-2 gap-12 max-w-[600px] mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-[#3b82f6] mb-2">500K+</div>
            <div className="text-sm text-[#64748b] font-medium">Research Papers</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-[#3b82f6] mb-2">200K+</div>
            <div className="text-sm text-[#64748b] font-medium">Implementations</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroHeader;
