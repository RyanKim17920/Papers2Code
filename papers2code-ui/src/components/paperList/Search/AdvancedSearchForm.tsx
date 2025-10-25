import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { AdvancedPaperFilters } from '../../../common/services/api';


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

const datePickerProps = {
  dateFormat: 'yyyy-MM-dd',
  placeholderText: 'YYYY-MM-DD',
  className: 'form-control',
  isClearable: true,
  autoComplete: 'off',
  showIcon: true,
  showMonthDropdown: true,
  showYearDropdown: true,
  dropdownMode: 'select',
  readOnly: false,
  useShortMonthInDropdown: false,
};


const AdvancedSearchForm: React.FC<AdvancedSearchFormProps> = ({
  filters,
  onChange,
  onApply,
  onClear,
  onClose,
}) => {
  const AnyDatePicker = DatePicker as unknown as React.ComponentType<any>;
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
    <div className="bg-[var(--card-background-color,#ffffff)] border border-[var(--border-color)] rounded-lg p-5 mt-4 mb-6 shadow-[0_2px_5px_rgba(0,0,0,0.05)] overflow-visible text-[var(--text-color,#212529)]">
      <h4>Advanced Search</h4>
      <div className="flex flex-wrap gap-5 my-8 mb-5 items-start justify-start overflow-visible">
        {/* Date Range */}
        <div className="flex flex-col flex-1 min-w-[180px] overflow-visible">
          <label htmlFor="startDate">Published After:</label>
          <AnyDatePicker
            selected={parseDateString(filters.startDate)}
            onChange={(date: Date | null) => handleDateChange(date, 'startDate')}
            startDate={parseDateString(filters.startDate) || undefined}
            endDate={parseDateString(filters.endDate) || undefined}
            maxDate={new Date()}
            id="startDate"
            {...datePickerProps}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-[180px] overflow-visible">
          <label htmlFor="endDate">Published Before:</label>
          <AnyDatePicker
            selected={parseDateString(filters.endDate)}
            onChange={(date: Date | null) => handleDateChange(date, 'endDate')}
            startDate={parseDateString(filters.startDate) || undefined}
            endDate={parseDateString(filters.endDate) || undefined}
            minDate={parseDateString(filters.startDate) || undefined}
            maxDate={new Date()}
            id="endDate"
            {...datePickerProps}
          />
        </div>

        {/* Author Search */}
        {/* ... author input remains the same ... */}
         <div className="flex flex-col flex-1 min-w-[180px] overflow-visible"> {/* No longer needs form-group-full-width */}
          <label htmlFor="searchAuthors">Authors:</label>
          <input
            type="text"
            id="searchAuthors"
            name="searchAuthors"
            placeholder="e.g., Hinton, LeCun"
            value={filters.searchAuthors || ''}
            onChange={handleInputChange}
            className="px-3 py-2 text-[0.95em] text-left font-[inherit] text-[var(--text-color,#212529)] bg-[var(--input-background,#fff)] border border-[var(--border-color)] rounded transition-[border-color,box-shadow] duration-200 w-full box-border overflow-visible focus:outline-none focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.2)]"
          />
        </div>
      </div>

      {/* Action Buttons */}
      {/* ... buttons remain the same ... */}
      <div className="flex gap-2.5 justify-end flex-wrap mt-2.5">
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