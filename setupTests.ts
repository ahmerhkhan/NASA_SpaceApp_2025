// Jest setup file for Project Rumbling
import '@testing-library/jest-dom';
import React from 'react';

// Mock Leaflet for testing
jest.mock('leaflet', () => ({
  map: jest.fn(),
  tileLayer: jest.fn(),
  circle: jest.fn(),
  tooltip: jest.fn(),
  icon: jest.fn(),
  divIcon: jest.fn(),
  marker: jest.fn(),
  popup: jest.fn(),
  latLng: jest.fn(),
  latLngBounds: jest.fn(),
  CRS: {
    EPSG3857: {}
  }
}));

// Mock react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'map-container' }, children),
  TileLayer: () => React.createElement('div', { 'data-testid': 'tile-layer' }),
  Circle: ({ center, radius, pathOptions, children }: any) => 
    React.createElement('div', {
      'data-testid': 'circle',
      'data-center': JSON.stringify(center),
      'data-radius': radius,
      'data-path-options': JSON.stringify(pathOptions)
    }, children),
  Tooltip: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'tooltip' }, children),
  useMap: () => ({
    setView: jest.fn(),
    flyTo: jest.fn(),
    getZoom: () => 8,
    getCenter: () => ({ lat: 0, lng: 0 })
  })
}));

// Mock canvas for animation testing
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  save: jest.fn(),
  restore: jest.fn(),
  globalAlpha: 1,
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  lineCap: 'round'
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Suppress console warnings during tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});