// Haversine formula to calculate distance between two points on a sphere
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function findClosestCity(lat: number, lon: number): Promise<{ 
  name: string, 
  country: string, 
  distance: number 
} | null> {
  try {
    // Fetch cities from the educational dataset
    const response = await fetch('/public/education/cities.geojson')
    const citiesData = await response.json()

    let closestCity: { 
      name: string, 
      country: string, 
      distance: number 
    } | null = null;
    
    for (const city of citiesData.features) {
      const cityLat = city.properties.LATITUDE;
      const cityLon = city.properties.LONGITUDE;
      const distance = haversineDistance(lat, lon, cityLat, cityLon);
      
      if (!closestCity || distance < closestCity.distance) {
        closestCity = {
          name: city.properties.NAME || 'Unknown City',
          country: city.properties.ADM0NAME || 'Unknown Country',
          distance
        };
      }
    }

    return closestCity;
  } catch (error) {
    console.error('Error finding closest city:', error)
    return null;
  }
}

export function formatLocation(lat: number, lon: number, closestCity?: { 
  name: string, 
  country: string, 
  distance: number 
} | null): string {
  const formattedLat = lat.toFixed(4)
  const formattedLon = lon.toFixed(4)
  
  if (closestCity) {
    return `${closestCity.name}, ${closestCity.country} (${closestCity.distance.toFixed(1)} km)`
  }
  
  return `Latitude: ${formattedLat}, Longitude: ${formattedLon}`
}
