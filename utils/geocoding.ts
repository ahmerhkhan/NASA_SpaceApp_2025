import Fuse from 'fuse.js'
export interface CityRecord {
  name: string;
  country?: string;
  lat: number;
  lon: number;
  population?: number;
}

type GridKey = string;

function toGridKey(lat: number, lon: number): GridKey {
  const latKey = Math.floor(lat);
  const lonKey = Math.floor(lon);
  return `${latKey},${lonKey}`;
}

function getNeighborKeys(lat: number, lon: number, radiusInDegrees: number): GridKey[] {
  const keys: GridKey[] = [];
  const latStart = Math.floor(lat - radiusInDegrees);
  const latEnd = Math.floor(lat + radiusInDegrees);
  const lonStart = Math.floor(lon - radiusInDegrees);
  const lonEnd = Math.floor(lon + radiusInDegrees);
  for (let la = latStart; la <= latEnd; la++) {
    for (let lo = lonStart; lo <= lonEnd; lo++) {
      keys.push(`${la},${lo}`);
    }
  }
  return keys;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let citiesLoaded = false;
let gridIndex: Map<GridKey, CityRecord[]> = new Map();
let citiesFlat: CityRecord[] = [];

async function ensureLoaded(): Promise<void> {
  if (citiesLoaded) return;
  // Try canonical geojson, then educational JSON fallback
  const candidates: Array<{ path: string; type: 'geojson' | 'json' }> = [
    { path: '/data/educational/cities.json', type: 'json' }, // canonical
    { path: '/data/cities.geojson', type: 'geojson' },
    { path: '/data/educational/cities.geojson', type: 'geojson' }
  ];
  for (const c of candidates) {
    try {
      console.log(`Trying to load cities from: ${c.path}`);
      const res = await fetch(c.path);
      if (!res.ok) {
        console.log(`Failed to load ${c.path}: ${res.status} ${res.statusText}`);
        continue;
      }
      console.log(`Successfully loaded ${c.path}`);
      if (c.type === 'json') {
        // Try JSON array first
        const text = await res.text();
        console.log(`JSON file size: ${text.length} characters`);
        try {
          const asArray = JSON.parse(text);
          console.log(`Parsed JSON, type: ${typeof asArray}, isArray: ${Array.isArray(asArray)}`);
        if (Array.isArray(asArray)) {
            console.log(`Array length: ${asArray.length}`);
          citiesFlat = asArray.map((d: any) => ({
            name: d.name || d.city || d.town || 'Unknown',
            country: d.country || d.country_name || d.cc,
            lat: Number(d.lat ?? d.latitude),
            lon: Number(d.lon ?? d.lng ?? d.longitude),
            population: (d.population ?? d.POP_MAX ?? d.pop_max ?? d.POP_EST ?? d.pop) ? Number(d.population ?? d.POP_MAX ?? d.pop_max ?? d.POP_EST ?? d.pop) : undefined
          })).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
            console.log(`Processed ${citiesFlat.length} cities from array`);
            break;
          } else if (asArray && asArray.features && Array.isArray(asArray.features)) {
            console.log(`GeoJSON with ${asArray.features.length} features`);
            citiesFlat = asArray.features.map((f: any) => {
              const props = f.properties || {};
              const coords = f.geometry?.coordinates || [props.LONGITUDE ?? props.lon, props.LATITUDE ?? props.lat];
              const lat = Number(props.lat ?? props.LATITUDE ?? props.latitude ?? (coords ? coords[1] : undefined));
              const lon = Number(props.lon ?? props.LONGITUDE ?? props.longitude ?? (coords ? coords[0] : undefined));
              return {
                name: props.NAME || props.name || props.city || props.town || 'Unknown',
                country: props.SOV0NAME || props.ADM0NAME || props.country || props.cc || props.country_name,
                lat,
                lon,
                population: props.POP_MAX ? Number(props.POP_MAX) : (props.population ? Number(props.population) : undefined)
              } as CityRecord;
            }).filter((c: CityRecord) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
            console.log(`Processed ${citiesFlat.length} cities from GeoJSON`);
            break;
          }
        } catch {
          // Not an array; maybe NDJSON of GeoJSON Features
          const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
          const recs: CityRecord[] = [];
          for (let i = 0; i < Math.min(lines.length, 50000); i++) {
            try {
              const f = JSON.parse(lines[i]);
              const props = f.properties || {};
              const coords = f.geometry?.coordinates || [props.LONGITUDE ?? props.lon, props.LATITUDE ?? props.lat];
              const lat = Number(props.lat ?? props.LATITUDE ?? props.latitude ?? (coords ? coords[1] : undefined));
              const lon = Number(props.lon ?? props.LONGITUDE ?? props.longitude ?? (coords ? coords[0] : undefined));
              const name = props.name || props.city || props.NAME || props.NAMEASCII || 'Unknown';
              const country = props.country || props.ADM0NAME || props.SOV0NAME || props.cc || props.country_name;
              const population = props.population ? Number(props.population) : (props.POP_MAX ? Number(props.POP_MAX) : undefined);
              if (Number.isFinite(lat) && Number.isFinite(lon)) {
                recs.push({ name, country, lat, lon, population });
              }
            } catch {}
          }
          if (recs.length > 0) {
            citiesFlat = recs;
            break;
          }
        }
        continue;
      }
      const data = await res.json();
      if (c.type === 'geojson' && data && Array.isArray(data.features)) {
        const feats: any[] = data.features || [];
        citiesFlat = feats.map((f: any) => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates || [props.LONGITUDE ?? props.lon, props.LATITUDE ?? props.lat];
          const lat = Number(props.lat ?? props.LATITUDE ?? props.latitude ?? (coords ? coords[1] : undefined));
          const lon = Number(props.lon ?? props.LONGITUDE ?? props.longitude ?? (coords ? coords[0] : undefined));
          return {
            name: props.NAME || props.name || props.city || props.town || 'Unknown',
            country: props.SOV0NAME || props.ADM0NAME || props.country || props.cc || props.country_name,
            lat,
            lon,
            population: props.POP_MAX ? Number(props.POP_MAX) : (props.population ? Number(props.population) : undefined)
          } as CityRecord;
        }).filter((c: CityRecord) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
        break;
      }
    } catch {}
  }
  if (!citiesFlat.length) {
    console.warn('No cities dataset could be loaded');
  }

  const index = new Map<GridKey, CityRecord[]>();
  for (const c of citiesFlat) {
    const key = toGridKey(c.lat, c.lon);
    const list = index.get(key) || [];
    list.push(c);
    index.set(key, list);
  }
  gridIndex = index;
  citiesLoaded = citiesFlat.length > 0;
  
  console.log(`Loaded ${citiesFlat.length} cities from dataset`);
  if (citiesFlat.length > 0) {
    console.log('Sample cities:', citiesFlat.slice(0, 5).map(c => `${c.name}, ${c.country} (${c.population || 'no pop'})`));
    
    // Check for specific cities
    const karachi = citiesFlat.find(c => c.name.toLowerCase().includes('karachi'));
    const mumbai = citiesFlat.find(c => c.name.toLowerCase().includes('mumbai'));
    const jaipur = citiesFlat.find(c => c.name.toLowerCase().includes('jaipur'));
    const mirpur = citiesFlat.find(c => c.name.toLowerCase().includes('mirpur'));
    
    console.log('Karachi found:', karachi ? `${karachi.name}, ${karachi.country} (${karachi.lat}, ${karachi.lon})` : 'NOT FOUND');
    console.log('Mumbai found:', mumbai ? `${mumbai.name}, ${mumbai.country} (${mumbai.lat}, ${mumbai.lon})` : 'NOT FOUND');
    console.log('Jaipur found:', jaipur ? `${jaipur.name}, ${jaipur.country} (${jaipur.lat}, ${jaipur.lon})` : 'NOT FOUND');
    console.log('Mirpur Khas found:', mirpur ? `${mirpur.name}, ${mirpur.country} (${mirpur.lat}, ${mirpur.lon})` : 'NOT FOUND');
    
    // Check for Indian cities
    const indianCities = citiesFlat.filter(c => c.country && c.country.toLowerCase().includes('india'));
    console.log(`Found ${indianCities.length} Indian cities`);
    if (indianCities.length > 0) {
      console.log('Sample Indian cities:', indianCities.slice(0, 10).map(c => `${c.name}, ${c.country} (${c.lat}, ${c.lon})`));
    }
    
    // Check for Pakistani cities
    const pakistaniCities = citiesFlat.filter(c => c.country && c.country.toLowerCase().includes('pakistan'));
    console.log(`Found ${pakistaniCities.length} Pakistani cities`);
    if (pakistaniCities.length > 0) {
      console.log('Sample Pakistani cities:', pakistaniCities.slice(0, 10).map(c => `${c.name}, ${c.country} (${c.lat}, ${c.lon})`));
    }
  } else {
    console.error('No cities loaded! Check file path and format.');
  }
}

export async function preloadCities(): Promise<void> {
  await ensureLoaded();
}

export function areCitiesLoaded(): boolean {
  return citiesLoaded;
}

export function getLoadedCities(): CityRecord[] {
  return citiesFlat;
}

// Function to determine expected country based on coordinates
function getExpectedCountry(lat: number, lon: number): string | null {
  // Handle longitude wrapping for international date line
  if (lon < 0) lon += 360;
  
  // North America
  if (lat >= 24.0 && lat <= 71.0 && lon >= 167.0 && lon <= 300.0) {
    // United States
    if (lat >= 24.5 && lat <= 49.0 && lon >= 235.0 && lon <= 300.0) return 'united states';
    // Canada
    if (lat >= 41.7 && lat <= 83.1 && lon >= 235.0 && lon <= 300.0) return 'canada';
    // Mexico
    if (lat >= 14.5 && lat <= 32.7 && lon >= 235.0 && lon <= 275.0) return 'mexico';
  }
  
  // South America
  if (lat >= -56.0 && lat <= 12.0 && lon >= 280.0 && lon <= 360.0) {
    // Brazil
    if (lat >= -33.8 && lat <= 5.3 && lon >= 280.0 && lon <= 360.0) return 'brazil';
    // Argentina
    if (lat >= -55.1 && lat <= -21.8 && lon >= 280.0 && lon <= 360.0) return 'argentina';
    // Chile
    if (lat >= -56.0 && lat <= -17.5 && lon >= 280.0 && lon <= 360.0) return 'chile';
    // Peru
    if (lat >= -18.3 && lat <= -0.0 && lon >= 280.0 && lon <= 360.0) return 'peru';
    // Colombia
    if (lat >= -4.2 && lat <= 12.5 && lon >= 280.0 && lon <= 360.0) return 'colombia';
    // Venezuela
    if (lat >= 0.6 && lat <= 15.9 && lon >= 280.0 && lon <= 360.0) return 'venezuela';
  }
  
  // Europe
  if (lat >= 35.0 && lat <= 71.0 && lon >= 0.0 && lon <= 40.0) {
    // Russia (European part)
    if (lat >= 41.2 && lat <= 81.9 && lon >= 19.6 && lon <= 40.0) return 'russia';
    // Germany
    if (lat >= 47.3 && lat <= 55.1 && lon >= 5.9 && lon <= 15.0) return 'germany';
    // France
    if (lat >= 41.3 && lat <= 51.1 && lon >= -5.1 && lon <= 9.6) return 'france';
    // United Kingdom
    if (lat >= 49.9 && lat <= 60.8 && lon >= -8.2 && lon <= 1.8) return 'united kingdom';
    // Italy
    if (lat >= 35.5 && lat <= 47.1 && lon >= 6.6 && lon <= 18.5) return 'italy';
    // Spain
    if (lat >= 35.2 && lat <= 43.8 && lon >= -9.3 && lon <= 4.3) return 'spain';
    // Poland
    if (lat >= 49.0 && lat <= 54.8 && lon >= 14.1 && lon <= 24.1) return 'poland';
    // Ukraine
    if (lat >= 44.4 && lat <= 52.4 && lon >= 22.1 && lon <= 40.2) return 'ukraine';
  }
  
  // Asia
  if (lat >= -11.0 && lat <= 71.0 && lon >= 40.0 && lon <= 180.0) {
    // China
    if (lat >= 18.2 && lat <= 53.6 && lon >= 73.6 && lon <= 135.1) return 'china';
    // India
    if (lat >= 6.5 && lat <= 37.1 && lon >= 68.1 && lon <= 97.4) return 'india';
    // Pakistan
    if (lat >= 23.5 && lat <= 37.1 && lon >= 60.9 && lon <= 77.8) return 'pakistan';
    // Bangladesh
    if (lat >= 20.7 && lat <= 26.6 && lon >= 88.0 && lon <= 92.7) return 'bangladesh';
    // Japan
    if (lat >= 24.2 && lat <= 45.5 && lon >= 123.0 && lon <= 145.8) return 'japan';
    // South Korea
    if (lat >= 33.1 && lat <= 38.6 && lon >= 124.6 && lon <= 131.9) return 'south korea';
    // North Korea
    if (lat >= 37.7 && lat <= 43.0 && lon >= 124.3 && lon <= 130.7) return 'north korea';
    // Thailand
    if (lat >= 5.6 && lat <= 20.5 && lon >= 97.3 && lon <= 105.6) return 'thailand';
    // Vietnam
    if (lat >= 8.6 && lat <= 23.4 && lon >= 102.1 && lon <= 109.5) return 'vietnam';
    // Indonesia
    if (lat >= -11.0 && lat <= 6.1 && lon >= 95.0 && lon <= 141.0) return 'indonesia';
    // Philippines
    if (lat >= 4.6 && lat <= 21.1 && lon >= 116.9 && lon <= 126.6) return 'philippines';
    // Malaysia
    if (lat >= 0.9 && lat <= 7.4 && lon >= 99.6 && lon <= 119.3) return 'malaysia';
    // Singapore
    if (lat >= 1.2 && lat <= 1.5 && lon >= 103.6 && lon <= 104.0) return 'singapore';
    // Myanmar
    if (lat >= 9.8 && lat <= 28.5 && lon >= 92.2 && lon <= 101.2) return 'myanmar';
    // Cambodia
    if (lat >= 10.5 && lat <= 14.7 && lon >= 102.3 && lon <= 107.6) return 'cambodia';
    // Laos
    if (lat >= 13.9 && lat <= 22.5 && lon >= 100.1 && lon <= 107.6) return 'laos';
    // Sri Lanka
    if (lat >= 5.9 && lat <= 9.8 && lon >= 79.7 && lon <= 81.9) return 'sri lanka';
    // Nepal
    if (lat >= 26.4 && lat <= 30.4 && lon >= 80.1 && lon <= 88.2) return 'nepal';
    // Bhutan
    if (lat >= 26.7 && lat <= 28.3 && lon >= 88.7 && lon <= 92.1) return 'bhutan';
    // Afghanistan
    if (lat >= 29.4 && lat <= 38.5 && lon >= 60.5 && lon <= 74.9) return 'afghanistan';
    // Iran
    if (lat >= 25.1 && lat <= 39.8 && lon >= 44.0 && lon <= 63.3) return 'iran';
    // Iraq
    if (lat >= 29.1 && lat <= 37.4 && lon >= 38.8 && lon <= 48.6) return 'iraq';
    // Saudi Arabia
    if (lat >= 16.3 && lat <= 32.2 && lon >= 34.5 && lon <= 55.7) return 'saudi arabia';
    // Turkey
    if (lat >= 35.8 && lat <= 42.1 && lon >= 26.0 && lon <= 45.0) return 'turkey';
    // Kazakhstan
    if (lat >= 40.9 && lat <= 55.4 && lon >= 46.5 && lon <= 87.3) return 'kazakhstan';
    // Uzbekistan
    if (lat >= 37.2 && lat <= 45.6 && lon >= 56.0 && lon <= 73.1) return 'uzbekistan';
    // Mongolia
    if (lat >= 41.6 && lat <= 52.1 && lon >= 87.7 && lon <= 119.9) return 'mongolia';
  }
  
  // Africa
  if (lat >= -35.0 && lat <= 37.5 && lon >= -20.0 && lon <= 55.0) {
    // Egypt
    if (lat >= 22.0 && lat <= 31.7 && lon >= 25.0 && lon <= 36.9) return 'egypt';
    // South Africa
    if (lat >= -47.0 && lat <= -22.1 && lon >= 16.5 && lon <= 32.9) return 'south africa';
    // Nigeria
    if (lat >= 4.3 && lat <= 13.9 && lon >= 2.7 && lon <= 14.7) return 'nigeria';
    // Kenya
    if (lat >= -4.7 && lat <= 5.5 && lon >= 33.9 && lon <= 41.9) return 'kenya';
    // Ethiopia
    if (lat >= 3.4 && lat <= 18.0 && lon >= 33.0 && lon <= 48.0) return 'ethiopia';
    // Morocco
    if (lat >= 21.4 && lat <= 35.9 && lon >= -17.0 && lon <= -1.0) return 'morocco';
    // Algeria
    if (lat >= 18.9 && lat <= 37.1 && lon >= -8.7 && lon <= 12.0) return 'algeria';
    // Libya
    if (lat >= 19.5 && lat <= 33.2 && lon >= 9.3 && lon <= 25.2) return 'libya';
    // Sudan
    if (lat >= 8.7 && lat <= 22.2 && lon >= 21.8 && lon <= 38.6) return 'sudan';
    // Tanzania
    if (lat >= -11.7 && lat <= -1.0 && lon >= 29.3 && lon <= 40.3) return 'tanzania';
    // Uganda
    if (lat >= -1.5 && lat <= 4.2 && lon >= 29.6 && lon <= 35.0) return 'uganda';
    // Ghana
    if (lat >= 4.7 && lat <= 11.2 && lon >= -3.3 && lon <= 1.3) return 'ghana';
    // Angola
    if (lat >= -18.0 && lat <= -4.4 && lon >= 11.7 && lon <= 24.1) return 'angola';
    // Mozambique
    if (lat >= -26.9 && lat <= -10.5 && lon >= 30.2 && lon <= 40.8) return 'mozambique';
    // Madagascar
    if (lat >= -25.6 && lat <= -11.9 && lon >= 43.2 && lon <= 50.5) return 'madagascar';
  }
  
  // Oceania
  if (lat >= -50.0 && lat <= 0.0 && lon >= 110.0 && lon <= 180.0) {
    // Australia
    if (lat >= -43.6 && lat <= -10.7 && lon >= 113.3 && lon <= 153.6) return 'australia';
    // New Zealand
    if (lat >= -47.3 && lat <= -34.4 && lon >= 166.5 && lon <= 178.6) return 'new zealand';
    // Papua New Guinea
    if (lat >= -12.0 && lat <= -1.0 && lon >= 140.8 && lon <= 159.9) return 'papua new guinea';
    // Fiji
    if (lat >= -20.7 && lat <= -16.0 && lon >= 177.0 && lon <= 180.0) return 'fiji';
  }
  
  // Russia (Asian part)
  if (lat >= 41.2 && lat <= 81.9 && lon >= 19.6 && lon <= 180.0) {
    return 'russia';
  }
  
  return null;
}

export async function reverseGeocode(lat: number, lon: number): Promise<CityRecord | null> {
  await ensureLoaded();
  
  // Validate input coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.error('Invalid coordinates:', lat, lon);
    return null;
  }
  
  // Clamp coordinates to valid ranges
  lat = Math.max(-90, Math.min(90, lat));
  lon = Math.max(-180, Math.min(180, lon));
  
  console.log(`Reverse geocoding for lat: ${lat}, lon: ${lon}`);
  
  // Determine expected country based on coordinates
  const expectedCountry = getExpectedCountry(lat, lon);
  console.log(`Expected country based on coordinates: ${expectedCountry || 'unknown'}`);
  
  let best: { city: CityRecord; dist: number } | null = null;
  const candidates: { city: CityRecord; dist: number }[] = [];
  
  // Search within ~2 degrees neighborhood to avoid scanning entire dataset
  const neighborKeys = getNeighborKeys(lat, lon, 2);
  console.log(`Searching in ${neighborKeys.length} grid cells:`, neighborKeys);
  
  for (const key of neighborKeys) {
    const list = gridIndex.get(key);
    if (!list) continue;
    console.log(`Grid cell ${key} has ${list.length} cities`);
    for (const c of list) {
      const d = haversineDistanceKm(lat, lon, c.lat, c.lon);
      candidates.push({ city: c, dist: d });
      
      // Prioritize cities from the expected country
      const cityCountry = c.country?.toLowerCase() || '';
      const isExpectedCountry = expectedCountry && cityCountry.includes(expectedCountry);
      
      if (!best) {
        best = { city: c, dist: d };
        console.log(`New best city: ${c.name}, ${c.country} (${d.toFixed(2)}km away) ${isExpectedCountry ? '✅ EXPECTED COUNTRY' : '❌ WRONG COUNTRY'}`);
      } else {
        // If this is the expected country, use it even if slightly farther
        if (isExpectedCountry && !best.city.country?.toLowerCase().includes(expectedCountry)) {
          // Use expected country city if it's within 300km of the closest city
          if (d < best.dist + 300) {
            best = { city: c, dist: d };
            console.log(`🔄 Switching to expected country city: ${c.name}, ${c.country} (${d.toFixed(2)}km away)`);
          }
        } else if (!isExpectedCountry && best.city.country?.toLowerCase().includes(expectedCountry)) {
          // Keep the expected country city
          console.log(`Keeping expected country city: ${best.city.name}, ${best.city.country}`);
        } else if (d < best.dist) {
          // Use closer city if both are same country preference
          best = { city: c, dist: d };
          console.log(`New best city: ${c.name}, ${c.country} (${d.toFixed(2)}km away)`);
        }
      }
    }
  }
  
  // If nothing found (e.g., empty cells), widen search slightly
  if (!best) {
    console.log('No cities found in 2-degree radius, expanding to 5 degrees');
    const neighborKeysWide = getNeighborKeys(lat, lon, 5);
    for (const key of neighborKeysWide) {
      const list = gridIndex.get(key);
      if (!list) continue;
      for (const c of list) {
        const d = haversineDistanceKm(lat, lon, c.lat, c.lon);
        candidates.push({ city: c, dist: d });
        
        const cityCountry = c.country?.toLowerCase() || '';
        const isExpectedCountry = expectedCountry && cityCountry.includes(expectedCountry);
        
        if (!best) {
          best = { city: c, dist: d };
          console.log(`New best city (wide search): ${c.name}, ${c.country} (${d.toFixed(2)}km away) ${isExpectedCountry ? '✅ EXPECTED COUNTRY' : '❌ WRONG COUNTRY'}`);
        } else if (isExpectedCountry && !best.city.country?.toLowerCase().includes(expectedCountry)) {
          if (d < best.dist + 300) {
            best = { city: c, dist: d };
            console.log(`🔄 Switching to expected country city (wide): ${c.name}, ${c.country} (${d.toFixed(2)}km away)`);
          }
        } else if (d < best.dist) {
          best = { city: c, dist: d };
          console.log(`New best city (wide search): ${c.name}, ${c.country} (${d.toFixed(2)}km away)`);
        }
      }
    }
  }
  
  // If still no results, do a full scan (fallback)
  if (!best && citiesFlat.length > 0) {
    console.log('No cities found in grid search, doing full scan...');
    for (const c of citiesFlat) {
      const d = haversineDistanceKm(lat, lon, c.lat, c.lon);
      const cityCountry = c.country?.toLowerCase() || '';
      const isExpectedCountry = expectedCountry && cityCountry.includes(expectedCountry);
      
      if (!best) {
        best = { city: c, dist: d };
        console.log(`New best city (full scan): ${c.name}, ${c.country} (${d.toFixed(2)}km away) ${isExpectedCountry ? '✅ EXPECTED COUNTRY' : '❌ WRONG COUNTRY'}`);
      } else if (isExpectedCountry && !best.city.country?.toLowerCase().includes(expectedCountry)) {
        if (d < best.dist + 300) {
          best = { city: c, dist: d };
          console.log(`🔄 Switching to expected country city (full scan): ${c.name}, ${c.country} (${d.toFixed(2)}km away)`);
        }
      } else if (d < best.dist) {
        best = { city: c, dist: d };
        console.log(`New best city (full scan): ${c.name}, ${c.country} (${d.toFixed(2)}km away)`);
      }
    }
  }
  
  if (best) {
    console.log(`Final result: ${best.city.name}, ${best.city.country} (${best.dist.toFixed(2)}km away)`);
    console.log(`City coordinates: ${best.city.lat}, ${best.city.lon}`);
    
    // Log top 5 candidates for debugging
    const sortedCandidates = candidates.sort((a, b) => a.dist - b.dist).slice(0, 5);
    console.log('Top 5 candidates:', sortedCandidates.map(c => 
      `${c.city.name}, ${c.city.country} (${c.dist.toFixed(2)}km)`
    ));
  } else {
    console.log('No cities found in entire search radius');
  }
  
  return best ? best.city : null;
}

export async function searchCities(query: string, limit = 20): Promise<CityRecord[]> {
  await ensureLoaded();
  const q = query.normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
  if (!q) return [];
  
  console.log(`Searching for "${q}" in ${citiesFlat.length} cities`);
  
  // Use improved ranking algorithm
  const buckets: { prefix: CityRecord[], wordStart: CityRecord[], substring: CityRecord[] } = {
    prefix: [], wordStart: [], substring: []
  };

  for (const city of citiesFlat) {
    const name = (city.name || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const parts = name.split(/\s+/);
    
    if (name.startsWith(q)) {
      buckets.prefix.push(city);
    } else if (parts.some(p => p.startsWith(q))) {
      buckets.wordStart.push(city);
    } else if (name.includes(q)) {
      buckets.substring.push(city);
    }
  }

  // Sort each bucket by population (descending)
  const popSort = (a: CityRecord, b: CityRecord) => (b.population || 0) - (a.population || 0);
  
  buckets.prefix.sort(popSort);
  buckets.wordStart.sort(popSort);
  buckets.substring.sort(popSort);

  const merged = [...buckets.prefix, ...buckets.wordStart, ...buckets.substring];
  const results = merged.slice(0, limit);
  
  console.log(`Found ${results.length} results for "${q}"`);
  if (results.length > 0) {
    console.log('Top results:', results.slice(0, 3).map(r => `${r.name}, ${r.country} (${r.population || 'no pop'})`));
  }
  
  return results;
}


