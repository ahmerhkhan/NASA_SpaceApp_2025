import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ImpactParameters, ImpactorPreset } from '../types';
import { IMPACTOR_PRESETS } from '../types';
import { geocodeSearch } from '../lib/geocoding';

interface ParameterPanelProps {
  parameters: ImpactParameters;
  onParametersChange: (params: ImpactParameters) => void;
  onRunSimulation: () => void;
  isSimulating: boolean;
  onCitySelect?: (city: { 
    name: string; 
    latitude: number; 
    longitude: number; 
    country?: string 
  }) => void;
  selectedLocation: { lat: number; lng: number };
}

interface GeocodingResult {
  lat: number;
  lon: number;
  city: string;
  country: string;
  display_name: string;
}

export default function ParameterPanel({ 
  parameters, 
  onParametersChange, 
  onRunSimulation, 
  isSimulating,
  onCitySelect,
  selectedLocation
}: ParameterPanelProps) {
  const [cityQuery, setCityQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [isSelecting, setIsSelecting] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const parameterDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const geocodeCache = useRef<Map<string, GeocodingResult[]>>(new Map())
  const cacheOrder = useRef<string[]>([])
  const MAX_CACHE_ITEMS = 50

  useEffect(() => {
    try {
      const raw = localStorage.getItem('geo_cache_v1')
      if (raw) {
        const parsed = JSON.parse(raw) as { entries: [string, GeocodingResult[]][], order: string[] }
        geocodeCache.current = new Map(parsed.entries)
        cacheOrder.current = parsed.order || []
      }
    } catch {}
  }, [])

  const persistCache = () => {
    try {
      const payload = { entries: Array.from(geocodeCache.current.entries()), order: cacheOrder.current }
      localStorage.setItem('geo_cache_v1', JSON.stringify(payload))
    } catch {}
  }

  const touchKey = (key: string) => {
    const idx = cacheOrder.current.indexOf(key)
    if (idx !== -1) cacheOrder.current.splice(idx, 1)
    cacheOrder.current.unshift(key)
    while (cacheOrder.current.length > MAX_CACHE_ITEMS) {
      const drop = cacheOrder.current.pop()
      if (drop) geocodeCache.current.delete(drop)
    }
  }

  // Use shared famous-event presets
  const presets: ImpactorPreset[] = IMPACTOR_PRESETS

  // Debounced city search
  const searchCities = useCallback(async (query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (isSelecting || query.length < 2) {
      setSuggestions([])
      return
    }

    // Serve from cache if present
    if (geocodeCache.current.has(query)) {
      setSuggestions(geocodeCache.current.get(query)!)
      setSelectedSuggestionIndex(-1)
      touchKey(query)
      persistCache()
      return
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await geocodeSearch(query)
        geocodeCache.current.set(query, results)
        touchKey(query)
        persistCache()
        setSuggestions(results)
        setSelectedSuggestionIndex(-1)
      } catch (error) {
        console.error('City search failed:', error)
        setSuggestions([])
      }
    }, 300)
  }, [isSelecting])

  // Handle input changes
  const handleCitySearch = (query: string) => {
    setCityQuery(query)
    searchCities(query)
  }

  // Handle city selection
  const selectCity = useCallback((city: GeocodingResult) => {
    // Prevent multiple selections
    if (isSelecting) return
    setIsSelecting(true)

    // Trigger city selection callback
    onCitySelect?.({
      name: city.city,
      latitude: city.lat,
      longitude: city.lon,
      country: city.country
    })

    // Reset search
    setCityQuery('')
    setSuggestions([])
    setSelectedSuggestionIndex(-1)
    
    // Allow new selections after a short delay
    setTimeout(() => {
      setIsSelecting(false)
    }, 500)
  }, [onCitySelect, isSelecting])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0 || isSelecting) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : prev
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
          selectCity(suggestions[selectedSuggestionIndex])
        } else if (suggestions.length > 0) {
          // Select first suggestion if no specific one is selected
          selectCity(suggestions[0])
        }
        break
      case 'Escape':
        e.preventDefault()
        setSuggestions([])
        setSelectedSuggestionIndex(-1)
        break
    }
  }, [suggestions, selectedSuggestionIndex, selectCity, isSelecting])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setSuggestions([])
        setSelectedSuggestionIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Update parameters with debouncing
  const updateParameters = (key: keyof ImpactParameters, value: number) => {
    // Clear existing debounce timer
    if (parameterDebounceRef.current) {
      clearTimeout(parameterDebounceRef.current)
    }
    
    // Debounce parameter changes to avoid excessive re-renders
    parameterDebounceRef.current = setTimeout(() => {
      onParametersChange({
        ...parameters,
        [key]: value
      })
    }, 150) // 150ms debounce
  }

  // Apply preset
  const applyPreset = (preset: ImpactorPreset) => {
    onParametersChange(preset.parameters)
    // If preset includes a historical location, notify parent to move globe/map
    if (preset.location && preset.location.lat != null && preset.location.lon != null) {
      onCitySelect?.({
        name: preset.name,
        latitude: preset.location.lat,
        longitude: preset.location.lon
      })
    }
  }

  // Run Simulation button handler
  const handleRunSimulation = useCallback(() => {
    // Validate parameters before running simulation
    if (!selectedLocation) {
      alert('Please select a location first');
      return;
    }

    // Prepare simulation parameters
    const simulationParams: ImpactParameters = {
      ...parameters,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng
    };

    // Run simulation and trigger callback
    onRunSimulation();
  }, [parameters, selectedLocation, onRunSimulation]);

  return (
    <div className="parameter-panel">
      {/* City Search */}
      <div className="parameter-group" style={{ position: 'relative' }}>
        <label className="parameter-label">Search City</label>
        <input 
          ref={inputRef}
          type="text" 
          placeholder="Type city name" 
          value={cityQuery}
          onChange={(e) => handleCitySearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="preset-select"
          style={{ width: '100%' }}
          autoComplete="off"
          disabled={isSelecting}
        />
        {suggestions.length > 0 && !isSelecting && (
          <div 
            ref={suggestionsRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              maxHeight: '200px',
              overflowY: 'auto',
              backgroundColor: '#f9f9f9',
              border: '1px solid #ccc',
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              borderRadius: '4px'
            }}
          >
            {suggestions.map((city, index) => (
              <div 
                key={city.display_name}
                onClick={() => selectCity(city)}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  backgroundColor: index === selectedSuggestionIndex 
                    ? '#e6f2ff' 
                    : 'white',
                  color: '#333',
                  borderBottom: '1px solid #eee'
                }}
                className="hover:bg-gray-100"
              >
                {city.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asteroid Parameters */}
      <div className="parameter-group">
        <label className="parameter-label">Asteroid Diameter (m)</label>
        <input 
          type="range" 
          min="10" 
          max="15000" 
          value={parameters.diameter_m} 
          onChange={(e) => updateParameters('diameter_m', Number(e.target.value))}
          className="parameter-slider"
        />
        <div className="slider-labels">
          <span>10</span>
          <span>{parameters.diameter_m}</span>
          <span>15000</span>
        </div>
      </div>

      <div className="parameter-group">
        <label className="parameter-label">Asteroid Density (kg/m³)</label>
        <input 
          type="range" 
          min="1000" 
          max="5000" 
          value={parameters.density_kgm3} 
          onChange={(e) => updateParameters('density_kgm3', Number(e.target.value))}
          className="parameter-slider"
        />
        <div className="slider-labels">
          <span>1000</span>
          <span>{parameters.density_kgm3}</span>
          <span>5000</span>
        </div>
      </div>

      <div className="parameter-group">
        <label className="parameter-label">Impact Velocity (km/s)</label>
        <input 
          type="range" 
          min="5" 
          max="50" 
          value={parameters.velocity_kms} 
          onChange={(e) => updateParameters('velocity_kms', Number(e.target.value))}
          className="parameter-slider"
        />
        <div className="slider-labels">
          <span>5</span>
          <span>{parameters.velocity_kms}</span>
          <span>50</span>
        </div>
      </div>

      <div className="parameter-group">
        <label className="parameter-label">Impact Angle (degrees)</label>
        <input 
          type="range" 
          min="0" 
          max="90" 
          value={parameters.angle_deg} 
          onChange={(e) => updateParameters('angle_deg', Number(e.target.value))}
          className="parameter-slider"
        />
        <div className="slider-labels">
          <span>0°</span>
          <span>{parameters.angle_deg}°</span>
          <span>90°</span>
        </div>
      </div>

      {/* Preset Selection */}
      <div className="parameter-group">
        <label className="parameter-label">Historic Asteroid Presets</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
          {presets.map(preset => (
            <button 
              key={preset.name} 
              onClick={() => applyPreset(preset)}
              className="preset-select"
              title={`${preset.name} • ${preset.year || ''} — ${preset.description}`.trim()}
              style={{ textAlign: 'left' }}
            >
              {preset.name}{preset.year ? ` (${preset.year})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Simulation Button */}
      <button 
        onClick={onRunSimulation}
        disabled={isSimulating}
        className="simulate-button"
      >
        {isSimulating ? 'Running Simulation...' : 'Run Impact Simulation'}
      </button>

      {/* Educational Note */}
      <div className="educational-note">
        <p>
          <strong>Note:</strong> These calculations are simplified for educational purposes. 
          Real impact effects depend on many complex factors including atmospheric conditions, 
          target geology, and impactor composition.
        </p>
      </div>
    </div>
  );
}
