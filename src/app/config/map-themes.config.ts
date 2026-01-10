// Map Theme Configuration for Leaflet Maps
// Different tile layer providers for various map themes

export interface MapTheme {
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
}

export const MAP_THEMES: { [key: string]: MapTheme } = {
  // Default OpenStreetMap (current)
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  },
  
  // Light theme - CartoDB Positron
  light: {
    name: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19
  },
  
  // Dark theme - CartoDB Dark Matter
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19
  },
  
  // Satellite/Imagery - Esri World Imagery
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19
  }
};

// Default theme
export const DEFAULT_MAP_THEME = 'light';

