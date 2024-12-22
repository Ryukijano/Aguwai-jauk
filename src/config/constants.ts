import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Application name and branding
export const APP_NAME = {
  ASSAMESE: 'আগুৱাই যাওঁক', // Corrected Assamese text for "Moving Forward"
  ENGLISH: 'Aguwai Juak',
  TAGLINE: 'Moving Forward'
};

// Geographical boundaries of Assam
export const GEO_BOUNDS = {
  ASSAM: {
    north: 27.9389, // Northernmost point of Assam
    south: 24.1012, // Southernmost point of Assam
    east: 95.9766,  // Easternmost point of Assam
    west: 89.7085   // Westernmost point of Assam
  }
};

// Re-export existing constants
export { SUBJECTS, EXPERIENCE_LEVELS, JOB_TYPES, SCHOOL_TYPES, DISTRICTS } from '../lib/constants';

// Google Maps API Key
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Gemini API Configuration
export const GEMINI_API_VERSION = 'gemini-1.5-8b';
