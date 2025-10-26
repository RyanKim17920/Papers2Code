import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Code } from 'lucide-react';

// A more detailed visual for a research paper
const ResearchPaperVisual = ({ isStacked }: { isStacked: boolean }) => (
  <div className={`w-[100px] h-[130px] bg-white rounded border-2 border-[#868e96] p-2.5 flex flex-col gap-2 transition-shadow duration-400 ${isStacked ? 'shadow-[0_2px_2px_-1px_rgba(0,0,0,0.1),0_4px_4px_-2px_rgba(0,0,0,0.1),0_6px_6px_-3px_rgba(0,0,0,0.1),0_8px_8px_-4px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.1)]' : ''}`}>
    <div className="w-[60%] h-1.5 bg-[#ced4da] rounded" />
    <div className="w-full h-1 bg-[#dee2e6] rounded" />
    <div className="w-[80%] h-1 bg-[#dee2e6] rounded" />
    <div className="w-full h-1 bg-[#dee2e6] rounded" />
  </div>
);

// Master component to handle all paper & chart animations
const VisualsController = ({ activeScene }: { activeScene: number }) => {
  const totalPapers = 30;
  const papers2023Count = 13;
  const papers2025Count = 17;
  const totalPapersInStacks = papers2023Count + papers2025Count;

  // Data: Implemented stacks are a small fraction
  const implemented2023Count = 3;
  const implemented2025Count = 3;

  const getPaperAnimation = (i: number) => {
    let opacity = 0, x = 0, y = 0, rotateX = 0, rotateZ = 0, zIndex = 1;

    if (activeScene === 0) { // Scatter
      if (i < totalPapers) {
        opacity = 0.9;
        x = (Math.random() - 0.5) * 500;
        y = (Math.random() - 0.5) * 450;
        rotateZ = (Math.random() - 0.5) * 90;
      }
    }
    else if (activeScene === 1) { // Single Stack
      if (i < totalPapersInStacks) {
        opacity = 1; rotateX = 70; rotateZ = -15; y = -i * 4;
      }
    }
    else if (activeScene === 2) { // Two UNIFIED Stacks
       if (i < totalPapersInStacks) {
        opacity = 1; rotateX = 70; rotateZ = -45;
        const is2023Paper = i < papers2023Count;
        if (is2023Paper) {
            x = -170; y = -i * 4;
        } else {
            x = 170; y = -(i - papers2023Count) * 4;
        }
      }
    }
    else if (activeScene === 3) { // Two SPLIT Stacks
      if (i < totalPapersInStacks) {
        opacity = 1; rotateX = 70; rotateZ = -45;
        const is2023Paper = i < papers2023Count;
        if (is2023Paper) {
            const isImplemented = i < implemented2023Count;
            x = isImplemented ? -170 : -250;
            y = -i * 4;
            zIndex = isImplemented ? 10 : 1;
        } else {
            const rightIndex = i - papers2023Count;
            const isImplemented = rightIndex < implemented2025Count;
            x = isImplemented ? 170 : 280; 
            y = -rightIndex * 4;
            zIndex = isImplemented ? 10 : 1;
        }
      }
    } 
    if (activeScene === 4) { // Stacks move up for chart - final scene
      if (i < totalPapersInStacks) {
        opacity = 1; rotateX = 70; rotateZ = -45; y = -180;
        const is2023Paper = i < papers2023Count;
        if (is2023Paper) {
            const isImplemented = i < implemented2023Count;
            x = isImplemented ? -170 : -250;
            y -= i * 4;
            zIndex = isImplemented ? 10 : 1;
        } else {
            const rightIndex = i - papers2023Count;
            const isImplemented = rightIndex < implemented2025Count;
            x = isImplemented ? 170 : 280;
            y -= rightIndex * 4;
            zIndex = isImplemented ? 10 : 1;
        }
      }
    }

    return { x, y, rotateX, rotateZ, opacity, zIndex };
  };
  
  return (
    <div className="w-full h-full [perspective:1200px] [transform-style:preserve-3d] relative flex items-center justify-center">
      <AnimatePresence>
        {Array.from({ length: totalPapers }).map((_, i) => {
          const is2023Paper = i < papers2023Count;
          let isImplemented = false;
          if (activeScene >= 3) {
            if (is2023Paper) {
              isImplemented = i < implemented2023Count;
            } else if (i < totalPapersInStacks) {
              isImplemented = (i - papers2023Count) < implemented2025Count;
            }
          }

          return (
            <motion.div
              key={i}
              layoutId={`paper-${i}`}
              className="paper-wrapper"
              initial={false}
              animate={getPaperAnimation(i)}
              transition={{ type: 'spring', stiffness: 80, damping: 50, mass: 3 }}
            >
              <ResearchPaperVisual isStacked={activeScene >= 1 && activeScene < 5} />
              {activeScene >= 3 && activeScene < 5 && isImplemented &&
                <Code className="code-badge" />
              }
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

const ProblemChart = ({ show }: { show: boolean }) => {
    const controls = useAnimation();
    useEffect(() => {
        if (show) controls.start({ opacity: 1, y: 0 });
        else controls.start({ opacity: 0, y: 100 });
    }, [show, controls]);

    return (
      <motion.div className="w-full h-full flex justify-center items-end pb-[10vh] box-border" initial={false} animate={{ opacity: show ? 1 : 0 }} transition={{ duration: 0.5 }}>
        <motion.svg className="w-full max-w-[600px] overflow-visible" viewBox="0 0 600 200" initial={{ opacity: 0, y: 100 }} animate={controls} transition={{ type: 'spring', stiffness: 100, damping: 20 }}>
          <text x="300" y="25" textAnchor="middle" className="text-xl font-semibold fill-[var(--text-heading-color)]">Growth in Papers Without Code</text>
          <motion.path d="M 120 118 C 220 118, 280 82, 480 82 L 480 170 L 120 170 Z" className="fill-[rgba(220,53,69,0.1)] stroke-none" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }} transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }} />
          <motion.path d="M 120 118 C 220 118, 280 82, 480 82" className="fill-none stroke-[var(--danger-color)] stroke-[3px]" initial={{ pathLength: 0 }} animate={{ pathLength: show ? 1 : 0 }} transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }} />
          <text x="110" y="110" className="text-sm font-semibold fill-[var(--danger-color)]" textAnchor="middle">62%</text>
          <text x="490" y="75" className="text-sm font-semibold fill-[var(--danger-color)]" textAnchor="middle">74%</text>
          <text x="120" y="185" className="text-xs fill-[var(--text-muted-color)] text-anchor-middle">2023</text>
          <text x="480" y="185" className="text-xs fill-[var(--text-muted-color)] text-anchor-middle">2025</text>
        </motion.svg>
      </motion.div>
    );
};
   
