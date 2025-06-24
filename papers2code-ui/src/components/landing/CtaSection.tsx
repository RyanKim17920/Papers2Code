import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CtaSection.css'; // Adjust path as needed

interface CtaSectionProps {
  // Define any props if needed in the future
}

const CtaSection: React.FC<CtaSectionProps> = () => {
  const navigate = useNavigate();

  const handleStartBuilding = () => {
    navigate('/papers?filter=needs-implementation');
  };

  const handleFindImplementations = () => {
    navigate('/papers?filter=has-implementation');
  };

  const handlePartnerWithUs = () => {
    // For now, just navigate to papers. In the future, this could be a contact form or partnership page
    navigate('/papers');
  };

  return (
    <section className="cta-section">
      <div className="cta-content">
        <h2>Ready to Make a Difference?</h2>
        <p>Join the movement to unlock trapped innovation. Whether you're building, researching, or leading, there's a place for you in solving the reproducibility crisis.</p>
        
        <div className="cta-options">
          <div className="cta-option">
            <h3>For Developers</h3>
            <p>Build your portfolio by implementing cutting-edge research. Help make breakthrough ideas accessible to everyone.</p>
            <button className="btn btn-primary" onClick={handleStartBuilding}>Start Building</button>
          </div>
          
          <div className="cta-option">
            <h3>For Researchers</h3>
            <p>Find missing implementations of papers in your field. Connect with developers who can bring research to life.</p>
            <button className="btn btn-outline-primary" onClick={handleFindImplementations}>Find Implementations</button>
          </div>
          
          <div className="cta-option">
            <h3>For Organizations</h3>
            <p>Support open science by sponsoring implementations or providing computing resources to accelerate progress.</p>
            <button className="btn btn-secondary" onClick={handlePartnerWithUs}>Partner With Us</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
