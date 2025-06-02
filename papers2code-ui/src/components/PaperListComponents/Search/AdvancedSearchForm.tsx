import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { AdvancedPaperFilters } from '../../../services/api';
import './AdvancedSearchForm.css';


interface AdvancedSearchFormProps {
  filters: AdvancedPaperFilters;
  onChange: (filterName: keyof AdvancedPaperFilters, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}

// Helper function to safely parse YYYY-MM-DD string to Date object
const parseDateString = (dateString: string | undefined): Date | null => {
  if (!dateString) return null;
  try {
    // Add time component to avoid timezone issues during parsing
    const date = new Date(`${dateString}T00:00:00`);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        return null;
    }
    return date;
  } catch (e) {
    console.error("Error parsing date string:", dateString, e);
    return null;
  }
};

// Helper function to format Date object to YYYY-MM-DD string
const formatDateToString = (date: Date | null): string => {
  if (!date) return '';
  try {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("Error formatting date:", date, e);
    return '';
  }
};


const AdvancedSearchForm: React.FC<AdvancedSearchFormProps> = ({
  filters,
  onChange,
  onApply,
  onClear,
  onClose,
}) => {
  // Handler for regular text inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange(name as keyof AdvancedPaperFilters, value);
  };

  // Handler for DatePicker changes
  const handleDateChange = (
    date: Date | null,
    filterName: 'startDate' | 'endDate'
  ) => {
    onChange(filterName, formatDateToString(date));
  };


  return (
    <div className="advanced-search-form">
      <h4>Advanced Search</h4>
      <div className="form-grid">
        {/* Date Range */}
        <div className="form-group">
          <label htmlFor="startDate">Published After:</label>          <DatePicker
            selected={parseDateString(filters.startDate)}
            onChange={(date) => handleDateChange(date, 'startDate')}
            selectsStart
            startDate={parseDateString(filters.startDate) || undefined}
            endDate={parseDateString(filters.endDate) || undefined}
            dateFormat="yyyy-MM-dd"
            placeholderText="YYYY-MM-DD"
            className="form-control"
            isClearable
            maxDate={new Date()}
            id="startDate"
            autoComplete="off"
            showIcon
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            readOnly={false}
            useShortMonthInDropdown={false}
          />
        </div>
        <div className="form-group">
          <label htmlFor="endDate">Published Before:</label>           <DatePicker
            selected={parseDateString(filters.endDate)}
            onChange={(date) => handleDateChange(date, 'endDate')}
            selectsEnd
            startDate={parseDateString(filters.startDate) || undefined}
            endDate={parseDateString(filters.endDate) || undefined}
            minDate={parseDateString(filters.startDate) || undefined}
            maxDate={new Date()}
            dateFormat="yyyy-MM-dd"
            placeholderText="YYYY-MM-DD"
            className="form-control"
            isClearable
            id="endDate"
            autoComplete="off"
            showIcon
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            readOnly={false}
            useShortMonthInDropdown={false}
          />
        </div>

        {/* Author Search */}
        {/* ... author input remains the same ... */}
         <div className="form-group"> {/* No longer needs form-group-full-width */}
          <label htmlFor="searchAuthors">Authors:</label>
          <input
            type="text"
            id="searchAuthors"
            name="searchAuthors"
            placeholder="e.g., Hinton, LeCun"
            value={filters.searchAuthors || ''}
            onChange={handleInputChange}
            className="form-control"
          />
        </div>
      </div>

      {/* Action Buttons */}
      {/* ... buttons remain the same ... */}
      <div className="form-actions">
        <button type="button" onClick={onApply} className="btn btn-primary">
          Apply Filters
        </button>
        <button type="button" onClick={onClear} className="btn btn-secondary">
          Clear Filters
        </button>
        <button type="button" onClick={onClose} className="btn btn-link">
          Close
        </button>
      </div>
    </div>
  );
};

export default AdvancedSearchForm;