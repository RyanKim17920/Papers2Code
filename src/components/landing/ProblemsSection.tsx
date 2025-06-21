import React from 'react';
import { ArrowDown, LucideIcon } from 'lucide-react';
import './ProblemsSection.css'; 

interface Problem {
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface WorkflowStep {
  icon: string;
  title: string;
  desc: string;
  status: string;
}

interface ProblemsSectionProps {
  problems: Problem[];
  workflowSteps: WorkflowStep[];
  currentProblem: number;
}

const ProblemsSection: React.FC<ProblemsSectionProps> = ({ problems, workflowSteps, currentProblem }) => {
  return (
    <section className="problems-section">
      <div className="section-header">
        <h2>The Research Crisis</h2>
        <p>Missing implementations create cascading problems across the scientific community</p>
      </div>

      <div className="problems-showcase">
        <div className="problem-display">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div 
                key={index}
                className={`problem-card ${index === currentProblem ? 'active' : ''}`}
              >
                <div className="problem-icon">
                  <Icon />
                </div>
                <h3>{problem.title}</h3>
                <p>{problem.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="workflow-visualization">
          <h3>Current Broken Workflow</h3>
          <div className="workflow-steps">
            {workflowSteps.map((step, index) => (
              <div key={index} className="workflow-step">
                <div className={`step-icon ${step.status}`}>
                  <span>{step.icon}</span>
                </div>
                <div className="step-content">
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
                {index < workflowSteps.length - 1 && (
                  <ArrowDown className="step-arrow" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;
