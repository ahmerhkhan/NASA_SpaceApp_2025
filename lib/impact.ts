// src/lib/impact.ts
// Self-contained functions for physics + population impact estimation.
//
// Assumes cities.json is an array of features like:
// { geometry: { coordinates: [lon, lat] }, properties: { city, country, population } }

export const MT_JOULES = 4.184e15; // 1 megaton TNT in J
export const G = 9.81; // m/s^2
export const TARGET_DENSITY = 2700; // kg/m^3 (rock), adjustable
export const CRATER_MAX_KM = 12000; // safety cap - adjust if desired

type CityFeature = {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: { city: string; country?: string; population?: number };
};

export type ImpactParams = {
  diameter_m: number; // meters
  density_kgm3: number; // kg/m^3
  velocity_kms: number; // km/s
  angle_deg: number; // degrees (0 = grazing, 90 = vertical)
  lat?: number;
  lng?: number;
};

export type ImpactResult = {
  impact_energy_j: number;
  impact_energy_mt: number;
  crater_km: number;
  crater_radius_km: number;
  blast_radius_km: number;
  thermal_radius_km: number;
  seismic_magnitude: number;
};

export function diameterToMassKg(d_m: number, density = 3000) {
  const r = d_m / 2;
  const volume = (4 / 3) * Math.PI * Math.pow(r, 3);
  return volume * density;
}

export function kineticEnergyJ(mass_kg: number, v_mps: number) {
  return 0.5 * mass_kg * v_mps * v_mps;
}

// Convert km/s to m/s
export function kmpsToMps(v_kms: number) {
  return v_kms * 1000;
}

// Crater diameter (km) - Collins et al. style simplified scaling
// D_crater (m) ≈ k * g^-0.22 * v_eff^0.44 * (ρi/ρt)^(1/3) * r^0.78
// We'll compute in meters then convert to km
export function craterDiameterMeters(
  diameter_m: number,
  density_kgm3: number,
  velocity_mps: number,
  angle_deg: number,
  targetDensity = TARGET_DENSITY
) {
  // Use vertical velocity component for coupling in crater formation:
  const angleRad = (angle_deg * Math.PI) / 180;
  const vEff = Math.max(velocity_mps * Math.sin(angleRad), 10); // avoid zero or tiny

  const asteroidRadius_m = diameter_m / 2;
  const gravityTerm = Math.pow(G, -0.22);
  const velocityTerm = Math.pow(vEff, 0.44);
  const densityRatio = Math.pow(density_kgm3 / targetDensity, 1 / 3);
  const sizeTerm = Math.pow(asteroidRadius_m, 0.78);

  const k = 1.161; // empirical constant from literature approximations
  const D_m = k * gravityTerm * velocityTerm * densityRatio * sizeTerm;

  const D_km = D_m / 1000;
  // sanity cap & clip
  const capped = Math.min(D_km, CRATER_MAX_KM);
  return Math.max(capped, 0.0) * 1000; // return meters
}

// Seismic magnitude from total energy (joules)
export function seismicMagnitudeFromEnergy(E_j: number) {
  const M = 0.67 * Math.log10(Math.max(E_j, 1)) - 5.87;
  return Math.max(0, Math.min(M, 12));
}

// Blast & thermal radii computed as multiples of crater radius (km)
export function computeBlastThermalFromCrater(crater_km: number, options?: { blastFactor?: number; thermalFactor?: number }) {
  const blastFactor = options?.blastFactor ?? 3.0; // recommended 2–5
  const thermalFactor = options?.thermalFactor ?? 1.8; // recommended 1–3

  const craterRadius_km = crater_km / 2;
  const blast_km = craterRadius_km * blastFactor;
  const thermal_km = craterRadius_km * thermalFactor;

  return {
    craterRadius_km,
    blast_km,
    thermal_km
  };
}

// Haversine distance in kilometers between two lat/lon points
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Aggregate population affected given city point dataset
export function populationAffectedByZones(
  cities: CityFeature[],
  centerLat: number,
  centerLng: number,
  blast_km: number,
  thermal_km: number,
  craterRadius_km: number
) {
  let blastPop = 0;
  let thermalPop = 0;
  let craterPop = 0;
  const cityResults: { city: string; country?: string; population?: number; distance_km: number; zones: string[] }[] = [];

  for (const f of cities) {
    const [lon, lat] = f.geometry.coordinates;
    const pop = f.properties.population ?? 0;
    const dist = haversineKm(centerLat, centerLng, lat, lon);

    const zones: string[] = [];
    if (dist <= craterRadius_km) {
      craterPop += pop;
      zones.push('crater');
    }
    if (dist <= blast_km) {
      blastPop += pop;
      zones.push('blast');
    }
    if (dist <= thermal_km) {
      thermalPop += pop;
      zones.push('thermal');
    }

    if (zones.length > 0) {
      cityResults.push({ city: f.properties.city, country: f.properties.country, population: pop, distance_km: dist, zones });
    }
  }

  // Sort by population affected desc
  cityResults.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  return {
    craterPop,
    blastPop,
    thermalPop,
    cityResults
  };
}

// Main wrapper: compute impact + population estimates
export function simulateImpactAndPopulation(params: ImpactParams, cities: CityFeature[]): ImpactResult & { cityResults: any; craterPop: number; blastPop: number; thermalPop: number } {
  const { diameter_m, density_kgm3, velocity_kms, angle_deg } = params;
  const velocity_mps = kmpsToMps(velocity_kms);

  // Total mass & energy (angle does NOT reduce mass or total KE)
  const mass_kg = diameterToMassKg(diameter_m, density_kgm3);
  const energy_j = kineticEnergyJ(mass_kg, velocity_mps);
  const energy_mt = energy_j / MT_JOULES;

  // crater (meters -> km)
  const crater_m = craterDiameterMeters(diameter_m, density_kgm3, velocity_mps, angle_deg);
  const crater_km = crater_m / 1000;
  const craterRadius_km = crater_km / 2;

  // blast & thermal (km)
  const { blast_km, thermal_km } = computeBlastThermalFromCrater(crater_km);

  // seismic magnitude from total energy
  const seismicMagnitude = seismicMagnitudeFromEnergy(energy_j);

  // population intersection
  const popResults = populationAffectedByZones(cities, params.lat ?? 0, params.lng ?? 0, blast_km, thermal_km, craterRadius_km);

  return {
    impact_energy_j: energy_j,
    impact_energy_mt: energy_mt,
    crater_km,
    crater_radius_km: craterRadius_km,
    blast_radius_km: blast_km,
    thermal_radius_km: thermal_km,
    seismic_magnitude: seismicMagnitude,
    // extra:
    cityResults: popResults.cityResults,
    craterPop: popResults.craterPop,
    blastPop: popResults.blastPop,
    thermalPop: popResults.thermalPop
  };
}


