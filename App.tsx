import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ParameterPanel from './components/ParameterPanel';
import ResultsPanel from './components/ResultsPanel';
import CesiumGlobe from './components/CesiumGlobe';
import SearchBar from './components/SearchBar';
import SelectedLocation from './components/SelectedLocation';
import { HISTORICAL_PRESETS } from './data/impactPresets';
import { simulateImpactor } from './lib/physics';
import type { Mission, ImpactParameters, UIState, SimulationResult } from './types';
import './styles/globals.css';
import * as Cesium from 'cesium';
import { geocodeSearch } from './lib/geocoding';
import { preloadCities } from './utils/geocoding';

// Ensure Ion token is set once at startup
if (!Cesium.Ion.defaultAccessToken) {
  try {
    const runtimeToken = typeof window !== 'undefined' ? (window as any).CESIUM_ION_TOKEN as string | undefined : undefined;
    const demoToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mZmZiLTQxOGUtODQ5Yy1mYzQ0M2I0M2Y0YjAiLCJpZCI6NTc3MzMsImlhdCI6MTYyNTM0NDQ5N30.1g_8q4XjLp7WfR3XqQ3XqQ3XqQ3XqQ3XqQ3XqQ3XqQ3XqQ';
    Cesium.Ion.defaultAccessToken = (process.env.REACT_APP_CESIUM_ION_TOKEN as string) || runtimeToken || demoToken || '';
  } catch {}
}

// Icons
const PlayIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// Custom Slider Component
interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  color?: string;
}

