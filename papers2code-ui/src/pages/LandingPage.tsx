import { useState, FC } from 'react';
import { motion, useScroll } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import './LandingPage.css';
import HeroHeader from '../components/landing/HeroHeader';
import { HeroAnimation } from '../components/landing/HeroAnimation'; 
import StatsSection from '../components/landing/StatsSection';
import CtaSection from '../components/landing/CtaSection';

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
        <section ref={ref} className="scroll-slide">
            <div className={`slide-content ${isActive ? 'is-active' : ''}`}>
                {isIntro && <h1 className='intro-title'>Reproducibility in ML Research is <span className="highlight-text">Broken</span></h1>}
                {!isIntro && title && <h2 className='slide-title'>{title}</h2>}
                {subtitle && <p className="slide-subtitle">{subtitle}</p>}
            </div>
        </section>
    );
};

// The main Landing Page component
const LandingPage = () => {
  const [activeScene, setActiveScene] = useState(0);
  const { scrollYProgress } = useScroll(); // This is only for the progress bar now

  return (
    <div className="landing-container">
      {/* The animated blue scrollbar */}
      <motion.div className="scroll-progress-bar" style={{ scaleX: scrollYProgress }} />

      {/* Hero Header - Logo, search, overview */}
      <HeroHeader />

      {/* This container provides the scrollable height and contains both text and visuals */}
      <div className="scrollytelling-container">
        <div className="scrollytelling-text-wrapper">
          <div className="story-text-container">
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
        <div className="hero-animation-wrapper">
          <HeroAnimation activeScene={activeScene} />
        </div>
      </div>

      {/* The rest of the page flows naturally after the scrollytelling */}
      <div className="page-content-after-hero">
        <div className="transition-spacer" />
        <StatsSection animateStats={activeScene >= 4} />
        <CtaSection />
      </div>
    </div>
  );
};

export default LandingPage; 