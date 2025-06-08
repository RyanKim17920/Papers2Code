import React, { useState } from 'react';
import {
  ImplementationProgress,
  ImplementationSection,
  ImplementationComponent,
  ComponentStatusTs,
  ComponentCategoryTs, 
} from '../../../../types/paper';
import './ProgressTracker.css';

interface ProgressTrackerProps {
  implementationProgress: ImplementationProgress;
  onImplementationProgressChange: (updatedProgress: ImplementationProgress) => void;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  implementationProgress,
  onImplementationProgressChange,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
  };

  const toggleSectionExpansion = (sectionId: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSectionChange = (sectionId: string, field: keyof ImplementationSection, value: string) => {
    const updatedProgress = JSON.parse(JSON.stringify(implementationProgress)) as ImplementationProgress;
    const section = updatedProgress.implementationRoadmap?.sections.find(s => s.id === sectionId);
    if (section) {
      if (field === 'description') {
        (section[field] as string | null | undefined) = value; 
      } else if (field === 'title' || field === 'name') {
        (section[field] as string) = value;
      } else if (field === 'isDefault') {
        (section[field] as boolean) = Boolean(value);
      } else {
        (section[field] as any) = value; 
      }
      onImplementationProgressChange(updatedProgress);
    }
  };

  const handleComponentChange = (sectionId: string, componentId: string, field: keyof ImplementationComponent, value: string | ComponentStatusTs) => {
    const updatedProgress = JSON.parse(JSON.stringify(implementationProgress)) as ImplementationProgress;
    const section = updatedProgress.implementationRoadmap?.sections.find(s => s.id === sectionId);
    if (section?.components) {
      const component = section.components.find(c => c.id === componentId);
      if (component) {
        if (field === 'description' || field === 'notes') {
            (component[field] as string | null | undefined) = value as string; 
        } else if (field === 'name' || field === 'category' || field === 'status') {
            (component[field] as string) = value as string;
        } else if (field === 'order') {
            (component[field] as number) = Number(value);
        } else {
            (component[field] as any) = value;
        }
        onImplementationProgressChange(updatedProgress);
      }
    }
  };

  const handleAddComponent = (sectionId: string) => {
    const now = new Date().toISOString();
    const newComponent: ImplementationComponent = {
      id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: 'New Component',
      description: '',
      category: ComponentCategoryTs.CORE, // Default category
      status: ComponentStatusTs.TO_DO, // Corrected status
      steps: [], // Default steps
      order: 0, 
      createdAt: now,
      updatedAt: now,
    };
    const updatedProgress = JSON.parse(JSON.stringify(implementationProgress)) as ImplementationProgress;
    const section = updatedProgress.implementationRoadmap?.sections.find(s => s.id === sectionId);
    if (section) {
      if (!section.components) section.components = [];
      newComponent.order = section.components.length;
      section.components.push(newComponent);
      onImplementationProgressChange(updatedProgress);
    }
  };
  
  const handleAddSection = () => {
    const now = new Date().toISOString();
    const newSection: ImplementationSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: 'New Section Name', // Default name
      title: 'New Section Title',
      description: '',
      order: implementationProgress.implementationRoadmap?.sections?.length || 0,
      isDefault: false, // Default value
      components: [],
      createdAt: now,
      updatedAt: now,
    };
    const updatedProgress = JSON.parse(JSON.stringify(implementationProgress)) as ImplementationProgress;
    if (!updatedProgress.implementationRoadmap) {
      updatedProgress.implementationRoadmap = { 
        sections: [], 
        overallProgress: implementationProgress.implementationRoadmap?.overallProgress || 0 // Preserve or default overallProgress
      }; 
    }
    if (!updatedProgress.implementationRoadmap.sections) {
        updatedProgress.implementationRoadmap.sections = [];
    }
    updatedProgress.implementationRoadmap.sections.push(newSection);
    onImplementationProgressChange(updatedProgress);
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!window.confirm('Are you sure you want to delete this section and all its components?')) {
      return;
    }
    const updatedProgress = JSON.parse(JSON.stringify(implementationProgress)) as ImplementationProgress;
    if (updatedProgress.implementationRoadmap?.sections) {
      updatedProgress.implementationRoadmap.sections = updatedProgress.implementationRoadmap.sections.filter(
        (s) => s.id !== sectionId
      );
      onImplementationProgressChange(updatedProgress);
    }
  };

  const handleDeleteComponent = (sectionId: string, componentId: string) => {
    if (!window.confirm('Are you sure you want to delete this component?')) {
      return;
    }
    const updatedProgress = JSON.parse(JSON.stringify(implementationProgress)) as ImplementationProgress;
    const section = updatedProgress.implementationRoadmap?.sections.find(s => s.id === sectionId);
    if (section?.components) {
      section.components = section.components.filter(c => c.id !== componentId);
      onImplementationProgressChange(updatedProgress);
    }
  };

  return (
    <div className="progress-tracker">
      <div className="progress-tracker-controls">
        <h4>Implementation Roadmap</h4>
        <button onClick={handleToggleEditMode} className={`button ${editMode ? 'button-danger' : 'button-primary'}`}>
          {editMode ? 'Finish Editing' : 'Edit Roadmap'}
        </button>
      </div>

      {/* Author Outreach */} 
      {implementationProgress.authorOutreach && (
        <div className="author-outreach-summary card-like mb-3 p-3">
          <h5>Author Outreach</h5>
          <p>Status: {implementationProgress.authorOutreach.status}
            {editMode && <span className="edit-indicator"> (✏️)</span>}
          </p>
          {/* Further details and editing UI for author outreach can be added here */}
        </div>
      )}

      {/* Sections */} 
      {implementationProgress.implementationRoadmap?.sections?.map((section) => (
        // Removed section.status from className as it's not part of ImplementationSection type
        <div key={section.id} className={`section-container mb-3`}>
          <div className="section-header card-like" onClick={() => !editMode && toggleSectionExpansion(section.id)}>
            {editMode ? (
              <div className="d-flex align-items-center w-100"> {/* Wrapper for input and delete button */}
                <input 
                  type="text" 
                  value={section.title} 
                  onChange={(e) => handleSectionChange(section.id, 'title', e.target.value)} 
                  onClick={(e) => e.stopPropagation()} 
                  className="form-control form-control-sm section-title-input flex-grow-1"
                  placeholder="Section Title"
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}
                  className="button button-danger button-sm ms-2"
                  title="Delete Section"
                >
                  🗑️ Delete
                </button>
              </div>
            ) : (
              <h5>{section.title}</h5>
            )}
            {!editMode && <span className={`dropdown-arrow ${expandedSections[section.id] ? 'expanded' : ''}`}>▼</span>}
          </div>

          {(expandedSections[section.id] || editMode) && (
            <div className="section-content card-like p-3">
              {editMode ? (
                <textarea 
                  value={section.description || ''} // Handle null/undefined description
                  onChange={(e) => handleSectionChange(section.id, 'description', e.target.value)} 
                  className="form-control form-control-sm mb-2 section-description-textarea"
                  placeholder="Section Description"
                  rows={2}
                />
              ) : (
                <p className="section-description">{section.description || "No description."}</p>
              )}
              
              {/* Components */} 
              {section.components?.map((component) => (
                // Using component.status for className, ensure it's valid or default
                <div key={component.id} className={`component-item ${component.status?.toLowerCase().replace(/ /g, '-') || 'to-do'} mb-2 p-2 border rounded`}>
                  {editMode ? (
                    <>
                      <input 
                        type="text" 
                        value={component.name} 
                        onChange={(e) => handleComponentChange(section.id, component.id, 'name', e.target.value)} 
                        className="form-control form-control-sm component-name-input mb-1"
                        placeholder="Component Name"
                      />
                      <textarea 
                        value={component.description || ''} // Handle null/undefined description
                        onChange={(e) => handleComponentChange(section.id, component.id, 'description', e.target.value)} 
                        className="form-control form-control-sm component-description-textarea mb-1"
                        placeholder="Component Description"
                        rows={1}
                      />
                      <select 
                        value={component.status} 
                        onChange={(e) => handleComponentChange(section.id, component.id, 'status', e.target.value as ComponentStatusTs)}
                        className='form-control form-control-sm component-status-select mb-1' // Added mb-1 for spacing
                      >
                        {Object.values(ComponentStatusTs).map(statusValue => (
                            <option key={statusValue} value={statusValue}>{statusValue}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => handleDeleteComponent(section.id, component.id)}
                        className="button button-danger button-sm mt-2"
                        title="Delete Component"
                      >
                        Delete Component
                      </button>
                    </>
                  ) : (
                    <>
                      <strong>{component.name}</strong>
                      <p className="component-description text-muted small">{component.description || "No description."}</p>
                      <p className="component-status small">Status: <span className='badge badge-secondary'>{component.status}</span></p>
                    </>
                  )}
                </div>
              ))}
              {editMode && (
                <button onClick={() => handleAddComponent(section.id)} className="button button-secondary button-sm mt-2">+ Add Component</button>
              )}
            </div>
          )}
        </div>
      ))}

      {editMode && (
        <div className="mt-3">
          <button onClick={handleAddSection} className="button button-primary">+ Add Section</button>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;