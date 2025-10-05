import {
  massFromDiameter,
  kineticEnergyJoules,
  energyMegatons,
  craterDiameterMeters,
  blastRadiusMeters,
  thermalRadiusMeters,
  seismicMagnitudeEstimate,
  velocityKmS_to_mps,
  angleFactor,
  simulateImpactor,
  generateDamageZones,
  MT_JOULES
} from '../physics';

describe('Physics Module', () => {
  describe('massFromDiameter', () => {
    test('calculates mass for 10m diameter sphere with default density', () => {
      const mass = massFromDiameter(10);
      const expectedVolume = (4 / 3) * Math.PI * Math.pow(5, 3);
      const expectedMass = expectedVolume * 3000;
      expect(mass).toBeCloseTo(expectedMass, 2);
    });

    test('calculates mass for 100m diameter sphere with custom density', () => {
      const mass = massFromDiameter(100, 5000);
      const expectedVolume = (4 / 3) * Math.PI * Math.pow(50, 3);
      const expectedMass = expectedVolume * 5000;
      expect(mass).toBeCloseTo(expectedMass, 2);
    });

    test('returns positive mass for positive inputs', () => {
      expect(massFromDiameter(1, 1000)).toBeGreaterThan(0);
      expect(massFromDiameter(1000, 1)).toBeGreaterThan(0);
    });
  });

  describe('kineticEnergyJoules', () => {
    test('calculates kinetic energy correctly', () => {
      const mass = 1000; // kg
      const velocity = 1000; // m/s
      const energy = kineticEnergyJoules(mass, velocity);
      const expected = 0.5 * mass * velocity * velocity;
      expect(energy).toBe(expected);
    });

    test('returns zero for zero velocity', () => {
      expect(kineticEnergyJoules(1000, 0)).toBe(0);
    });

    test('returns zero for zero mass', () => {
      expect(kineticEnergyJoules(0, 1000)).toBe(0);
    });
  });

  describe('energyMegatons', () => {
    test('converts joules to megatons correctly', () => {
      const joules = MT_JOULES; // 1 megaton
      const megatons = energyMegatons(joules);
      expect(megatons).toBeCloseTo(1, 10);
    });

    test('handles very small energies', () => {
      const joules = 1000; // Very small
      const megatons = energyMegatons(joules);
      expect(megatons).toBeLessThan(1e-10);
    });
  });

  describe('craterDiameterMeters', () => {
    test('returns positive diameter for positive energy', () => {
      const diameter = craterDiameterMeters(1e12); // 1 TJ
      expect(diameter).toBeGreaterThan(0);
    });

    test('scales with energy (higher energy = larger crater)', () => {
      const smallEnergy = 1e12;
      const largeEnergy = 1e15;
      const smallCrater = craterDiameterMeters(smallEnergy);
      const largeCrater = craterDiameterMeters(largeEnergy);
      expect(largeCrater).toBeGreaterThan(smallCrater);
    });
  });

  describe('blastRadiusMeters', () => {
    test('returns positive radius for positive energy', () => {
      const radius = blastRadiusMeters(1e12);
      expect(radius).toBeGreaterThan(0);
    });

    test('scales with energy', () => {
      const smallEnergy = 1e12;
      const largeEnergy = 1e15;
      const smallRadius = blastRadiusMeters(smallEnergy);
      const largeRadius = blastRadiusMeters(largeEnergy);
      expect(largeRadius).toBeGreaterThan(smallRadius);
    });

    test('handles very small energies without errors', () => {
      const radius = blastRadiusMeters(1e-12);
      expect(radius).toBeGreaterThan(0);
      expect(isFinite(radius)).toBe(true);
    });
  });

  describe('thermalRadiusMeters', () => {
    test('returns positive radius for positive energy', () => {
      const radius = thermalRadiusMeters(1e12);
      expect(radius).toBeGreaterThan(0);
    });

    test('scales with energy', () => {
      const smallEnergy = 1e12;
      const largeEnergy = 1e15;
      const smallRadius = thermalRadiusMeters(smallEnergy);
      const largeRadius = thermalRadiusMeters(largeEnergy);
      expect(largeRadius).toBeGreaterThan(smallRadius);
    });
  });

  describe('seismicMagnitudeEstimate', () => {
    test('returns reasonable magnitude values', () => {
      const magnitude = seismicMagnitudeEstimate(1e12);
      expect(magnitude).toBeGreaterThan(0);
      expect(magnitude).toBeLessThan(15); // Sanity check
    });

    test('scales with energy', () => {
      const smallEnergy = 1e12;
      const largeEnergy = 1e15;
      const smallMag = seismicMagnitudeEstimate(smallEnergy);
      const largeMag = seismicMagnitudeEstimate(largeEnergy);
      expect(largeMag).toBeGreaterThan(smallMag);
    });
  });

  describe('velocityKmS_to_mps', () => {
    test('converts km/s to m/s correctly', () => {
      expect(velocityKmS_to_mps(1)).toBe(1000);
      expect(velocityKmS_to_mps(20)).toBe(20000);
      expect(velocityKmS_to_mps(0)).toBe(0);
    });
  });

  describe('angleFactor', () => {
    test('returns 1 for 90 degree angle (vertical impact)', () => {
      expect(angleFactor(90)).toBeCloseTo(1, 10);
    });

    test('returns 0 for 0 degree angle (horizontal impact)', () => {
      expect(angleFactor(0)).toBeCloseTo(0, 10);
    });

    test('returns 0.707 for 45 degree angle', () => {
      expect(angleFactor(45)).toBeCloseTo(Math.sin(Math.PI / 4), 10);
    });

    test('handles negative angles', () => {
      expect(angleFactor(-45)).toBeCloseTo(Math.sin(Math.PI / 4), 10);
    });
  });

  describe('simulateImpactor', () => {
    test('simulates small meteor correctly', () => {
      const params = {
        diameter_m: 0.5,
        density_kgm3: 3000,
        velocity_kms: 20,
        angle_deg: 45
      };
      
      const result = simulateImpactor(params);
      
      expect(result.mass_kg).toBeGreaterThan(0);
      expect(result.energy_j).toBeGreaterThan(0);
      expect(result.energy_megatons).toBeGreaterThan(0);
      expect(result.crater_m).toBeGreaterThan(0);
      expect(result.blast_radius_m).toBeGreaterThan(0);
      expect(result.thermal_radius_m).toBeGreaterThan(0);
      expect(result.seismic_magnitude).toBeGreaterThan(0);
    });

    test('uses default density when not provided', () => {
      const params = {
        diameter_m: 10,
        velocity_kms: 20,
        angle_deg: 45
      };
      
      const result = simulateImpactor(params);
      expect(result.mass_kg).toBeGreaterThan(0);
    });

    test('angle affects effective energy', () => {
      const baseParams = {
        diameter_m: 100,
        density_kgm3: 3000,
        velocity_kms: 20
      };
      
      const verticalResult = simulateImpactor({ ...baseParams, angle_deg: 90 });
      const shallowResult = simulateImpactor({ ...baseParams, angle_deg: 15 });
      
      expect(verticalResult.energy_j).toBeGreaterThan(shallowResult.energy_j);
    });

    test('larger diameter produces more energy', () => {
      const smallResult = simulateImpactor({
        diameter_m: 10,
        density_kgm3: 3000,
        velocity_kms: 20,
        angle_deg: 45
      });
      
      const largeResult = simulateImpactor({
        diameter_m: 100,
        density_kgm3: 3000,
        velocity_kms: 20,
        angle_deg: 45
      });
      
      expect(largeResult.energy_j).toBeGreaterThan(smallResult.energy_j);
    });
  });

  describe('generateDamageZones', () => {
    test('generates correct number of zones', () => {
      const result = {
        mass_kg: 1000,
        energy_j: 1e12,
        energy_megatons: 1,
        crater_m: 100,
        blast_radius_m: 1000,
        thermal_radius_m: 2000,
        seismic_magnitude: 5
      };
      
      const zones = generateDamageZones(result);
      expect(zones).toHaveLength(3);
      expect(zones.map(z => z.type)).toEqual(['crater', 'blast', 'thermal']);
    });

    test('zones have correct properties', () => {
      const result = {
        mass_kg: 1000,
        energy_j: 1e12,
        energy_megatons: 1,
        crater_m: 100,
        blast_radius_m: 1000,
        thermal_radius_m: 2000,
        seismic_magnitude: 5
      };
      
      const zones = generateDamageZones(result);
      
      zones.forEach(zone => {
        expect(zone.radius_m).toBeGreaterThan(0);
        expect(zone.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(zone.opacity).toBeGreaterThan(0);
        expect(zone.opacity).toBeLessThanOrEqual(1);
        expect(zone.description).toContain('km');
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles very small inputs gracefully', () => {
      const result = simulateImpactor({
        diameter_m: 0.001,
        density_kgm3: 1,
        velocity_kms: 0.1,
        angle_deg: 1
      });
      
      expect(result.mass_kg).toBeGreaterThan(0);
      expect(result.energy_j).toBeGreaterThan(0);
      expect(isFinite(result.energy_megatons)).toBe(true);
    });

    test('handles very large inputs gracefully', () => {
      const result = simulateImpactor({
        diameter_m: 100000,
        density_kgm3: 8000,
        velocity_kms: 100,
        angle_deg: 90
      });
      
      expect(result.mass_kg).toBeGreaterThan(0);
      expect(result.energy_j).toBeGreaterThan(0);
      expect(isFinite(result.energy_megatons)).toBe(true);
    });
  });
});
