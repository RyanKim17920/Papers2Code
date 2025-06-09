import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Zap } from 'lucide-react';
import './LandingPage.css';
import { HeroAnimation } from '../components/landing/HeroAnimation'; 
import HeroSection from '../components/landing/HeroSection';
import StatsSection from '../components/landing/StatsSection';
import ProblemsSection from '../components/landing/ProblemsSection';
import SolutionSection from '../components/landing/SolutionSection';
import CtaSection from '../components/landing/CtaSection';

const LandingPage = () => {
  const [animateStats, setAnimateStats] = useState(false);
  const [currentProblem, setCurrentProblem] = useState(0);

  const problems = [
    { icon: Clock, title: "Months of Lost Time", desc: "Researchers waste countless hours attempting to reproduce results from incomplete papers" },
    { icon: RefreshCw, title: "Duplicated Efforts", desc: "Multiple teams independently struggle with the same missing implementations" },
    { icon: Zap, title: "Innovation Bottlenecks", desc: "Breakthrough research sits unused because it can't be built upon or verified" }
  ];

  const workflowSteps = [
    { icon: "📝", title: "Paper Published", desc: "Groundbreaking research", status: "success" },
    { icon: "❌", title: "Code Missing", desc: "Implementation unavailable", status: "error" },
    { icon: "⏳", title: "Impact Delayed", desc: "Research potential wasted", status: "warning" }
  ];

  const solutionSteps = [
  { number: "01", title: "Discover", desc: "Identifies research papers lacking code implementations using paperswithcode datasets" },
  { number: "02", title: "Validate", desc: "Verify that no existing implementation exists and confirm the paper's significance and feasibility" },
  { number: "03", title: "Collaborate", desc: "Rally volunteer developers and experts to build peer-reviewed, open-source implementations" },
  { number: "04", title: "Deploy", desc: "Publish verified, documented code repositories that enable reproducible research at scale" }
];

  useEffect(() => {
    const timer = setTimeout(() => setAnimateStats(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentProblem((prev) => (prev + 1) % problems.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [problems.length]);

  return (
    <div className="landing-container">
      <HeroAnimation />
      <StatsSection animateStats={animateStats} />
      <ProblemsSection 
        problems={problems} 
        workflowSteps={workflowSteps} 
        currentProblem={currentProblem} 
      />
      <SolutionSection solutionSteps={solutionSteps} />
      <CtaSection />
    </div>
  );
};

export default LandingPage;