import React, { useState } from 'react';

interface EducationalTooltipProps {
  title: string;
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function EducationalTooltip({ 
  title, 
  content, 
  children, 
  position = 'top' 
}: EducationalTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'tooltip-top',
    bottom: 'tooltip-bottom',
    left: 'tooltip-left',
    right: 'tooltip-right'
  };

  return (
    <div 
      className="educational-tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`educational-tooltip ${positionClasses[position]}`}>
          <div className="tooltip-header">
            <h4>{title}</h4>
            <button 
              className="tooltip-close"
              onClick={() => setIsVisible(false)}
              aria-label="Close tooltip"
            >
              ×
            </button>
          </div>
          <div className="tooltip-content">
            <p>{content}</p>
          </div>
          <div className="tooltip-arrow"></div>
        </div>
      )}
    </div>
  );
}
