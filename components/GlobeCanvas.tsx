import React, { useState } from 'react';
import type { Mission, ImpactParameters, SimulationResult } from '../types';
import { HistoricalImpactPreset } from '../data/impactPresets';
import MapCanvas from './MapCanvas';
import AsteroidPresetSelector from './AsteroidPresetSelector';

const styles = {
  globeContainer: {
    position: 'relative' as const,
    width: '100%',
    height: '100%'
  },
  presetSelectorContainer: {
    position: 'absolute' as const,
    right: '20px',
    top: '20px',
    width: '350px',
    maxHeight: 'calc(100% - 40px)',
    zIndex: 1000,
    overflowY: 'auto' as const,
    background: 'rgba(26, 32, 44, 0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }
};

interface GlobeCanvasProps {
  mission: Mission;
  parameters?: ImpactParameters;
  onCitySelected?: (city: { 
    name: string; 
    latitude: number; 
    longitude: number; 
    country?: string 
  }) => void;
  onLocationSelected?: (
    lat: number,
    lng: number,
    details?: {
      city?: string;
      country?: string;
      nearestCity?: string;
    }
  ) => void;
  onRunSimulation?: (result: SimulationResult) => void;
  isSimulating?: boolean;
  showResults?: boolean;
  externalSelection?: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
  } | null;
  onMeteorAnimationComplete?: () => void;
  imageryLayer?: string;
  imageryDate?: string;
  showPresetSelector?: boolean;
}

export default function GlobeCanvas({ 
  mission, 
  onLocationSelected,
  onRunSimulation,
  isSimulating,
  showResults,
  externalSelection,
  onMeteorAnimationComplete,
  imageryLayer,
  imageryDate,
  showPresetSelector = false
}: GlobeCanvasProps): JSX.Element {
  const [selectedPreset, setSelectedPreset] = useState<HistoricalImpactPreset | undefined>();

  const handlePresetSelected = (parameters: ImpactParameters, preset: HistoricalImpactPreset) => {
    setSelectedPreset(preset);
    if (onRunSimulation && externalSelection) {
      const result: SimulationResult = {
        impact_energy_j: 0,
        impact_energy_mt: 0,
        crater_m: parameters.diameter_m * 10,
        crater_km: parameters.diameter_m * 0.01,
        blast_radius_m: parameters.diameter_m * 100,
        blast_radius_km: parameters.diameter_m * 0.1,
        thermal_radius_m: parameters.diameter_m * 50,
        thermal_radius_km: parameters.diameter_m * 0.05,
        seismic_magnitude: 0,
        latitude: externalSelection.lat,
        longitude: externalSelection.lng,
        location: externalSelection.city,
        population_affected: 0,
        visualEffects: preset.visualEffects
      };
      onRunSimulation(result);
    }
  };

  return (
    <div style={styles.globeContainer}>
      <MapCanvas 
        mission={mission} 
        onRunSimulation={onRunSimulation}
        isSimulating={isSimulating}
        showResults={showResults}
        externalSelection={externalSelection}
        onLocationSelected={onLocationSelected}
        onMeteorAnimationComplete={onMeteorAnimationComplete}
        imageryLayer={imageryLayer}
        imageryDate={imageryDate}
      />
      {showPresetSelector && (
        <div style={styles.presetSelectorContainer}>
          <AsteroidPresetSelector
            onPresetSelected={handlePresetSelected}
            selectedPreset={selectedPreset}
          />
        </div>
      )}
    </div>
  );
}