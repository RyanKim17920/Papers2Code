import React from 'react';
import { Users, Target, Code, GitBranch } from 'lucide-react';
import './SolutionSection.css'; // Adjust path as needed

interface SolutionStep {
  number: string;
  title: string;
  desc: string;
}

interface SolutionSectionProps {
  solutionSteps: SolutionStep[];
}

const SolutionSection: React.FC<SolutionSectionProps> = ({ solutionSteps }) => {
  return (
    <section className="solution-section">
      <div className="section-header">
        <h2>Our Solution</h2>
        <p>A systematic approach to bridging the gap between research and implementation</p>
      </div>

      <div className="solution-grid">
        {solutionSteps.map((step, index) => (
          <div key={index} className="solution-card">
            <div className="solution-number">{step.number}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="solution-visual">
        <div className="connection-network">
          <div className="network-node researchers">
            <Users className="node-icon" />
            <span>Researchers</span>
          </div>
          <div className="network-node papers">
            <Target className="node-icon" />
            <span>Papers</span>
          </div>
          <div className="network-node developers">
            <Code className="node-icon" />
            <span>Developers</span>
          </div>
          <div className="network-node community">
            <GitBranch className="node-icon" />
            <span>Open Source</span>
          </div>
          <svg className="connection-lines" viewBox="0 0 400 200">
            {/* Simplified paths for example, adjust as needed */}
            <path className="connection-line" d="M100,50 Q200,100 300,50" />
            <path className="connection-line" d="M100,150 Q200,100 300,150" />
            <path className="connection-line" d="M200,50 L200,150" />
            <path className="connection-line" d="M50,100 Q200,50 350,100" />
          </svg>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
