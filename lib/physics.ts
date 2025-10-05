import type { ImpactParameters, SimulationResult, DamageZone } from '../types';

// Physics constants and guards
const G = 9.81; // m/s^2
const CRATER_MAX_KM = 12000; // safety cap
const EARTH_RADIUS_KM = 6371; // used for sanity messages only

export const MT_JOULES = 4.184e15; // 1 megaton TNT in joules

// Utility functions
export function joulestoMegatons(energy_j: number): number {
  return energy_j / MT_JOULES;
}

export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

export function massFromDiameter(diameter_m: number, density_kgm3: number): number {
  const r = diameter_m / 2;
  return (4 / 3) * Math.PI * Math.pow(r, 3) * density_kgm3; // kg
}

export function kineticEnergyJoules(mass_kg: number, v_mps: number): number {
  return 0.5 * mass_kg * v_mps * v_mps; // J
}

export function craterDiameterMeters(
  diameter_m: number,
  density_kgm3: number,
  velocity_mps: number,
  angle_deg: number
): number {
  // Collins-style simplified scaling with gravity, velocity, density, and size
  const angleRad = (angle_deg * Math.PI) / 180;
  const vEff = Math.max(velocity_mps * Math.sin(angleRad), 10); // vertical component, avoid 0

  const asteroidRadius_m = diameter_m / 2;
  const gravityTerm = Math.pow(G, -0.22);
  const velocityTerm = Math.pow(vEff, 0.44);
  const densityRatio = Math.pow(density_kgm3 / 2700, 1 / 3); // vs rock target
  const sizeTerm = Math.pow(asteroidRadius_m, 0.78);

  const k = 1.161;
  const D_m_raw = k * gravityTerm * velocityTerm * densityRatio * sizeTerm; // meters
  const D_km = D_m_raw / 1000;

  // Sanity guards
  const cappedKm = Math.min(Math.max(D_km, 0), CRATER_MAX_KM);
  if (diameter_m > 20000 && cappedKm > 500) {
    console.warn('[impact] Extremely large crater implied by parameters; results may be global-level. D_km=', cappedKm.toFixed(1));
  }
  return cappedKm * 1000; // return meters
}

export function seismicMagnitudeEstimate(E_j: number): number {
  // Use M = 0.67 * log10(E_J) - 5.87, total energy (no angle reduction)
  const magnitude = 0.67 * Math.log10(Math.max(E_j, 1)) - 5.87;
  return Math.min(Math.max(magnitude, 0), 12);
}

export function calculateImpactEnergy(
    diameter_m: number, 
    density_kgm3: number, 
    velocity_kms: number
): number {
    // Calculate asteroid mass
    const radius = diameter_m / 2
    const volume = (4/3) * Math.PI * Math.pow(radius, 3)
    const mass_kg = volume * density_kgm3

    // Convert velocity to m/s
    const velocity_mps = velocity_kms * 1000

    // Calculate kinetic energy
    return 0.5 * mass_kg * Math.pow(velocity_mps, 2)
}

export function simulateImpactor(params: ImpactParameters): SimulationResult {
  if (!params.diameter_m || !params.density_kgm3 || !params.velocity_kms || !params.angle_deg
      || params.lat === undefined || params.lng === undefined) {
    throw new Error('Invalid impact parameters');
  }

  const { diameter_m, density_kgm3, velocity_kms, angle_deg, lat, lng } = params;

  // Impact energy (full kinetic, no angle reduction)
  const impactEnergy = calculateImpactEnergy(diameter_m, density_kgm3, velocity_kms);

  // Crater diameter via coupling (angle only affects coupling)
  let craterDiameter = craterDiameterMeters(diameter_m, density_kgm3, velocity_kms * 1000, angle_deg);
  let craterKm = metersToKilometers(craterDiameter);
  // Additional realistic small-body cap: if impactor ≤ 15 km, crater ≤ ~200 km
  if (diameter_m <= 15000 && craterKm > 200) {
    console.warn('[impact] Crater diameter capped to 200 km for ≤15 km impactor');
    craterKm = 200;
    craterDiameter = craterKm * 1000;
  }
  const craterRadiusKm = craterKm / 2;

  // Blast & thermal radii as conservative multiples of crater radius
  const BLAST_FACTOR = 3.0; // recommended 2–5
  const THERMAL_FACTOR = 1.8; // recommended 1–3
  let blastRadiusKm = BLAST_FACTOR * craterRadiusKm;
  let thermalRadiusKm = THERMAL_FACTOR * craterRadiusKm;

  // Cap at Earth radius to avoid unphysical map extents
  if (blastRadiusKm > EARTH_RADIUS_KM) {
    console.warn('[impact] Blast radius capped at Earth radius');
    blastRadiusKm = EARTH_RADIUS_KM;
  }
  if (thermalRadiusKm > EARTH_RADIUS_KM) {
    console.warn('[impact] Thermal radius capped at Earth radius');
    thermalRadiusKm = EARTH_RADIUS_KM;
  }

  if (thermalRadiusKm > EARTH_RADIUS_KM * 0.8) {
    console.warn('[impact] Thermal radius exceeds 80% of Earth radius; global-level effects likely');
  }

  const blastRadius = blastRadiusKm * 1000;
  const thermalRadius = thermalRadiusKm * 1000;

  // Seismic magnitude from total energy
  const seismicMagnitude = Math.min(seismicMagnitudeEstimate(impactEnergy), 12);

  // High-energy warning
  const energyMT = joulestoMegatons(impactEnergy);
  if (energyMT > 1e6) {
    console.warn('[impact] Total energy exceeds 1e6 Mt TNT; this is a global/extreme event');
  }

  return {
    impact_energy_j: impactEnergy,
    impact_energy_mt: joulestoMegatons(impactEnergy),
    crater_m: craterDiameter,
    crater_km: craterKm,
    blast_radius_m: blastRadius,
    blast_radius_km: blastRadiusKm,
    thermal_radius_m: thermalRadius,
    thermal_radius_km: thermalRadiusKm,
    seismic_magnitude: seismicMagnitude,
    latitude: lat,
    longitude: lng
  };
}

// Damage zones for visualization
export function generateDamageZones(
  result: SimulationResult,
  visualEffects?: {
    fireballColor?: string;
    shockwaveScale?: number;
    thermalZoneOpacity?: number;
  }
): DamageZone[] {
  const {
    fireballColor = '#ff6b6b',
    shockwaveScale = 1.0,
    thermalZoneOpacity = 0.05
  } = visualEffects || {};

  // Adjust radii based on visual effects
  const adjustedBlastRadius = result.blast_radius_m * shockwaveScale;
  const adjustedThermalRadius = result.thermal_radius_m * shockwaveScale;

  return [
    {
      type: 'crater',
      radius_m: result.crater_m / 2,
      radius_km: result.crater_km / 2,
      color: fireballColor,
      opacity: 0.25,
      description: `Crater: ${result.crater_km.toFixed(1)} km diameter`
    },
    {
      type: 'blast',
      radius_m: adjustedBlastRadius,
      radius_km: adjustedBlastRadius / 1000,
      color: '#e2b250',
      opacity: 0.05,
      description: `Blast radius: ${(adjustedBlastRadius / 1000).toFixed(1)} km`
    },
    {
      type: 'thermal',
      radius_m: adjustedThermalRadius,
      radius_km: adjustedThermalRadius / 1000,
      color: '#2fd6e2',
      opacity: thermalZoneOpacity,
      description: `Thermal radius: ${(adjustedThermalRadius / 1000).toFixed(1)} km`
    }
  ];
}