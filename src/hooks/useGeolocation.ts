import { useState, useEffect } from 'react';
import { getCurrentLocation, isWithinAssam } from '../lib/utils/geo';
import { LocationState } from '../types/geo';

export function useGeolocation(): LocationState {
  const [isInAssam, setIsInAssam] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkLocation = async () => {
      try {
        const coordinates = await getCurrentLocation();
        setIsInAssam(isWithinAssam(coordinates));
      } catch (err) {
        setError('Unable to determine location. Showing all available jobs.');
        setIsInAssam(null);
      }
    };

    checkLocation();
  }, []);

  return { isInAssam, error };
}