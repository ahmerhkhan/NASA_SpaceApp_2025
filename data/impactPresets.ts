import { ImpactorPreset } from '../types';

// Extended interface for historical impact presets
export interface HistoricalImpactPreset extends ImpactorPreset {
  period: string;               // Human-readable time period
  craterSize: string;          // Human-readable crater size
  energyComparison: string;    // Energy in relatable terms
  globalEffects: string;       // Description of global effects
  visualEffects: {
    fireballColor: string;     // Color for the fireball visualization
    shockwaveScale: number;    // Multiplier for shockwave visualization
    thermalZoneOpacity: number;// Opacity for thermal zone visualization
    customEffects?: string[];  // Additional visual effects to apply
  };
  icon?: string;              // Optional icon identifier for UI
}

export const HISTORICAL_PRESETS: HistoricalImpactPreset[] = [
  {
    name: 'Dinosaur Extinction (Chicxulub)',
    description: 'The impact that ended the age of dinosaurs and changed Earth forever',
    period: '66 million years ago',
    year: '66 Ma',
    parameters: {
      diameter_m: 14000,
      density_kgm3: 3000,
      velocity_kms: 45,
      angle_deg: 60
    },
    craterSize: '150 km wide crater',
    energyComparison: 'Equivalent to 10 billion Hiroshima bombs',
    globalEffects: 'Triggered global fires, blocked sunlight for years, caused mass extinction of 75% of plant and animal species',
    location: { lat: 21.3, lon: -89.5 },
    category: 'asteroid',
    visualEffects: {
      fireballColor: '#ff4400',
      shockwaveScale: 2.0,
      thermalZoneOpacity: 0.7,
      customEffects: ['debris-cloud', 'global-dimming']
    },
    icon: '🦖'
  },
  {
    name: 'Tunguska Event',
    description: 'Mysterious explosion that flattened 80 million trees',
    period: 'June 30, 1908',
    year: '1908',
    parameters: {
      diameter_m: 60,
      density_kgm3: 3000,
      velocity_kms: 15,
      angle_deg: 30
    },
    craterSize: 'No crater (airburst)',
    energyComparison: 'Equal to 1,000 Hiroshima bombs',
    globalEffects: 'Flattened 2,000 square kilometers of forest, brightened night skies across Europe',
    location: { lat: 60.9, lon: 101.9 },
    category: 'asteroid',
    visualEffects: {
      fireballColor: '#ffaa00',
      shockwaveScale: 1.5,
      thermalZoneOpacity: 0.5,
      customEffects: ['tree-fall-pattern']
    },
    icon: '🌳'
  },
  {
    name: 'Chelyabinsk Meteor',
    description: 'Most documented asteroid impact in history',
    period: 'February 15, 2013',
    year: '2013',
    parameters: {
      diameter_m: 20,
      density_kgm3: 3000,
      velocity_kms: 19,
      angle_deg: 45
    },
    craterSize: 'No crater (airburst)',
    energyComparison: '30 times stronger than Hiroshima bomb',
    globalEffects: 'Injured 1,500 people, damaged 7,200 buildings across 6 cities',
    location: { lat: 55.15, lon: 61.41 },
    category: 'meteor',
    visualEffects: {
      fireballColor: '#ffdd00',
      shockwaveScale: 1.2,
      thermalZoneOpacity: 0.3,
      customEffects: ['window-damage-zone']
    },
    icon: '💥'
  },
  {
    name: 'Sudbury Impact Event',
    description: 'One of the largest known impact craters on Earth',
    period: '1.85 billion years ago',
    year: '1.85 Ga',
    parameters: {
      diameter_m: 13500,
      density_kgm3: 3000,
      velocity_kms: 48,
      angle_deg: 45
    },
    craterSize: '250 km wide crater',
    energyComparison: 'Millions of times stronger than all nuclear weapons combined',
    globalEffects: 'Possibly triggered global climate changes, created valuable mineral deposits',
    location: { lat: 46.6, lon: -81.1 },
    category: 'asteroid',
    visualEffects: {
      fireballColor: '#ff2200',
      shockwaveScale: 2.5,
      thermalZoneOpacity: 0.8,
      customEffects: ['magma-ejecta', 'crater-formation']
    },
    icon: '⛰️'
  },
  {
    name: 'Mahuika Impact',
    description: 'Suspected source of ancient tsunami',
    period: '1443 CE',
    year: '1443',
    parameters: {
      diameter_m: 500,
      density_kgm3: 3000,
      velocity_kms: 17,
      angle_deg: 45
    },
    craterSize: 'Underwater crater',
    energyComparison: 'Similar to 50-100 nuclear weapons',
    globalEffects: 'Generated massive tsunamis affecting Pacific regions, possible climate effects',
    location: { lat: -48.3, lon: 166.4 },
    category: 'asteroid',
    visualEffects: {
      fireballColor: '#00ffff',
      shockwaveScale: 1.7,
      thermalZoneOpacity: 0.4,
      customEffects: ['tsunami-wave', 'water-ejecta']
    },
    icon: '🌊'
  }
];