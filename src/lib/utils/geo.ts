import { Coordinates, GeoBounds } from '../../types/geo';
import { GEO_BOUNDS } from '../../config/constants';

export const isWithinAssam = (coordinates: Coordinates): boolean => {
  const { ASSAM } = GEO_BOUNDS;
  
  return coordinates.latitude >= ASSAM.south &&
         coordinates.latitude <= ASSAM.north &&
         coordinates.longitude >= ASSAM.west &&
         coordinates.longitude <= ASSAM.east;
};

export const getCurrentLocation = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      }
    );
  });
};