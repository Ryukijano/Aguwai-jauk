export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LocationState {
  isInAssam: boolean | null;
  error: string | null;
}