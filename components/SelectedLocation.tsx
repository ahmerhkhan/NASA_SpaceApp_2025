import React from 'react';

interface SelectedLocationProps {
  cityName?: string;
  country?: string;
  population?: number;
  lat?: number;
  lng?: number;
}

export default function SelectedLocation({ 
  cityName, 
  country, 
  population, 
  lat, 
  lng 
}: SelectedLocationProps) {
  if (!cityName) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
        <div className="text-center text-gray-400">
          <div className="text-sm">No location selected</div>
          <div className="text-xs mt-1">Search for a city or click on the globe</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-2">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
        <div className="text-white font-semibold text-lg">{cityName}</div>
      </div>
      
      <div className="text-gray-300 text-sm">
        {country && <span>{country}</span>}
      </div>
      
      {lat && lng && (
        <div className="text-xs text-gray-500">
          {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
        </div>
      )}
    </div>
  );
}
