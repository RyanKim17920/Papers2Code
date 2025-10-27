import { useState, FC, useEffect } from 'react';
import { motion, useScroll } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import HeroHeader from '@/features/landing/HeroHeader';
import { HeroAnimation } from '@/features/landing/HeroAnimation'; 
import CtaSection from '@/features/landing/CtaSection';

// The text content for each step of the animation
const storyContent = [
    { index: 0, title: 'Reproducibility in ML Research is Broken', isIntro: true, subtitle: "Brilliant ideas trapped in papers. Researchers wasting months recreating basic work. A crisis hiding in plain sight. Scroll to see the problem." },
    { index: 1, title: 'The Research Explosion', subtitle: 'Thousands of cutting-edge papers flood the field each year. Each one represents months of brilliant work, promising breakthroughs that could change everything.' },
    { index: 2, title: 'The Hidden Pattern', subtitle: 'But when we look closer at the timeline, a disturbing pattern emerges. The very progress we celebrate is masking a growing crisis.' },
    { index: 3, title: 'The Reproducibility Crisis', subtitle: 'The devastating truth: most papers have no usable code. Researchers spend 60% of their time recreating work that already exists, instead of pushing boundaries.' },
    { index: 4, title: 'The Worsening Reality', subtitle: 'Year after year, the problem grows worse. More papers, less reproducibility. Innovation is suffocating under the weight of wasted effort.'},
];

// TYPED Helper component for each text slide. It now handles its own scroll detection.
interface ScrollSlideProps {
    index: number;
    setActiveScene: (index: number) => void;
    activeScene: number;
    title?: string;
    subtitle?: string;
    isIntro?: boolean;
}

const ScrollSlide: FC<ScrollSlideProps> = ({ index, setActiveScene, activeScene, title, subtitle, isIntro }) => {
    // This hook reliably detects when the text slide is in the middle of the screen
    const { ref } = useInView({
        threshold: 0.6,
        onChange: (inView) => {
            if (inView) {
                setActiveScene(index);
            }
        },
    });
    
    const isActive = activeScene === index;

    return (
        <section ref={ref} className="h-screen w-full flex flex-col justify-center px-[8%] py-[5vh] box-border max-[992px]:h-auto max-[992px]:min-h-[50vh]">
            <div className={`transition-all duration-[800ms] ease-out ${isActive ? 'opacity-100 blur-0 translate-y-0' : 'opacity-20 blur-[5px] translate-y-[15px]'}`}>
                {isIntro && <h1 className='text-[clamp(2.2rem,4vw,3.2rem)] font-bold leading-tight mb-6 text-[var(--text-heading-color)] max-[768px]:text-[clamp(1.8rem,6vw,2.5rem)]'>Reproducibility in ML Research is <span className="text-[var(--danger-color)]">Broken</span></h1>}
                {!isIntro && title && <h2 className='text-[clamp(2.2rem,4vw,3.2rem)] font-bold leading-tight mb-6 text-[var(--text-heading-color)] max-[768px]:text-[clamp(1.8rem,6vw,2.5rem)]'>{title}</h2>}
                {subtitle && <p className="text-xl leading-relaxed text-[var(--text-muted-color)] max-[768px]:text-base">{subtitle}</p>}
            </div>
        </section>
    );
};

