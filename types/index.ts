// Core types for Project Rumbling
export interface ImpactParameters {
	diameter_m: number
	density_kgm3: number
	velocity_kms: number
	angle_deg: number
	lat?: number
	lng?: number
}

export interface SimulationResult {
  impact_energy_j: number;
  impact_energy_mt: number;
  crater_m: number;
  crater_km: number;
  blast_radius_m: number;
  blast_radius_km: number;
  thermal_radius_m: number;
  thermal_radius_km: number;
  seismic_magnitude: number;
  latitude: number;
  longitude: number;
  location?: string;
  population_affected?: number;
  affectedCities?: Array<{ name: string; country: string; population: number; distance: number; zones?: string[] }>;
  // Per-zone totals (from point dataset)
  crater_population_total?: number;
  blast_population_total?: number;
  thermal_population_total?: number;
  visualEffects?: ImpactVisualEffects;
}

export interface Mission {
	lat: number;
	lng: number;
	result?: SimulationResult | null;
	parameters?: ImpactParameters;
	cityName?: string;
	country?: string;
	closestCity?: string;
}

export interface CasualtyEstimate {
  thermal: number;
  blast: number;
  seismic: number;
  total: number;
  methodology: string;
}

export interface ImpactVisualEffects {
  fireballColor: string;
  shockwaveScale: number;
  thermalZoneOpacity: number;
  customEffects?: string[];
}

export interface DamageZone {
  type: 'crater' | 'blast' | 'thermal';
  radius_m: number;
  radius_km: number;
  color: string;
  opacity: number;
  description: string;
  visualEffects?: ImpactVisualEffects;
}

export interface UIState {
  selectedLocation: { lat: number; lng: number } | null;
  isSimulating: boolean;
  showResults: boolean;
  activeTab: 'parameters' | 'results' | 'mitigation';
}

// Preset impactor configurations
export interface ImpactorPreset {
  name: string;
  description: string;
  parameters: ImpactParameters;
  category: 'asteroid' | 'comet' | 'meteor' | 'custom';
  year?: string; // e.g., '1908', '2013', '66 Ma', '2029 (flyby)'
  location?: { lat: number | null; lon: number | null };
}

export const IMPACTOR_PRESETS: ImpactorPreset[] = [
  {
    name: 'Chicxulub',
    description: 'Dinosaur extinction event • Yucatán Peninsula, Mexico',
    year: '66 Ma',
    parameters: { diameter_m: 10000, density_kgm3: 3000, velocity_kms: 20, angle_deg: 45 },
    location: { lat: 21.3, lon: -89.5 },
    category: 'asteroid'
  },
  {
    name: 'Tunguska',
    description: 'Forest flattening event • Siberia, Russia',
    year: '1908',
    parameters: { diameter_m: 60, density_kgm3: 3000, velocity_kms: 15, angle_deg: 30 },
    location: { lat: 60.9, lon: 101.9 },
    category: 'asteroid'
  },
  {
    name: 'Chelyabinsk',
    description: 'Airburst meteor • Chelyabinsk, Russia',
    year: '2013',
    parameters: { diameter_m: 20, density_kgm3: 3000, velocity_kms: 19, angle_deg: 45 },
    location: { lat: 55.15, lon: 61.41 },
    category: 'meteor'
  },
  {
    name: 'Apophis',
    description: 'Near-Earth flyby • Hypothetical impact',
    year: '2029 (flyby)',
    parameters: { diameter_m: 370, density_kgm3: 3000, velocity_kms: 7, angle_deg: 45 },
    location: { lat: null, lon: null },
    category: 'asteroid'
  },
  {
    name: 'Vredefort',
    description: 'Ancient impact crater • South Africa',
    year: '~2 Ga',
    parameters: { diameter_m: 10000, density_kgm3: 3000, velocity_kms: 20, angle_deg: 45 },
    location: { lat: -27.0, lon: 27.4 },
    category: 'asteroid'
  },
  {
    name: 'Meteor Crater',
    description: 'Well-preserved crater • Arizona, USA',
    year: '~50,000 years BP',
    parameters: { diameter_m: 1200, density_kgm3: 3000, velocity_kms: 17, angle_deg: 45 },
    location: { lat: 35.027, lon: -111.022 },
    category: 'asteroid'
  }
];

export interface CityProperties {
  NAME: string;
  LATITUDE: number;
  LONGITUDE: number;
  POP_MAX: number;
  ADM0NAME?: string;
  [key: string]: any;
}

export interface CityFeature {
  type: 'Feature';
  geometry: { 
    type: 'Point'; 
    coordinates: [number, number] 
  };
  properties: CityProperties;
  distance?: number;
}