// The main component that assembles the visuals
export const HeroAnimation = ({ activeScene }: { activeScene: number }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [positionClass, setPositionClass] = useState('phase-initial'); // Track positioning phase

    useEffect(() => {
        const handleScroll = () => {
            const scrollytellingContainer = document.querySelector('.scrollytelling-container');
            const heroHeader = document.querySelector('.hero-header');
            
            if (!scrollytellingContainer || !heroHeader) return;
            
            const containerRect = scrollytellingContainer.getBoundingClientRect();
            const heroRect = heroHeader.getBoundingClientRect();
            
            // Phase 1: Initially positioned below header (not overlapping)
            if (heroRect.bottom > 0) {
                setPositionClass('phase-initial');
            }
            // Phase 2: During scrolling - follows/sticks as you scroll through scenes
            else if (containerRect.top <= 0 && containerRect.bottom > 0) {
                setPositionClass('phase-following');
            }
            // Phase 3: At the end - sticks when scrollytelling ends
            else if (containerRect.bottom <= 0) {
                setPositionClass('phase-end');
                setIsVisible(false); // Hide when completely past scrollytelling
                return;
            }
            
            setIsVisible(true);
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll(); // Initial check
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!isVisible) return null;

    // Map phase classes to Tailwind
    const phaseClasses = {
      'phase-initial': 'absolute top-0',
      'phase-following': 'fixed top-0',
      'phase-end': 'absolute bottom-0'
    };

    const baseClasses = 'right-0 h-screen w-1/2 grid place-items-center bg-white z-[5] overflow-hidden border-l border-black/10 transition-all duration-300 max-[992px]:w-full max-[992px]:sticky max-[992px]:h-[50vh] max-[992px]:opacity-100 max-[992px]:border-l-0 max-[992px]:border-b max-[992px]:border-black/10';

    return (
        <div className={`${baseClasses} ${phaseClasses[positionClass as keyof typeof phaseClasses] || ''}`}>
          <VisualsController activeScene={activeScene} />
          <ProblemChart show={activeScene === 4} />
          <div className="w-full h-full relative flex items-center justify-center pointer-events-none">
              <AnimatePresence>
                  {activeScene >= 2 && (
                  <>
                      <motion.div className="absolute bottom-[25vh] font-semibold text-lg text-[var(--text-muted-color)] bg-[rgba(233,236,239,0.8)] px-3 py-1 rounded shadow-sm z-20 -translate-x-1/2" initial={{ opacity: 0 }} animate={{ y: activeScene >= 4 ? -180 : 0, x: -170, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.5, ease: "easeOut" }}>2023</motion.div>
                      <motion.div className="absolute bottom-[25vh] font-semibold text-lg text-[var(--text-muted-color)] bg-[rgba(233,236,239,0.8)] px-3 py-1 rounded shadow-sm z-20 -translate-x-1/2" initial={{ opacity: 0 }} animate={{ y: activeScene >= 4 ? -180 : 0, x: 170, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.5, ease: "easeOut" }}>2025</motion.div>
                  </>
                  )}
              </AnimatePresence>
          </div>
        </div>
    );
};