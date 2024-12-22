import { Coordinates } from '../../types/geo';

export async function getCoordinatesFromAddress(address: string): Promise<Coordinates | null> {
  try {
    const query = encodeURIComponent(`${address}, Assam, India`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`
    );
    const data = await response.json();

    if (data && data[0]) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}