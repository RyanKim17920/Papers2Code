
import React, { useState, useEffect } from 'react';

interface EditableFieldProps {
  value: string | null | undefined;
  onSave: (newValue: string) => void;
  label?: string;
  fieldType?: 'input' | 'textarea';
  placeholder?: string;
}

export const EditableField: React.FC<EditableFieldProps> = ({
  value,
  onSave,
  label,
  fieldType = 'input',
  placeholder = 'Enter value'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value || '');

  useEffect(() => {
    setCurrentValue(value || '');
  }, [value]);

  const handleSave = () => {
    onSave(currentValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="editable-field editing">
        {label && <label>{label}: </label>}
        {fieldType === 'textarea' ? (
          <textarea
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        ) : (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder={placeholder}
          />
        )}
        <button onClick={handleSave} className="save-btn">Save</button>
        <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
      </div>
    );
  }

  return (
    <div className="editable-field view" onClick={() => setIsEditing(true)} title="Click to edit">
      {label && <strong>{label}: </strong>}
      <span>{value || <span className="placeholder-text">{placeholder}</span>}</span>
      <span className="edit-icon"> [Edit]</span>
    </div>
  );
};
