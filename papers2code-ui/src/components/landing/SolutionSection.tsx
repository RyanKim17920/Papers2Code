import { motion } from 'framer-motion';
import { Code, Users, Zap, ArrowRight } from 'lucide-react';
import './SolutionSection.css';
 
const SolutionSection = () => {
  return (
    <section className="solution-section">
      <div className="solution-content">
        <div className="solution-header">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            How Papers2Code Works
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            A simple platform connecting researchers and developers to make research reproducible
          </motion.p>
        </div>
        
        <div className="solution-visual-container">
          <motion.div 
            className="solution-network"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <motion.div 
              className="solution-node developer"
              initial={{ x: -100, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Code className="node-icon" />
              <h3>Developers</h3>
              <p>Find code implementations for research papers</p>
            </motion.div>
            
            <motion.div 
              className="solution-node researcher"
              initial={{ x: 100, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Users className="node-icon" />
              <h3>Researchers</h3>
              <p>Share code and get implementation feedback</p>
            </motion.div>
            
            <motion.div 
              className="solution-center"
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Zap className="center-icon" />
              <span>Papers2Code</span>
            </motion.div>
            
            <motion.div 
              className="connection-line left"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              viewport={{ once: true }}
            />
            <motion.div 
              className="connection-line right"  
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              transition={{ delay: 1.4, duration: 0.8 }}
              viewport={{ once: true }}
            />
          </motion.div>
          
          <motion.div 
            className="solution-impact"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.8 }}
            viewport={{ once: true }}
          >
            <ArrowRight className="impact-arrow" />
            <span>Better Research Reproducibility</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
