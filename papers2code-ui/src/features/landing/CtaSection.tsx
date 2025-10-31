import React from 'react';
import { useNavigate } from 'react-router-dom';

interface CtaSectionProps {
  // Define any props if needed in the future
}

const CtaSection: React.FC<CtaSectionProps> = () => {
  const navigate = useNavigate();

  const handleStartBuilding = () => {
    // Navigate to papers that need implementation
    navigate('/papers?mainStatus=Not%20Started');
  };

  const handleFindImplementations = () => {
    // Navigate to papers that have implementations
    navigate('/papers?mainStatus=Completed');
  };

  const handlePartnerWithUs = () => {
    // For now, just navigate to papers. In the future, this could be a contact form or partnership page
    navigate('/papers');
  };

  return (
    <section className="relative py-12 px-8 text-center bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-4 text-white">Get Started</h2>
        <p className="text-lg mb-8 text-white/90">Browse research papers and start building implementations.</p>
        
        <div className="flex gap-4 justify-center flex-wrap">
          <button 
            className="px-6 py-3 rounded-lg font-semibold transition-all bg-white text-blue-600 hover:bg-blue-50 hover:shadow-lg" 
            onClick={handleStartBuilding}
          >
            Browse Papers
          </button>
          
          <button 
            className="px-6 py-3 rounded-lg font-semibold transition-all bg-transparent border-2 border-white text-white hover:bg-white/10" 
            onClick={handleFindImplementations}
          >
            Find Implementations
          </button>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
