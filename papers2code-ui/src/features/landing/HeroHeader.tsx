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
    <section className="h-screen bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] flex flex-col justify-center items-center relative text-[#1e293b] text-center p-1 overflow-hidden box-border [contain:layout_style] max-md:p-3 max-[480px]:p-1">
      <div className="max-w-[800px] w-full mb-1 overflow-hidden flex-shrink max-md:mb-2">
        <motion.div 
          className="hero-text"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-[clamp(1.6rem,3.5vw,2.8rem)] font-extrabold mb-1 leading-[1.1] tracking-[-0.02em] [word-break:keep-all] max-w-full overflow-hidden max-[480px]:text-[1.8rem]">
            Papers<span className="text-[#3b82f6] [text-shadow:none]">2</span>Code
          </h1>
          <p className="text-[clamp(0.9rem,2.2vw,1.2rem)] font-semibold mb-1 opacity-95 leading-tight">
            The platform where the research community collaborates on reproducible machine learning
          </p>
          <p className="text-[clamp(0.75rem,1.6vw,0.95rem)] mb-3 opacity-85 leading-snug max-w-[600px] mx-auto">
            Find implementations, share code, and make research reproducible. Connect researchers and developers to bridge the gap between papers and working code.
          </p>
          
          <div className="flex flex-col gap-2 items-center mb-3 flex-shrink min-h-0">
            <form onSubmit={handleSearch} className="relative w-full max-w-[500px]">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b] w-6 h-6" />
              <input 
                type="text" 
                placeholder="Search papers, models, implementations..." 
                className="w-full py-4 pr-16 pl-4 border-2 border-[#cbd5e1] rounded-[50px] bg-white text-[#1e293b] text-base transition-all duration-300 placeholder:text-[#64748b] focus:outline-none focus:border-[#3b82f6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] max-[480px]:py-3.5 max-[480px]:pr-16 max-[480px]:pl-3.5"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <div className="flex gap-1 flex-nowrap justify-center items-center w-auto max-w-full flex-shrink-0 max-md:flex-col max-md:w-full">
              <button className="flex items-center gap-1 px-3 py-2 rounded-[50px] font-semibold text-xs border-2 border-transparent cursor-pointer transition-all duration-300 no-underline whitespace-nowrap flex-shrink-0 min-w-0 overflow-hidden max-w-none bg-[#3b82f6] text-white border-[#3b82f6] hover:bg-[#2563eb] hover:border-[#2563eb] hover:-translate-y-0.5 max-md:w-full max-md:max-w-[300px]" onClick={handleBrowsePapers}>
                <BookOpen size={20} />
                Browse Papers
              </button>
              <button className="flex items-center gap-1 px-3 py-2 rounded-[50px] font-semibold text-xs border-2 border-transparent cursor-pointer transition-all duration-300 no-underline whitespace-nowrap flex-shrink-0 min-w-0 overflow-hidden max-w-none bg-white text-[#3b82f6] border-[#cbd5e1] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:-translate-y-0.5 max-md:w-full max-md:max-w-[300px]" onClick={handleAddImplementation}>
                <Github size={20} />
                Add Implementation
              </button>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="grid grid-cols-2 gap-8 mt-3 mb-3 max-w-[500px] mx-auto overflow-hidden flex-shrink min-h-0 max-md:grid-cols-1 max-md:gap-3 max-md:mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="text-center overflow-hidden max-[480px]:px-1">
            <div className="text-[clamp(1.3rem,2.8vw,1.6rem)] font-bold text-[#3b82f6] mb-0.5 whitespace-nowrap max-md:text-2xl max-[480px]:text-[1.2rem]">500K+</div>
            <div className="text-sm text-[#64748b] font-medium whitespace-nowrap max-[480px]:text-[0.7rem]">Research Papers</div>
          </div>
          <div className="text-center overflow-hidden max-[480px]:px-1">
            <div className="text-[clamp(1.3rem,2.8vw,1.6rem)] font-bold text-[#3b82f6] mb-0.5 whitespace-nowrap max-md:text-2xl max-[480px]:text-[1.2rem]">200K+</div>
            <div className="text-sm text-[#64748b] font-medium whitespace-nowrap max-[480px]:text-[0.7rem]">Implementations</div>
          </div>
        </motion.div>
      </div>
      
      <motion.div 
        className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 z-[100] max-h-[35px] overflow-hidden max-md:bottom-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
      >
        <div className="text-xs text-[#64748b] font-medium">Scroll to see the problem</div>
        <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-[#64748b] animate-bounce"></div>
      </motion.div>
    </section>
  );
};

export default HeroHeader;
