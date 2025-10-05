export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
	const R = 6371
	const dLat = ((lat2 - lat1) * Math.PI) / 180
	const dLon = ((lon2 - lon1) * Math.PI) / 180
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) * Math.sin(dLon / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return R * c
}

// GeoTIFF-based population loader removed - using GeoJSON cities data instead

// Grid-based population function removed - using GeoJSON cities data instead

import type { Feature, FeatureCollection, Polygon, MultiPolygon, Point } from 'geojson'
import * as turf from '@turf/turf'

type AnyCityFeature = Feature<Point | Polygon | MultiPolygon, { 
  id?: string; 
  name?: string; 
  NAME?: string;
  country?: string; 
  SOV0NAME?: string;
  population?: number; 
  POP_MAX?: number;
  lat?: number; 
  lon?: number;
  LATITUDE?: number;
  LONGITUDE?: number;
}>

export function calculateAffectedPopulation(
	impactLat: number,
	impactLon: number,
	radiusKm: number,
	cities: FeatureCollection
): { totalAffected: number; affectedCities: Array<{ name: string; country: string; population: number; distance: number }> } {
	let total = 0
	const pointZone = [impactLon, impactLat]
	const EARTH_R = 6371
	const affectedCities: Array<{ name: string; country: string; population: number; distance: number }> = []

	console.log(`Calculating population affected: lat=${impactLat}, lon=${impactLon}, radius=${radiusKm}km`);
	console.log(`Cities dataset has ${cities.features.length} features`);

	let citiesWithPop = 0;
	let citiesInRadius = 0;
	
	for (const f of (cities.features as AnyCityFeature[])) {
		// Try multiple population field names to handle different data formats
		const pop = Number(f.properties?.population || f.properties?.POP_MAX || 0)
		if (!Number.isFinite(pop) || pop <= 0) continue
		citiesWithPop++;
		const geom = f.geometry
		if (!geom) continue

		// Build simple circle inclusion using haversine for points; proportional area for polygons
		if (geom.type === 'Point') {
			const [lon, lat] = geom.coordinates as [number, number]
			// Also try to get coordinates from properties if geometry coordinates are not available
			const cityLat = lat || f.properties?.LATITUDE || f.properties?.lat || 0
			const cityLon = lon || f.properties?.LONGITUDE || f.properties?.lon || 0
			const distance = haversineKm(impactLat, impactLon, cityLat, cityLon);
			if (distance <= radiusKm) {
				// Uniform distribution assumption within implicit city footprint
				total += pop
				citiesInRadius++;
				affectedCities.push({
					name: f.properties?.name || f.properties?.NAME || 'Unknown City',
					country: f.properties?.country || f.properties?.SOV0NAME || 'Unknown Country',
					population: pop,
					distance: distance
				});
				console.log(`City ${f.properties?.name || f.properties?.NAME} (${pop.toLocaleString()}) is ${distance.toFixed(1)}km away - AFFECTED`);
			}
			continue
		}

		// For polygons, compute intersection area with Turf
		try {
			const zone = (turf as any).circle(pointZone, radiusKm, { units: 'kilometers', steps: 64 })
			const inter = (turf as any).intersect(zone, f as any)
			if (!inter) continue
			const overlap = (turf as any).area(inter)
			const base = (turf as any).area(f as any)
			if (base > 0 && overlap > 0) {
				const affected = Math.round(pop * (overlap / base))
				total += affected
			}
		} catch {
			// Fallback: centroid distance
			const centroid = centroidOf(geom)
			if (centroid && haversineKm(impactLat, impactLon, centroid[1], centroid[0]) <= radiusKm) {
				total += Math.round(pop * 0.5)
			}
		}
	}
	
	console.log(`Population calculation complete: ${citiesWithPop} cities with population data, ${citiesInRadius} cities in radius, total affected: ${total.toLocaleString()}`);
	
	// Sort affected cities by population (descending) and return top cities
	affectedCities.sort((a, b) => b.population - a.population);
	
	return { 
		totalAffected: total, 
		affectedCities: affectedCities.slice(0, 10) // Return top 10 for display
	}
}

function centroidOf(geom: Point | Polygon | MultiPolygon): [number, number] | null {
	if (geom.type === 'Point') return geom.coordinates as [number, number]
	const coords = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates[0]
	if (!coords || coords.length === 0) return null
	let x = 0, y = 0, n = 0
	for (const ring of coords as number[][][]) {
		for (const c of ring) { x += c[0]; y += c[1]; n++ }
	}
	return n ? [x / n, y / n] : null
}


