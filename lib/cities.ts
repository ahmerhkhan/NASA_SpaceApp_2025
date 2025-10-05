export async function loadCities(): Promise<GeoJSON.FeatureCollection> {
  // Prefer rich datasets with population first
  const candidates: Array<{ path: string; type: 'geojson' | 'json' }> = [
    { path: '/data/educational/cities.json', type: 'json' },
    { path: '/data/educational/cities.geojson', type: 'geojson' },
    { path: '/data/cities.geojson', type: 'geojson' }
  ];
  for (const c of candidates) {
    try {
      const res = await fetch(c.path);
      if (!res.ok) continue;
      const data = await res.json();
      if (c.type === 'geojson' && data && Array.isArray(data.features)) {
        // Normalize population fields and filter
        const normalized = (data.features as any[]).map((f: any) => {
          const p = f?.properties || {};
          const pop = Number(
            p.population ?? p.POP_MAX ?? p.pop_max ?? p.POP ?? p.POP_EST ?? 0
          ) || 0;
        
          // Ensure Point geometry preferred; if not point, keep geometry but set pop for later centroid handling if needed
          return {
            ...f,
            properties: {
              ...p,
              population: pop,
              name: p.name || p.NAME || p.city || p.town || 'Unknown',
              country: p.country || p.SOV0NAME || p.ADM0NAME || p.cc
            }
          };
        });
        const withPop = normalized.filter((f: any) => Number(f.properties?.population) > 0);
        console.info(`[cities] Loaded ${normalized.length} features (${withPop.length} with population) from ${c.path}`);
        // If this dataset has at least some population coverage, use it; otherwise try next candidate
        if (withPop.length > 0) {
          return { type: 'FeatureCollection', features: normalized } as GeoJSON.FeatureCollection;
        } else {
          continue;
        }
      }
      if (c.type === 'json' && Array.isArray(data)) {
        const features: GeoJSON.Feature[] = data
          .map((d: any) => {
            const lat = Number(d.lat ?? d.latitude);
            const lon = Number(d.lon ?? d.lng ?? d.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lon, lat] },
              properties: {
                id: d.id || d.geonameid || undefined,
                name: d.name || d.city || d.town || 'Unknown',
                country: d.country || d.country_name || d.cc,
                // Prefer explicit population; fallback to common alt fields
                population: Number(d.population ?? d.POP_MAX ?? d.pop_max ?? d.pop ?? d.POP_EST ?? 0) || undefined,
                lat, lon
              }
            } as GeoJSON.Feature;
          })
          .filter(Boolean) as GeoJSON.Feature[];
        console.info(`[cities] Loaded ${features.length} point features from ${c.path}`);
        const withPop = features.filter(f => Number((f.properties as any)?.population) > 0);
        if (withPop.length > 0) {
        return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection;
        } else {
          continue;
        }
      }
    } catch {}
  }
  // Fallback: attempt to import bundled src data (development)
  try {
    const mod: any = await import('../data/cities.json');
    const arr: any[] = Array.isArray(mod.default) ? mod.default : (Array.isArray(mod) ? mod : []);
    const features: GeoJSON.Feature[] = arr
      .map((d: any) => {
        const lat = Number(d.lat ?? d.latitude ?? d.LATITUDE);
        const lon = Number(d.lon ?? d.lng ?? d.longitude ?? d.LONGITUDE);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const population = Number(d.population ?? d.POP_MAX ?? d.pop_max ?? d.POP ?? 0) || 0;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            id: d.id || d.geonameid || undefined,
            name: d.name || d.city || d.town || d.NAME || 'Unknown',
            country: d.country || d.country_name || d.cc || d.ADM0NAME,
            population,
            lat, lon
          }
        } as GeoJSON.Feature;
      })
      .filter(Boolean) as GeoJSON.Feature[];
    if (features.length > 0) {
      console.info(`[cities] Loaded ${features.length} point features from src/data/cities.json fallback`);
      return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection;
    }
  } catch {}

  throw new Error('No cities dataset available');
}

export type CityFeature = GeoJSON.Feature<GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon, {
  id?: string;
  name: string;
  country?: string;
  population?: number;
  lat?: number;
  lon?: number;
}>;