const Slider: React.FC<SliderProps> = ({ label, value, onChange, min, max, unit, color = "cyan" }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <span className="px-3 py-1 text-sm font-mono bg-gray-800 text-white rounded-md">
          {value.toLocaleString()} {unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-${color}`}
        />
      </div>
    </div>
  );
};

// Result Card Component
interface ResultCardProps {
  title: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color?: string;
  isAnimating?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ title, value, unit, icon, color = "blue", isAnimating = false }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isAnimating) {
      setDisplayValue(0);
      const duration = 2000;
      const start = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.floor(value * easeOut));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    } else {
      setDisplayValue(value);
    }
  }, [value, isAnimating]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:bg-gray-800/70 transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {icon}
          <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        </div>
        <div className={`w-3 h-3 rounded-full bg-${color}-500`}></div>
      </div>
      <div className="space-y-1">
        <p className={`text-2xl font-bold text-${color}-400`}>
          {displayValue.toLocaleString()}
        </p>
        <p className="text-xs text-gray-500">{unit}</p>
      </div>
    </motion.div>
  );
};

// Collapsible Section
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  allowOverflow?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = true, allowOverflow = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        <ChevronDownIcon />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={allowOverflow ? "overflow-visible" : "overflow-hidden"}
          >
            <div className="space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  useEffect(() => {
    // Warm up city dataset early so first keystroke returns suggestions
    preloadCities().catch(() => {});
  }, []);
  // State
  const [mission, setMission] = useState<Mission>({
    lat: 24.8607,
    lng: 67.0011,
    result: null
  });

  const [parameters, setParameters] = useState<ImpactParameters>({
    diameter_m: 200,
    density_kgm3: 3000,
    velocity_kms: 20,
    angle_deg: 45
  });

  const [uiState, setUIState] = useState<UIState>({
    selectedLocation: { lat: 24.8607, lng: 67.0011 },
    isSimulating: false,
    showResults: false,
    activeTab: 'parameters'
  });

  const [externalSelection, setExternalSelection] = useState<{
    lat: number;
    lng: number;
    city?: string;
    country?: string;
    population?: number;
  } | null>(null);

  const handleCitySelect = useCallback((city: { 
    name: string; 
    latitude: number; 
    longitude: number; 
    country?: string;
    population?: number;
  }) => {
    setMission(prev => ({
      ...prev,
      lat: city.latitude,
      lng: city.longitude,
      cityName: city.name,
      country: city.country
    }));

    setUIState(prev => ({
      ...prev,
      selectedLocation: { 
        lat: city.latitude, 
        lng: city.longitude 
      }
    }));

    setExternalSelection({
      lat: city.latitude,
      lng: city.longitude,
      city: city.name,
      country: city.country,
      population: city.population
    });
  }, []);


  // Calculate results
  const impactEnergy = mission.result ? Math.round(mission.result.impact_energy_mt) : 0;
  const craterDiameter = mission.result ? Math.round(mission.result.crater_km) : 0;
  const magnitude = mission.result ? Math.round(mission.result.seismic_magnitude * 10) / 10 : 0;
  const populationAffected = mission.result?.population_affected || 0;
  const blastRadius = mission.result ? Math.round(mission.result.blast_radius_km) : 0;
  const thermalRadius = mission.result ? Math.round(mission.result.thermal_radius_km) : 0;

  const handleRunSimulation = useCallback(async () => {
    if (!mission.lat || !mission.lng) {
      alert('Please select a location before running simulation');
      return;
    }

    setUIState(prev => ({ 
      ...prev, 
      isSimulating: true,
      showResults: false 
    }));
    
    try {
      // Simulate physics once
      const simulationParams = {
        ...parameters,
        lat: mission.lat,
        lng: mission.lng
      } as ImpactParameters;

      const result = simulateImpactor(simulationParams);
      // Store result but do NOT show results yet; CesiumGlobe will animate and then call back
      setMission(prev => ({ ...prev, result }));
      // Keep isSimulating true; showResults remains false until globe callback
    } catch (error) {
      console.error('Simulation preparation failed:', error);
      setUIState(prev => ({ 
        ...prev, 
        isSimulating: false, 
        showResults: false 
      }));
      alert('Simulation failed. Please check your parameters and location.');
    }
  }, [parameters, mission.lat, mission.lng]);

  const onRunSimulationFromGlobe = useCallback((res: SimulationResult) => {
    // Store populated results from globe (includes affected population & cities)
    setMission(prev => ({ ...prev, result: res }));
    setUIState(prev => ({ 
      ...prev, 
      isSimulating: false,
      showResults: true
    }));
  }, []);

  const handleParametersChange = useCallback((newParams: ImpactParameters) => {
    setParameters(newParams);
  }, []);

  

  // Apply historical preset from left panel
  const applyHistoricalPreset = useCallback((presetName: string) => {
    const preset = HISTORICAL_PRESETS.find(p => p.name === presetName);
    if (!preset) return;

    // update local parameters and move map
    setParameters(preset.parameters);
    if (preset.location && typeof preset.location.lat === 'number' && typeof preset.location.lon === 'number') {
      const lat = preset.location.lat as number;
      const lon = preset.location.lon as number;

      setMission(prev => ({
        ...prev,
        lat,
        lng: lon,
        cityName: preset.name
      }));

      setExternalSelection({
        lat,
        lng: lon,
        city: preset.name
      });
    }
  }, []);

  const handleLocationSelect = useCallback((
    lat: number, 
    lon: number, 
    details?: {
      city?: string;
      country?: string;
      population?: number;
      nearestCity?: string;
    }
  ) => {
    setMission(prev => ({
      ...prev,
      lat,
      lng: lon,
      cityName: details?.city || details?.nearestCity,
      country: details?.country,
      closestCity: details?.nearestCity
    }));

    setUIState(prev => ({
      ...prev,
      selectedLocation: { 
        lat, 
        lng: lon 
      }
    }));
  }, []);

  // Handler for SearchBar component
  const handleSearchBarLocationSelect = useCallback((
    city: string,
    country: string,
    population: number,
    lat: number,
    lng: number
  ) => {
    handleCitySelect({
      name: city,
      latitude: lat,
      longitude: lng,
      country: country,
      population: population
    });
  }, [handleCitySelect]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      <div className="relative z-10 flex h-screen max-h-screen">
        {/* Left Panel - Parameters */}
        <motion.div
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-80 bg-gray-900/80 backdrop-blur-xl border-r border-gray-700 p-6 flex flex-col h-full"
        >
          <div className="space-y-8 flex-1 min-h-0 overflow-y-auto overflow-x-visible">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Meteor Impact Simulator</h2>
              <p className="text-sm text-gray-400">Configure parameters and simulate impacts worldwide</p>
            </div>

            <CollapsibleSection title="Historical Events" defaultOpen={false}>
              <div className="space-y-2">
                {HISTORICAL_PRESETS.map(p => (
                  <div key={p.name} className="space-y-1">
                    <button
                      onClick={() => applyHistoricalPreset(p.name)}
                      className="w-full text-left px-3 py-2 rounded bg-gray-900/80 hover:bg-gray-900 border border-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{p.name}</span>
                        {p.year && <span className="text-sm text-gray-300">{p.year}</span>}
                      </div>
                      <p className="text-sm text-gray-300 mt-1">{p.description}</p>
                    </button>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Impact Parameters" defaultOpen={true}>
              <div className="space-y-6">
                <Slider
                  label="Meteor Diameter"
                  value={parameters.diameter_m}
                  onChange={(val) => setParameters(prev => ({ ...prev, diameter_m: val }))}
                  min={10}
                  max={15000}
                  unit="m"
                  color="cyan"
                />

                <Slider
                  label="Impact Velocity"
                  value={parameters.velocity_kms}
                  onChange={(val) => setParameters(prev => ({ ...prev, velocity_kms: val }))}
                  min={11}
                  max={50}
                  unit="km/s"
                  color="orange"
                />

                <Slider
                  label="Impact Angle"
                  value={parameters.angle_deg}
                  onChange={(val) => setParameters(prev => ({ ...prev, angle_deg: val }))}
                  min={10}
                  max={90}
                  unit="°"
                  color="pink"
                />

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-300">Material Density</label>
                  <select
                    value={parameters.density_kgm3}
                    onChange={(e) => setParameters(prev => ({ ...prev, density_kgm3: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={917}>Ice (917 kg/m³)</option>
                    <option value={2700}>Rock (2700 kg/m³)</option>
                    <option value={8000}>Iron (8000 kg/m³)</option>
                  </select>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Target Location" defaultOpen={true} allowOverflow={true}>
              <div className="space-y-6 p-4">
                <div className="space-y-6">
                  <div className="search-container">
                    <SearchBar
                      onLocationSelected={handleSearchBarLocationSelect}
                      placeholder="Search for a city..."
                      className="w-full"
                    />
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    Or click on the globe to select a location
                  </div>
                </div>
                
                <SelectedLocation
                  cityName={mission.cityName}
                  country={mission.country}
                  population={externalSelection?.population}
                  lat={mission.lat}
                  lng={mission.lng}
                />
              </div>
            </CollapsibleSection>
            
            <div className="mt-8">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleRunSimulation}
                disabled={uiState.isSimulating}
                className="w-full text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl"
                style={{ 
                  backgroundColor: '#1f2937',
                  border: '1px solid #4b5563',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#374151';
                  e.currentTarget.style.borderColor = '#6b7280';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1f2937';
                  e.currentTarget.style.borderColor = '#4b5563';
                }}
              >
                <PlayIcon />
                <span className="text-lg">{uiState.isSimulating ? 'SIMULATING...' : 'RUN SIMULATION'}</span>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Center Panel - Globe */}
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full h-full max-w-4xl max-h-4xl bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 shadow-2xl overflow-hidden"
          >
            <CesiumGlobe
              mission={mission}
              onRunSimulation={onRunSimulationFromGlobe}
              isSimulating={uiState.isSimulating}
              onLocationSelected={handleLocationSelect}
              externalSelection={externalSelection || undefined}
            />
          </motion.div>
        </div>

        {/* Right Panel - Results */}
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-80 bg-gray-900/80 backdrop-blur-xl border-l border-gray-700 p-6 overflow-y-auto flex flex-col h-full"
        >
          <div className="space-y-6 flex-1 min-h-0">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Impact Assessment</h2>
              <p className="text-sm text-gray-400">Simulation results and damage estimates</p>
            </div>

            {uiState.showResults && mission.result ? (
              <div className="space-y-6">
                <CollapsibleSection title="Physical Effects" defaultOpen={true}>
                  <ResultCard
                    title="Impact Energy"
                    value={impactEnergy}
                    unit="Megatons TNT"
                    icon={<div className="w-4 h-4 bg-cyan-500 rounded-full"></div>}
                    color="cyan"
                    isAnimating={uiState.isSimulating}
                  />
                  <ResultCard
                    title="Crater Diameter"
                    value={craterDiameter}
                    unit="Kilometers"
                    icon={<div className="w-4 h-4 bg-orange-500 rounded-full"></div>}
                    color="orange"
                    isAnimating={uiState.isSimulating}
                  />
                  <ResultCard
                    title="Seismic Magnitude"
                    value={magnitude}
                    unit="Richter Scale"
                    icon={<div className="w-4 h-4 bg-pink-500 rounded-full"></div>}
                    color="pink"
                    isAnimating={uiState.isSimulating}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Damage Zones" defaultOpen={true}>
                  <ResultCard
                    title="Blast Radius"
                    value={blastRadius}
                    unit="Kilometers"
                    icon={<div className="w-4 h-4 bg-yellow-500 rounded-full"></div>}
                    color="yellow"
                    isAnimating={uiState.isSimulating}
                  />
                  <ResultCard
                    title="Thermal Radius"
                    value={thermalRadius}
                    unit="Kilometers"
                    icon={<div className="w-4 h-4 bg-green-500 rounded-full"></div>}
                    color="green"
                    isAnimating={uiState.isSimulating}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Human Impact" defaultOpen={true}>
                  <ResultCard
                    title="Population Affected"
                    value={populationAffected}
                    unit="People"
                    icon={<div className="w-4 h-4 bg-red-500 rounded-full"></div>}
                    color="red"
                    isAnimating={uiState.isSimulating}
                  />
                  {/* Per-zone totals */}
                  {mission.result && (typeof mission.result.crater_population_total === 'number' || typeof mission.result.blast_population_total === 'number' || typeof mission.result.thermal_population_total === 'number') && (
                    <div className="space-y-3 bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                      <div className="text-sm font-semibold text-gray-300">Population by Zone</div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        {typeof mission.result.crater_population_total === 'number' && (
                          <div>
                            <div className="text-lg font-bold text-gray-100">{mission.result.crater_population_total.toLocaleString('en-US')}</div>
                            <div className="text-xs text-gray-400">Crater</div>
                          </div>
                        )}
                        {typeof mission.result.blast_population_total === 'number' && (
                          <div>
                            <div className="text-lg font-bold text-gray-100">{mission.result.blast_population_total.toLocaleString('en-US')}</div>
                            <div className="text-xs text-gray-400">Blast</div>
                          </div>
                        )}
                        {typeof mission.result.thermal_population_total === 'number' && (
                          <div>
                            <div className="text-lg font-bold text-gray-100">{mission.result.thermal_population_total.toLocaleString('en-US')}</div>
                            <div className="text-xs text-gray-400">Thermal</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Top affected cities */}
                  {mission.result?.affectedCities && mission.result.affectedCities.length > 0 && (
                    <div className="space-y-2 bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                      <div className="text-sm font-semibold text-gray-300">Top Affected Cities</div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {mission.result.affectedCities.slice(0, 10).map((c, idx) => (
                          <div key={`${c.name}-${idx}`} className="flex items-center justify-between text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-gray-100">#{idx + 1} {c.name}{c.country ? `, ${c.country}` : ''}</div>
                              <div className="text-gray-400 text-xs">{c.distance.toFixed(1)} km • {c.population.toLocaleString('en-US')} ppl{c.zones && c.zones.length ? ` • ${c.zones.join(', ')}` : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleSection>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TargetIcon />
                </div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">No Simulation Data</h3>
                <p className="text-sm text-gray-500">Run a simulation to see impact results</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}