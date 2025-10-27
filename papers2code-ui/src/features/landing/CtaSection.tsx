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
    <section className="relative py-16 px-8 text-center text-white overflow-hidden bg-gradient-to-br from-[var(--primary-dark-color)] via-[var(--secondary-dark-color)] to-[var(--primary-dark-color)]">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        background: 'radial-gradient(circle at 30% 20%, rgba(var(--primary-rgb), 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(var(--primary-rgb), 0.1) 0%, transparent 50%)'
      }}></div>
      
      {/* Animated dot pattern */}
      <div className="absolute inset-0 pointer-events-none z-[1] animate-[rotate-subtle_60s_linear_infinite]" style={{
        backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.03) 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.03) 1px, transparent 1px), radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
        backgroundSize: '50px 50px, 80px 80px, 100px 100px'
      }}></div>
      
      <div className="relative z-[2]">
        <h2 className="text-[2.5rem] font-bold mb-6 max-md:text-[2rem]" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.9) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>Ready to Make a Difference?</h2>
        <p className="text-xl mb-12 max-w-[600px] mx-auto opacity-90 max-md:text-base">Join the movement to unlock trapped innovation. Whether you're building, researching, or leading, there's a place for you in solving the reproducibility crisis.</p>
        
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-8 max-w-[1200px] mx-auto max-md:grid-cols-1">
          <div className="group relative bg-white/10 p-8 rounded-xl backdrop-blur-[10px] border border-white/20 transition-all duration-200 overflow-hidden hover:-translate-y-[5px] hover:bg-white/15 hover:shadow-[0_10px_25px_rgba(0,0,0,0.2)] max-md:p-6">
            <div className="absolute inset-0 z-0 opacity-0 rounded-xl transition-opacity duration-600 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]" style={{
              background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)'
            }}></div>
            <h3 className="text-2xl font-semibold mb-4 max-md:text-[1.3rem]">For Developers</h3>
            <p className="mb-6 opacity-90 leading-relaxed">Build your portfolio by implementing cutting-edge research. Help make breakthrough ideas accessible to everyone.</p>
            <button 
              className="relative overflow-hidden px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-br from-[var(--primary-color)] to-[var(--primary-accent-color)] text-white border-2 border-[var(--primary-color)] shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] hover:from-[var(--primary-hover-color)] hover:to-[var(--primary-color)] hover:border-[var(--primary-hover-color)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(var(--primary-rgb),0.4)]" 
              onClick={handleStartBuilding}
            >Start Building</button>
          </div>
          
          <div className="group relative bg-white/10 p-8 rounded-xl backdrop-blur-[10px] border border-white/20 transition-all duration-200 overflow-hidden hover:-translate-y-[5px] hover:bg-white/15 hover:shadow-[0_10px_25px_rgba(0,0,0,0.2)] max-md:p-6">
            <div className="absolute inset-0 z-0 opacity-0 rounded-xl transition-opacity duration-600 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]" style={{
              background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)'
            }}></div>
            <h3 className="text-2xl font-semibold mb-4 max-md:text-[1.3rem]">For Researchers</h3>
            <p className="mb-6 opacity-90 leading-relaxed">Find missing implementations of papers in your field. Connect with developers who can bring research to life.</p>
            <button 
              className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-transparent border-2 border-white/80 text-white/90 hover:bg-white/10 hover:text-white hover:border-white hover:-translate-y-px" 
              onClick={handleFindImplementations}
            >Find Implementations</button>
          </div>
          
          <div className="group relative bg-white/10 p-8 rounded-xl backdrop-blur-[10px] border border-white/20 transition-all duration-200 overflow-hidden hover:-translate-y-[5px] hover:bg-white/15 hover:shadow-[0_10px_25px_rgba(0,0,0,0.2)] max-md:p-6">
            <div className="absolute inset-0 z-0 opacity-0 rounded-xl transition-opacity duration-600 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]" style={{
              background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)'
            }}></div>
            <h3 className="text-2xl font-semibold mb-4 max-md:text-[1.3rem]">For Organizations</h3>
            <p className="mb-6 opacity-90 leading-relaxed">Support open science by sponsoring implementations or providing computing resources to accelerate progress.</p>
            <button 
              className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-white/10 border-2 border-white/30 text-white/90 backdrop-blur-[10px] hover:bg-white/20 hover:border-white/60 hover:text-white hover:-translate-y-px hover:shadow-[0_5px_15px_rgba(255,255,255,0.1)]" 
              onClick={handlePartnerWithUs}
            >Partner With Us</button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-200%) skewX(-15deg); }
          100% { transform: translateX(200%) skewX(-15deg); }
        }
        @keyframes rotate-subtle {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
};

export default CtaSection;
