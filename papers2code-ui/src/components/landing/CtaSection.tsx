import React from 'react';
import './CtaSection.css'; // Adjust path as needed

interface CtaSectionProps {
  // Define any props if needed in the future
}

const CtaSection: React.FC<CtaSectionProps> = () => {
  return (
    <section className="cta-section">
      <div className="cta-content">
        <h2>Join the Community</h2>
        <p>We're connecting research with implementation through collaborative development. Work with researchers, developers, and organizations to make ML research more accessible and practical.</p>
        
        <div className="cta-options">
          <div className="cta-option">
            <h3>For Developers</h3>
            <p>Help implement cutting-edge research and build your portfolio with meaningful projects.</p>
            <button className="btn btn-primary">Start Contributing</button>
          </div>
          
          <div className="cta-option">
            <h3>For Researchers</h3>
            <p>Submit your papers for implementation and connect with the developer community.</p>
            <button className="btn btn-outline-primary">Submit Paper</button>
          </div>
          
          <div className="cta-option">
            <h3>For Organizations</h3>
            <p>Support open science by sponsoring implementations or providing computing resources.</p>
            <button className="btn btn-secondary">Partner With Us</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