// The main Landing Page component
const LandingPage = () => {
  const [activeScene, setActiveScene] = useState(0);
  const { scrollYProgress } = useScroll(); // This is only for the progress bar now

  // Clean directional scroll snapping with boundary escape
  useEffect(() => {
    let isAnimating = false;
    let scrollDirection: 'up' | 'down' | null = null;
    let scrollTimer: NodeJS.Timeout | null = null;

    const isInScrollytellingSection = () => {
      const scrollytellingContainer = document.querySelector('.scrollytelling-container');
      if (!scrollytellingContainer) return false;

      const containerRect = scrollytellingContainer.getBoundingClientRect();
      return containerRect.top <= 0 && containerRect.bottom > 0;
    };

    const snapToScene = (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= storyContent.length || targetIndex === activeScene) {
        return;
      }

      isAnimating = true;
      setActiveScene(targetIndex);

      const slides = document.querySelectorAll('.scroll-slide');
      const targetSlide = slides[targetIndex] as HTMLElement;
      
      if (targetSlide) {
        const rect = targetSlide.getBoundingClientRect();
        const targetScrollY = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2);
        
        window.scrollTo({
          top: targetScrollY,
          behavior: 'smooth'
        });

        // Clear animation flag after scroll completes
        setTimeout(() => {
          isAnimating = false;
        }, 800);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Block ALL scroll events during animation
      if (isAnimating) {
        e.preventDefault();
        return;
      }

      // Only handle in scrollytelling section
      if (!isInScrollytellingSection()) return;

      const direction = e.deltaY > 0 ? 'down' : 'up';

      // Allow escape at boundaries
      if (direction === 'up' && activeScene === 0) {
        // At first scene, allow scrolling up to leave section
        return;
      }
      
      if (direction === 'down' && activeScene === storyContent.length - 1) {
        // At last scene, allow scrolling down to leave section
        return;
      }

      // In middle of scenes - prevent default and snap
      e.preventDefault();
      
      // Clear existing timer
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }

      // Set or update direction
      scrollDirection = direction;

      // Debounce rapid wheel events
      scrollTimer = setTimeout(() => {
        if (scrollDirection === 'down') {
          snapToScene(activeScene + 1);
        } else if (scrollDirection === 'up') {
          snapToScene(activeScene - 1);
        }
        scrollDirection = null;
      }, 100);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating || !isInScrollytellingSection()) return;

      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        snapToScene(activeScene + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        snapToScene(activeScene - 1);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isAnimating || !isInScrollytellingSection()) return;
      
      const touch = e.touches[0];
      if (touch) {
        // Store initial touch position for swipe detection
        (handleTouchStart as any).startY = touch.clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isAnimating || !isInScrollytellingSection()) return;

      const touch = e.changedTouches[0];
      if (touch && (handleTouchStart as any).startY) {
        const deltaY = (handleTouchStart as any).startY - touch.clientY;
        const threshold = 50;

        if (Math.abs(deltaY) > threshold) {
          const direction = deltaY > 0 ? 'down' : 'up';
          
          // Allow escape at boundaries for touch too
          if (direction === 'up' && activeScene === 0) return;
          if (direction === 'down' && activeScene === storyContent.length - 1) return;
          
          e.preventDefault();
          if (deltaY > 0) {
            snapToScene(activeScene + 1);
          } else {
            snapToScene(activeScene - 1);
          }
        }
      }
    };

    // Add event listeners
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
    };
  }, [activeScene]);

  return (
    <div className="w-full max-w-full overflow-x-hidden relative">
      <style>{`
        @keyframes pulse-glow {
          from { box-shadow: 0 2px 10px rgba(59, 130, 246, 0.3); }
          to { box-shadow: 0 2px 15px rgba(59, 130, 246, 0.5); }
        }
      `}</style>
      
      {/* The animated blue scrollbar */}
      <motion.div 
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-[var(--primary-color)] via-[#3b82f6] via-[#06b6d4] via-[#10b981] to-[var(--accent-color)] z-[1000] origin-left shadow-[0_2px_10px_rgba(59,130,246,0.3)] animate-[pulse-glow_2s_infinite_alternate]" 
        style={{ scaleX: scrollYProgress }} 
      />

      {/* Hero Header - Logo, search, overview */}
      <HeroHeader />

      {/* This container provides the scrollable height and contains both text and visuals */}
      <div className="flex relative h-[500vh] overflow-visible max-[992px]:flex-col max-[992px]:h-auto">
        <div className="w-1/2 relative z-10 h-[500vh] overflow-visible max-[992px]:w-full max-[992px]:h-auto">
          <div className="w-full relative z-10 max-[992px]:w-full max-[992px]:h-auto">
            {storyContent.map(story => (
              <ScrollSlide
                key={story.index}
                activeScene={activeScene}
                setActiveScene={setActiveScene}
                {...story}
              />
            ))}
          </div>
        </div>
        
        {/* Animation wrapper ensures proper sticky containment */}
        <div className="w-1/2 h-[500vh] relative block overflow-visible max-[992px]:w-full max-[992px]:h-auto">
          <HeroAnimation activeScene={activeScene} />
        </div>
      </div>

      {/* The rest of the page flows naturally after the scrollytelling */}
      <div className="relative top-0 left-0 w-full z-[15] bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.15)] border-t-4 border-[#3b82f6] mt-8">
        <div className="h-40 bg-gradient-to-b from-[rgba(233,236,239,0.3)] to-white max-[992px]:hidden" />
        <CtaSection />
      </div>
    </div>
  );
};

export default LandingPage; 