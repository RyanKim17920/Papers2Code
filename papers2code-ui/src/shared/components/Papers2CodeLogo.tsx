import React from 'react';

interface Papers2CodeLogoProps {
  className?: string;
  iconOnly?: boolean;
  textClassName?: string;
}

/**
 * Papers2Code logo as inline SVG — adapts to dark/light mode automatically.
 * Document outline + text lines use currentColor (inherits from parent).
 * Code brackets use the primary brand color.
 * Text is real HTML for SEO crawlability.
 */
const Papers2CodeLogo: React.FC<Papers2CodeLogoProps> = ({
  className = '',
  iconOnly = false,
  textClassName = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Papers2Code">
      {/* Icon mark */}
      <svg
        viewBox="0 0 48 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto shrink-0"
        aria-hidden="true"
        role="img"
      >
        {/* Document body */}
        <path
          d="M6 4C6 2.9 6.9 2 8 2H28L40 14V44C40 45.1 39.1 46 38 46H8C6.9 46 6 45.1 6 44V4Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Fold */}
        <path
          d="M28 2V12C28 13.1 28.9 14 30 14H40"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Text lines on document */}
        <line x1="14" y1="22" x2="28" y2="22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="14" y1="29" x2="23" y2="29" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        {/* Code brackets </> in primary blue */}
        <g stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="19,36 12,42 19,48" />
          <polyline points="33,36 40,42 33,48" />
          <line x1="29" y1="34" x2="23" y2="50" />
        </g>
      </svg>
      {/* Text — real HTML for SEO */}
      {!iconOnly && (
        <span className={`font-bold tracking-tight leading-none whitespace-nowrap ${textClassName}`}>
          papers<span className="text-primary">2</span>code
        </span>
      )}
    </span>
  );
};

export default Papers2CodeLogo;
