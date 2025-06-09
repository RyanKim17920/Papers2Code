import React, { useState, useEffect, FC } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Code } from 'lucide-react';
import './HeroAnimation.css';

// A more detailed visual for a research paper
const ResearchPaperVisual = ({ isStacked }: { isStacked: boolean }) => (
  <div className={`paper-visual ${isStacked ? 'is-stacked' : ''}`}>
    <div className="paper-title-line" />
    <div className="paper-text-line" />
    <div className="paper-text-line short" />
    <div className="paper-text-line" />
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
      opacity = 0.9;
      x = (Math.random() - 0.5) * 500;
      y = (Math.random() - 0.5) * 450;
      rotateZ = (Math.random() - 0.5) * 90;
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
            // This value was increased from 250 to 280 to prevent overlap
            x = isImplemented ? 170 : 280; 
            y = -rightIndex * 4;
            zIndex = isImplemented ? 10 : 1;
        }
      }
    }
    else if (activeScene === 4) { // Stacks move up for chart
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
    
    if (activeScene === 5) { // Animate all out
      opacity = 0; y = -400;
    }

    return { x, y, rotateX, rotateZ, opacity, zIndex };
  };
  
  return (
    <div className="three-d-space">
      <AnimatePresence>
        {(activeScene < 5) && Array.from({ length: totalPapers }).map((_, i) => {
          const is2023Paper = i < papers2023Count;
          let isImplemented = false;
          if (is2023Paper) {
            isImplemented = i < implemented2023Count;
          } else if (i < totalPapersInStacks) {
            isImplemented = (i - papers2023Count) < implemented2025Count;
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

// The chart component
const ProblemChart = ({ show }: { show: boolean }) => {
    const controls = useAnimation();
    useEffect(() => {
        if (show) controls.start({ opacity: 1, y: 0 });
        else controls.start({ opacity: 0, y: 100 });
    }, [show, controls]);

    return (
      <motion.div className="chart-container" initial={false} animate={{ opacity: show ? 1 : 0 }} transition={{ duration: 0.5 }}>
        <motion.svg className="chart-svg" viewBox="0 0 600 200" initial={{ opacity: 0, y: 100 }} animate={controls} transition={{ type: 'spring', stiffness: 100, damping: 20 }}>
          <text x="300" y="25" textAnchor="middle" className="chart-title">Growth in Papers Without Code</text>
          <motion.path d="M 120 118 C 220 118, 280 82, 480 82 L 480 170 L 120 170 Z" className="chart-area" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }} transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }} />
          <motion.path d="M 120 118 C 220 118, 280 82, 480 82" className="chart-line" initial={{ pathLength: 0 }} animate={{ pathLength: show ? 1 : 0 }} transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }} />
          <text x="110" y="110" className="data-label" textAnchor="middle">62%</text>
          <text x="490" y="75" className="data-label" textAnchor="middle">74%</text>
          <text x="120" y="185" className="axis-label">2023</text>
          <text x="480" y="185" className="axis-label">2025</text>
        </motion.svg>
      </motion.div>
    );
};

// The text content for each step of the animation
const storyContent = [
    { index: 0, title: 'Reproducibility in ML Research is Broken', isIntro: true },
    { index: 1, title: 'A Sea of Research', subtitle: 'Each year, a flood of new papers is published, adding to a mountain of human knowledge.' },
    { index: 2, title: 'A Troubling Trend', subtitle: 'When we organize the research by year, we see not just growth in volume, but a story of a worsening problem.' },
    { index: 3, title: 'The Widening Gap', subtitle: 'An alarmingly small fraction of papers have usable code. Worryingly, that fraction appears to be shrinking as the field accelerates.' },
    { index: 4, title: 'Quantifying the Crisis', subtitle: 'The trend is clear: the percentage of non-reproducible papers is increasing. This is the challenge we exist to solve.'},
    { index: 5, title: 'Join the Mission', subtitle: 'Help us reverse the trend. Every implementation saves countless hours and unlocks the future of science.', isOutro: true },
];

// TYPED Helper component for triggering state changes on scroll
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
    const { ref } = useInView({ threshold: 0.6, onChange: (inView) => inView && setActiveScene(index) });
    const isActive = activeScene === index;
  
    return (
      <section ref={ref} className="scroll-slide">
        <div className={`slide-content ${isActive ? 'is-active' : ''}`}>
          {isIntro && <h1 className='intro-title'>Reproducibility in ML Research is <span className="highlight-text">Broken</span></h1>}
          {!isIntro && title && <h2 className='slide-title'>{title}</h2>}
          {subtitle && <p className="slide-subtitle">{subtitle}</p>}
          {isOutro && <div className="cta-buttons"><button className="btn btn-primary btn-lg">Browse Projects</button></div>}
        </div>
      </section>
    );
};
  
// The main component that assembles the scrollytelling experience
export const HeroAnimation = () => {
    const [activeScene, setActiveScene] = useState(0);
    return (
      <div className="scrollytelling-height-manager">
        <div className="scrollytelling-container">
          <div className="sticky-visual-pane">
            <VisualsController activeScene={activeScene} />
            <ProblemChart show={activeScene === 4} />
            <AnimatePresence>
                {activeScene >= 2 && activeScene < 5 && (
                <>
                    <motion.div className="stack-label label-2023" initial={{ opacity: 0 }} animate={{ y: activeScene === 4 ? -180 : 0, opacity: 1 }} exit={{ opacity: 0 }}>2023</motion.div>
                    <motion.div className="stack-label label-2025" initial={{ opacity: 0 }} animate={{ y: activeScene === 4 ? -180 : 0, opacity: 1 }} exit={{ opacity: 0 }}>2025</motion.div>
                </>
                )}
            </AnimatePresence>
          </div>
          <div className="scroll-slides-container">
            {storyContent.map((section) => (
              <ScrollSlide key={section.index} setActiveScene={setActiveScene} activeScene={activeScene} {...section} />
            ))}
          </div>
        </div>
      </div>
    );
};