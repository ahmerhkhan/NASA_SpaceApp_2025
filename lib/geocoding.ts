import type { CityFeature } from '../types'
import * as turf from '@turf/turf'
import { reverseGeocode as reverseLocal, searchCities as localSearch } from '../utils/geocoding'

export interface GeocodingResult {
  city: string;
  country: string;
  display_name: string;
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodingResult> {
  try {
    const city = await reverseLocal(lat, lon)
    if (city) {
      return {
        city: city.name,
        country: city.country || 'Unknown Country',
        display_name: `${city.name}, ${city.country || ''}`.trim()
      }
    }
  } catch (error) {
    console.error('Local reverse geocoding error:', error)
  }
  return {
    city: 'Unknown City',
    country: 'Unknown Country',
    display_name: 'Unknown Location'
  }
}

// Robust city name extraction
export function extractCityName(address: any): string {
  return address.city 
    || address.town 
    || address.village 
    || address.municipality 
    || address.county 
    || 'Unknown City'
}

// Cache for cities data
let citiesData: CityFeature[] | null = null;

export async function loadCitiesData(): Promise<CityFeature[]> {
  if (citiesData) return citiesData;
  try {
    const response = await fetch('/data/cities.geojson');
    const data = await response.json();
    citiesData = (data.features || []) as CityFeature[];
    return citiesData;
  } catch (error) {
    console.error('Failed to load cities data:', error);
    return [];
  }
}

export async function findNearestCity(lat: number, lon: number, maxDistance = 500): Promise<CityFeature | null> {
  try {
    // Load cities from cache or fetch
    const cities = await loadCitiesData();

    // Prefer Turf nearest if available; fall back to haversine scan
    try {
      const fc = { type: 'FeatureCollection', features: cities as any } as any;
      const nearest = (turf as any).nearestPoint((turf as any).point([lon, lat]), fc);
      return nearest || null;
    } catch {}

    let closestCity: CityFeature | null = null;
    let minDistance = maxDistance;
    for (const city of cities) {
      const coords: any = (city.geometry as any)?.coordinates;
      const cityLon = Array.isArray(coords) ? coords[0] : (city.properties as any)?.lon;
      const cityLat = Array.isArray(coords) ? coords[1] : (city.properties as any)?.lat;
      if (typeof cityLat !== 'number' || typeof cityLon !== 'number') continue;
      const dLat = (cityLat - lat) * Math.PI / 180;
      const dLon = (cityLon - lon) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(cityLat*Math.PI/180)*Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = 6371 * c;
      if (distance < minDistance) {
        minDistance = distance;
        closestCity = city;
      }
    }
    return closestCity;
  } catch (error) {
    console.error('Nearest city search failed:', error)
    return null
  }
}

// Utility: normalize (remove diacritics, lowercase)
export function normalizeString(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * rankAndFilterCities
 *  - items: array of { name, country, lat, lon, population }
 *  - q: user query
 *  - maxResults: cap
 */
export function rankAndFilterCities(items: any[], q: string, maxResults = 50) {
  const qNorm = normalizeString(q.trim());
  if (!qNorm) return [];

  const buckets: { prefix: any[], wordStart: any[], substring: any[] } = {
    prefix: [], wordStart: [], substring: []
  };

  for (const city of items) {
    const nameNorm = normalizeString(city.name || city.properties?.city || '');
    const parts = nameNorm.split(/\s+/);
    if (nameNorm.startsWith(qNorm)) {
      buckets.prefix.push(city);
    } else if (parts.some(p => p.startsWith(qNorm))) {
      buckets.wordStart.push(city);
    } else if (nameNorm.includes(qNorm)) {
      buckets.substring.push(city);
    }
  }

  // sort each bucket by population (desc) when available
  const popSort = (a: any, b: any) => ( (b.population||b.properties?.population||0) - (a.population||a.properties?.population||0) );

  buckets.prefix.sort(popSort);
  buckets.wordStart.sort(popSort);
  buckets.substring.sort(popSort);

  const merged = [...buckets.prefix, ...buckets.wordStart, ...buckets.substring];
  return merged.slice(0, maxResults);
}

// Geocoding for autocomplete search
export async function geocodeSearch(query: string): Promise<any[]> {
  try {
    const results = await localSearch(query, 10)
    return results.map(r => ({
      lat: r.lat,
      lon: r.lon,
      city: r.name,
      country: r.country || 'Unknown',
      display_name: `${r.name}${r.country ? ', ' + r.country : ''}`
    }))
  } catch (error) {
    console.error('Geocoding search error:', error)
    return []
  }
}
