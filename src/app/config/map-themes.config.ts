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
  },
  
  // Terrain - Stamen Terrain
  terrain: {
    name: 'Terrain',
    url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png',
    attribution: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
    maxZoom: 18
  },
  
  // Black and White - Stamen Toner
  toner: {
    name: 'Toner',
    url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.png',
    attribution: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
    maxZoom: 20
  },
  
  // Watercolor - Stamen Watercolor
  watercolor: {
    name: 'Watercolor',
    url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg',
    attribution: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
    maxZoom: 18
  }
};

// Default theme
export const DEFAULT_MAP_THEME = 'osm';

