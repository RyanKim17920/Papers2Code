import React, { useEffect, FC } from 'react';
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
  
// The main component that assembles the visuals
export const HeroAnimation = ({ activeScene }: { activeScene: number }) => {
    return (
      <div className="sticky-visual-pane">
        <VisualsController activeScene={activeScene} />
        <ProblemChart show={activeScene === 4} />
        <div className="viz-container labels-container">
            <AnimatePresence>
                {activeScene >= 2 && activeScene < 5 && (
                <>
                    <motion.div className="stack-label" initial={{ opacity: 0 }} animate={{ y: activeScene === 4 ? -180 : 0, x: -170, opacity: 1 }} exit={{ opacity: 0 }}>2023</motion.div>
                    <motion.div className="stack-label" initial={{ opacity: 0 }} animate={{ y: activeScene === 4 ? -180 : 0, x: 170, opacity: 1 }} exit={{ opacity: 0 }}>2025</motion.div>
                </>
                )}
            </AnimatePresence>
        </div>
      </div>
    );
};