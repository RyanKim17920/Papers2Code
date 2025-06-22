import React, { useState, FC } from 'react';
import { motion, useScroll } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import './LandingPage.css';
import { HeroAnimation } from '../components/landing/HeroAnimation'; 
import StatsSection from '../components/landing/StatsSection';
import CtaSection from '../components/landing/CtaSection';

// The text content for each step of the animation
const storyContent = [
    { index: 0, title: 'Reproducibility in ML Research is Broken', isIntro: true, subtitle: "A hidden crisis in scientific research is causing a massive drain on time and innovation. Scroll to see the problem." },
    { index: 1, title: 'A Sea of Research', subtitle: 'Each year, a flood of new papers is published, adding to a mountain of human knowledge.' },
    { index: 2, title: 'A Troubling Trend', subtitle: 'When we organize the research by year, we see not just growth in volume, but a story of a worsening problem.' },
    { index: 3, title: 'The Widening Gap', subtitle: 'An alarmingly small fraction of papers have usable code. Worryingly, that fraction appears to be shrinking as the field accelerates.' },
    { index: 4, title: 'Quantifying the Crisis', subtitle: 'The trend is clear: the percentage of non-reproducible papers is increasing. This is the challenge we exist to solve.'},
    { index: 5, title: 'Our Measured Impact', subtitle: 'By rallying a community, we are beginning to reverse the trend. Below are the results of our collective effort.', isOutro: true },
];

// TYPED Helper component for each text slide. It now handles its own scroll detection.
interface ScrollSlideProps {
    index: number;
    setActiveScene: (index: number) => void;
    activeScene: number;
    title?: string;
    subtitle?: string;
    isIntro?: boolean;
    isOutro?: boolean;
}

const ScrollSlide: FC<ScrollSlideProps> = ({ index, setActiveScene, activeScene, title, subtitle, isIntro, isOutro }) => {
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
                {isOutro && <div className="cta-buttons"><button className="btn btn-primary btn-lg">View Our Impact</button></div>}
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

      {/* HeroAnimation receives the activeScene as a simple number */}
      <HeroAnimation activeScene={activeScene} />

      {/* This container provides the scrollable height */}
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

      {/* The rest of the page flows naturally after the text */}
      <div className="page-content-after-hero">
        <StatsSection animateStats={activeScene >= 5} />
        <CtaSection />
      </div>
    </div>
  );
};

export default LandingPage;