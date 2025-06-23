import React from 'react';
import './StatsSection.css';

interface StatCounterProps {
  end: number;
  suffix?: string;
  duration?: number;
  animateStats: boolean;
}

const StatCounter: React.FC<StatCounterProps> = ({ end, suffix = "", duration = 2000, animateStats }) => {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!animateStats) return;
    
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [animateStats, end, duration]);

  return <span>{count}{suffix}</span>;
};

interface StatsSectionProps {
  animateStats: boolean;
}

const StatsSection: React.FC<StatsSectionProps> = ({ animateStats }) => {
  return (
    <section className="stats-section">
      <div className="section-header">
        <h2>The Cost of Missing Implementations</h2>
        <p>When research papers lack code, it creates measurable delays and inefficiencies across the scientific community. Here's how we're helping teams save time and accelerate progress.</p>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">
            <StatCounter end={38} suffix="%" animateStats={animateStats} />
          </div>
          <div className="stat-label">Papers without code (2021-2023)</div>
          <div className="stat-trend down">↓ Now 26% in 2025</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number">
            <StatCounter end={1247} animateStats={animateStats} />
          </div>
          <div className="stat-label">Developer hours saved from re-implementation</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number">
            <StatCounter end={89} animateStats={animateStats} />
          </div>
          <div className="stat-label">Active volunteer developers</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-number">
            <StatCounter end={156} animateStats={animateStats} />
          </div>
          <div className="stat-label">Papers made accessible with working code</div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
