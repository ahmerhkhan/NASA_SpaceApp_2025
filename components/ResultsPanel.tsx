import React from 'react';
import type { SimulationResult, Mission } from '../types';

interface ResultsPanelProps {
  mission: Mission;
  isVisible: boolean;
}

export default function ResultsPanel({ mission, isVisible }: ResultsPanelProps) {
  if (!isVisible || !mission.result) {
    return (
      <div className="results-panel">
        <div className="panel-header">
          <h2>Simulation Results</h2>
          <p className="panel-subtitle">Run a simulation to see impact effects</p>
        </div>
        <div className="no-results">
          <p>No simulation data available. Configure parameters and run a simulation to see results.</p>
        </div>
      </div>
    );
  }

  const { result } = mission;
  const energyMegatons = result.impact_energy_mt;

  const getImpactLevel = (craterKm: number): string => {
    if (craterKm < 50) return 'Regional impact';
    if (craterKm < 150) return 'Continental impact';
    return 'Global extinction';
  };

  const getSeismicDescription = (magnitude: number): string => {
    if (magnitude < 3) return 'Minor earthquake';
    if (magnitude < 5) return 'Moderate earthquake';
    if (magnitude < 7) return 'Strong earthquake';
    if (magnitude < 8) return 'Major earthquake';
    if (magnitude < 10) return 'Great earthquake';
    return 'Mega-earthquake (extinction level)';
  };

  return (
    <div className="results-panel">
      <div className="panel-header">
        <h2>Simulation Results</h2>
        {result.location && (
          <p className="panel-subtitle">Impact Location: {result.location}</p>
        )}
      </div>

      <div className="result-section">
        <h3>Impact Energy</h3>
        <div className="metric-grid">
          <div className="metric">
            <div className="metric-value">{energyMegatons.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="metric-label">Megatons TNT Equivalent</div>
          </div>
          <div className="metric">
            <div className="metric-value">{getImpactLevel(result.crater_km)}</div>
            <div className="metric-label">Impact Level</div>
          </div>
          {typeof result.population_affected === 'number' && (
            <div className="metric">
              <div className="metric-value">{result.population_affected.toLocaleString('en-US')}</div>
              <div className="metric-label">Estimated Population Affected</div>
            </div>
          )}
        </div>
      </div>

      {/* Top Affected Cities */}
      {result.affectedCities && result.affectedCities.length > 0 && (
        <div className="result-section">
          <h3>Most Affected Cities</h3>
          <div className="cities-list">
            {result.affectedCities.slice(0, 3).map((city, index) => (
              <div key={`${city.name}-${index}`} className="city-item">
                <div className="city-rank">#{index + 1}</div>
                <div className="city-details">
                  <div className="city-name">{city.name}</div>
                  <div className="city-country">{city.country}</div>
                </div>
                <div className="city-stats">
                  <div className="city-population">{city.population.toLocaleString('en-US')} people</div>
                  <div className="city-distance">{city.distance.toFixed(1)} km away</div>
                  {city.zones && city.zones.length > 0 && (
                    <div className="city-zones">Zones: {city.zones.join(', ')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Physical Effects */}
      <div className="result-section">
        <h3>Physical Effects</h3>
        <div className="effects-grid">
          <div className="effect-item">
            <div className="effect-icon crater">●</div>
            <div className="effect-details">
              <div className="effect-name">Crater</div>
              <div className="effect-value">{result.crater_km.toFixed(1)} km diameter</div>
            </div>
          </div>
          <div className="effect-item">
            <div className="effect-icon blast">●</div>
            <div className="effect-details">
              <div className="effect-name">Blast Radius</div>
              <div className="effect-value">{result.blast_radius_km.toFixed(1)} km</div>
            </div>
          </div>
          <div className="effect-item">
            <div className="effect-icon thermal">●</div>
            <div className="effect-details">
              <div className="effect-name">Thermal Radius</div>
              <div className="effect-value">{result.thermal_radius_km.toFixed(1)} km</div>
            </div>
          </div>
          <div className="effect-item">
            <div className="effect-icon seismic">●</div>
            <div className="effect-details">
              <div className="effect-name">Seismic Magnitude</div>
              <div className="effect-value">{result.seismic_magnitude.toFixed(1)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Damage Zones Legend */}
      <div className="result-section">
        <h3>Damage Zones</h3>
        <div className="zones-legend">
          <div className="zone-item">
            <div className="zone-color crater"></div>
            <div className="zone-label">Crater Zone</div>
            <div className="zone-description">{(result.crater_km / 2).toFixed(1)} km radius • {result.crater_km.toFixed(1)} km diameter</div>
          </div>
          <div className="zone-item">
            <div className="zone-color blast"></div>
            <div className="zone-label">Blast Zone</div>
            <div className="zone-description">{result.blast_radius_km.toFixed(1)} km radius • {(result.blast_radius_km * 2).toFixed(1)} km diameter</div>
          </div>
          <div className="zone-item">
            <div className="zone-color thermal"></div>
            <div className="zone-label">Thermal Radiation Zone</div>
            <div className="zone-description">{result.thermal_radius_km.toFixed(1)} km radius • {(result.thermal_radius_km * 2).toFixed(1)} km diameter</div>
          </div>
        </div>
        <div className="scaling-note">
          <p><strong>Scaling:</strong> Blast radius = 3× crater radius • Thermal radius = 1.8× crater radius</p>
          <p><strong>Note:</strong> All radii are capped at Earth's radius (6,371 km) for realism.</p>
        </div>
      </div>

      {/* Seismic Effects */}
      <div className="result-section">
        <h3>Seismic Effects</h3>
        <div className="seismic-info">
          <div className="seismic-magnitude">
            <span className="magnitude-value">{result.seismic_magnitude.toFixed(1)}</span>
            <span className="magnitude-label">Richter Scale</span>
          </div>
          <div className="seismic-description">
            {getSeismicDescription(result.seismic_magnitude)}
          </div>
        </div>
      </div>

      {/* Population Totals by Zone */}
      {(typeof result.crater_population_total === 'number' || typeof result.blast_population_total === 'number' || typeof result.thermal_population_total === 'number') && (
        <div className="result-section">
          <h3>Population Totals by Zone</h3>
          <div className="metric-grid">
            {typeof result.crater_population_total === 'number' && (
              <div className="metric">
                <div className="metric-value">{result.crater_population_total.toLocaleString('en-US')}</div>
                <div className="metric-label">Crater Zone</div>
              </div>
            )}
            {typeof result.blast_population_total === 'number' && (
              <div className="metric">
                <div className="metric-value">{result.blast_population_total.toLocaleString('en-US')}</div>
                <div className="metric-label">Blast Zone</div>
              </div>
            )}
            {typeof result.thermal_population_total === 'number' && (
              <div className="metric">
                <div className="metric-value">{result.thermal_population_total.toLocaleString('en-US')}</div>
                <div className="metric-label">Thermal Zone</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Educational Footer */}
      <div className="educational-footer">
        <p>
          <strong>Educational Note:</strong> These calculations are simplified approximations 
          for educational purposes. Real impact effects vary significantly based on target 
          geology, atmospheric conditions, and impactor composition.
        </p>
      </div>
    </div>
  );
}
