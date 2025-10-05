import React from 'react';
import { HISTORICAL_PRESETS, HistoricalImpactPreset } from '../data/impactPresets';
import { ImpactParameters } from '../types';

const styles = {
  presetSelector: {
    padding: '1rem',
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '8px',
    color: 'white'
  },
  presetList: {
    display: 'grid',
    gap: '1rem',
    maxHeight: '70vh',
    overflowY: 'auto' as const
  },
  presetCard: {
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    padding: '1rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  selected: {
    borderColor: '#4a9eff',
    background: 'rgba(74, 158, 255, 0.2)'
  },
  presetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem'
  },
  presetIcon: {
    fontSize: '1.5rem'
  },
  presetPeriod: {
    color: '#aaa',
    fontSize: '0.9rem',
    marginLeft: 'auto'
  },
  presetStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '0.5rem',
    margin: '0.5rem 0',
    fontSize: '0.9rem'
  },
  presetDetails: {
    marginTop: '0.5rem'
  },
  stat: {
    marginBottom: '0.25rem'
  },
  globalEffects: {
    fontSize: '0.9rem',
    color: '#ddd',
    marginTop: '0.5rem'
  }
};

interface AsteroidPresetSelectorProps {
  onPresetSelected: (parameters: ImpactParameters, preset: HistoricalImpactPreset) => void;
  selectedPreset?: HistoricalImpactPreset;
}

export default function AsteroidPresetSelector({ 
  onPresetSelected, 
  selectedPreset 
}: AsteroidPresetSelectorProps): JSX.Element {
  return (
    <div style={styles.presetSelector}>
      <h3>Historical Impact Events</h3>
      <div style={styles.presetList}>
        {HISTORICAL_PRESETS.map((preset) => (
          <div
            key={preset.name}
            style={{
              ...styles.presetCard,
              ...(selectedPreset?.name === preset.name ? styles.selected : {})
            }}
            onClick={() => onPresetSelected(preset.parameters, preset)}
          >
            <div style={styles.presetHeader}>
              <span style={styles.presetIcon}>{preset.icon}</span>
              <h4>{preset.name}</h4>
              <span style={styles.presetPeriod}>{preset.period}</span>
            </div>
            <div style={styles.presetDetails}>
              <p>{preset.description}</p>
              <div style={styles.presetStats}>
                <div style={styles.stat}>
                  <strong>Crater:</strong> {preset.craterSize}
                </div>
                <div style={styles.stat}>
                  <strong>Energy:</strong> {preset.energyComparison}
                </div>
              </div>
              <p style={styles.globalEffects}>{preset.globalEffects}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}