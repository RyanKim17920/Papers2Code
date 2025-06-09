import React, { useState } from 'react';
import { Code, FileText } from 'lucide-react';
import './HeroSection.css'; // Adjust path as needed

// A simple, modern SVG for the hand icon
const HandIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 15V6a2 2 0 00-2-2H8a2 2 0 00-2 2v9" />
    <path d="M18 15a2 2 0 01-2 2H8a2 2 0 01-2-2" />
    <path d="M6 17v1a2 2 0 002 2h8a2 2 0 002-2v-1" />
  </svg>
);

const HeroSection: React.FC = () => {
  const [isBridged, setIsBridged] = useState(false);

  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-badge">
          <Code className="badge-icon" />
          <span>Bridging Research & Implementation</span>
        </div>
        
        <h1 className="hero-title">
          Reproducibility in ML Research is <span className="highlight-text">Broken</span>
        </h1>
        
        <p className="hero-subtitle">
          Thousands of papers ship yearly with no usable code. <strong>papers2code.org</strong> is a nonprofit hub that finds "code-less" papers, rallies volunteers to re-implement them, and publishes peer-reviewed, open-source repos.
        </p>

        <div className="cta-buttons">
          <button className="btn btn-primary btn-lg">Join the Mission</button>
          <button className="btn btn-outline-primary btn-lg">Browse Projects</button>
        </div>
      </div>

      <div className="hero-visual">
        <div 
          className={`animation-container ${isBridged ? 'is-bridged' : ''}`}
          onClick={() => !isBridged && setIsBridged(true)}
        >
          {/* Platforms */}
          <div className="platform platform-left">
            <div className="entity-icon-wrapper paper-icon">
              <FileText size={48} />
            </div>
            <div className="entity-title">Research Paper</div>
          </div>
          <div className="platform platform-right">
            <div className="entity-icon-wrapper code-icon-placeholder">
              <div className="code-icon-final">
                <Code size={48} />
              </div>
            </div>
            <div className="entity-title">Verified Code</div>
          </div>

          {/* The Bridge */}
          <div className="bridge-container">
            {/* We render 6 hands to form the bridge */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`hand-wrapper hand-${i + 1}`}>
                <HandIcon className="bridge-hand" />
              </div>
            ))}
          </div>
          
          {/* Data Pulse */}
          <div className="pulse-path">
            <div className="data-pulse"></div>
          </div>

          {/* Status Text */}
          <div className="connection-status">
            <span className="status-text">
              {isBridged ? 'Connection Forged by Community' : 'Click to Build the Bridge'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;