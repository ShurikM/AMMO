// ── Leaflet Map integration ─────────────────────────────────────────
// Optional map layer that sits UNDER the sim canvas.
// Toggle on/off with the MAP button. Provides coordinate bridge
// between canvas pixel positions and lat/lng.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { S, V } from '../sim/engine.js';

let map = null;
let mapEnabled = false;
let mapCenter = [31.7683, 35.2137]; // Jerusalem default

export function initMap() {
  const container = document.getElementById('canvas-wrap');

  // Create map div (hidden by default)
  const mapDiv = document.createElement('div');
  mapDiv.id = 'leaflet-map';
  mapDiv.style.cssText = 'position:absolute;inset:0;z-index:0;display:none;';
  container.insertBefore(mapDiv, container.firstChild);

  // Initialize Leaflet map
  map = L.map('leaflet-map', {
    center: mapCenter,
    zoom: 14,
    zoomControl: false,
    attributionControl: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OSM',
    maxZoom: 18
  }).addTo(map);

  // On map move/zoom, sync drone canvas positions
  map.on('move zoom', () => {
    if (mapEnabled) syncDronePositions();
  });
}

export function toggleMap() {
  mapEnabled = !mapEnabled;
  const mapDiv = document.getElementById('leaflet-map');
  const canvas = document.getElementById('sim-canvas');

  if (mapEnabled) {
    mapDiv.style.display = 'block';
    canvas.style.background = 'transparent';
    map.invalidateSize();
    // Convert current pixel positions to lat/lng
    assignLatLng();
  } else {
    mapDiv.style.display = 'none';
    canvas.style.background = '';
  }

  return mapEnabled;
}

export function isMapEnabled() { return mapEnabled; }

// Convert canvas pixel to lat/lng
function pixelToLatLng(x, y) {
  if (!map) return { lat: 0, lng: 0 };
  const center = map.getCenter();
  const zoom = map.getZoom();
  const scale = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
  // scale = meters per pixel at this zoom
  const cw = S.worldWidth / 2;
  const ch = S.worldHeight / 2;
  const dx = (x - cw) * scale; // meters east
  const dy = (ch - y) * scale; // meters north (canvas Y is inverted)
  const dlat = dy / 111320;
  const dlng = dx / (111320 * Math.cos(center.lat * Math.PI / 180));
  return { lat: center.lat + dlat, lng: center.lng + dlng };
}

// Convert lat/lng to canvas pixel
function latLngToPixel(lat, lng) {
  if (!map) return { x: 0, y: 0 };
  const point = map.latLngToContainerPoint([lat, lng]);
  return { x: point.x, y: point.y };
}

// Assign lat/lng to all drones based on current pixel positions
function assignLatLng() {
  S.drones.forEach(d => {
    const ll = pixelToLatLng(d.x, d.y);
    d.lat = ll.lat;
    d.lng = ll.lng;
    const oll = pixelToLatLng(d.originX, d.originY);
    d.originLat = oll.lat;
    d.originLng = oll.lng;
  });
}

// Recalculate drone x/y from lat/lng (called on map move/zoom)
function syncDronePositions() {
  S.drones.forEach(d => {
    if (d.lat != null && d.lng != null) {
      const p = latLngToPixel(d.lat, d.lng);
      d.x = p.x;
      d.y = p.y;
    }
    if (d.originLat != null && d.originLng != null) {
      const p = latLngToPixel(d.originLat, d.originLng);
      d.originX = p.x;
      d.originY = p.y;
    }
  });
  // Also sync zones
  S.zones.forEach(z => {
    if (z.lat != null && z.lng != null) {
      const p = latLngToPixel(z.lat, z.lng);
      z.x = p.x;
      z.y = p.y;
    }
  });
}

export function getMap() { return map; }
