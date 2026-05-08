import axios from 'axios';

const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';

// Simple in-memory cache to prevent redundant API calls
const elevationCache = new Map();

/**
 * Rounds coordinates to 4 decimal places (~11m precision) 
 * to increase cache hits while maintaining accuracy.
 */
function getCacheKey(lat, lon) {
  return `${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`;
}

/**
 * Get elevation (meters) for a single lat/lon point
 * Uses Open Elevation API — free, no key required
 */
export async function fetchElevation(lat, lon) {
  const cacheKey = getCacheKey(lat, lon);
  if (elevationCache.has(cacheKey)) {
    return elevationCache.get(cacheKey);
  }

  try {
    const response = await axios.post(OPEN_ELEVATION_URL, {
      locations: [{ latitude: parseFloat(lat), longitude: parseFloat(lon) }],
    }, { timeout: 5000 });

    const results = response.data.results;
    if (results && results.length > 0) {
      const elev = results[0].elevation;
      elevationCache.set(cacheKey, elev);
      return elev;
    }
    return 15; // Default fallback
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn(`[ElevationService] Rate limited (429). Using fallback for ${cacheKey}`);
      return 15; // Realistic default for flood zones
    }
    console.error('[ElevationService] Error:', err.message);
    return 15;
  }
}

/**
 * Batch fetch elevations for multiple points
 */
export async function fetchElevationBatch(points) {
  const results = new Array(points.length).fill(null);
  const missingPoints = [];
  const missingIndices = [];

  points.forEach((p, idx) => {
    const key = getCacheKey(p.lat, p.lon);
    if (elevationCache.has(key)) {
      results[idx] = elevationCache.get(key);
    } else {
      missingPoints.push({ latitude: parseFloat(p.lat), longitude: parseFloat(p.lon) });
      missingIndices.push(idx);
    }
  });

  if (missingPoints.length === 0) return results;

  try {
    const response = await axios.post(OPEN_ELEVATION_URL, { 
      locations: missingPoints 
    }, { timeout: 10000 });

    const fetchedResults = response.data.results;
    fetchedResults.forEach((r, i) => {
      const idx = missingIndices[i];
      const lat = missingPoints[i].latitude;
      const lon = missingPoints[i].longitude;
      const elev = r.elevation;
      
      results[idx] = elev;
      elevationCache.set(getCacheKey(lat, lon), elev);
    });
  } catch (err) {
    console.warn('[ElevationService] Batch fetch failed, filling with defaults:', err.message);
    missingIndices.forEach(idx => {
      results[idx] = 15; // Fallback
    });
  }

  return results;
}

/**
 * Normalize elevation to a risk factor
 * Lower elevation = higher flood risk
 * 0–10m   → very high risk factor (0.9–1.0)
 * 10–50m  → high risk factor     (0.6–0.9)
 * 50–200m → medium risk factor   (0.2–0.6)
 * 200m+   → low risk factor      (0.0–0.2)
 */
export function normalizeElevation(elevationMeters) {
  if (elevationMeters === null || elevationMeters === undefined) return 0.5; // default if unknown

  if (elevationMeters <= 0)   return 1.0;
  if (elevationMeters <= 10)  return 0.9;
  if (elevationMeters <= 25)  return 0.75;
  if (elevationMeters <= 50)  return 0.6;
  if (elevationMeters <= 100) return 0.4;
  if (elevationMeters <= 200) return 0.2;
  return 0.05;
}
