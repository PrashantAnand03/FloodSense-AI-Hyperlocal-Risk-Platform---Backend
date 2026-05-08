import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const BASE_URL = 'http://api.weatherapi.com/v1';

// Simple in-memory cache with expiration
const weatherCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(lat, lon, type = 'current') {
  return `${type}:${parseFloat(lat).toFixed(3)},${parseFloat(lon).toFixed(3)}`;
}

function getFromCache(key) {
  const cached = weatherCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  return null;
}

function setInCache(key, data) {
  weatherCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fetch current weather by lat/lon
 */
export async function fetchWeatherByCoords(lat, lon) {
  const cacheKey = getCacheKey(lat, lon, 'current');
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${BASE_URL}/current.json`, {
      params: {
        key: WEATHER_API_KEY,
        q: `${lat},${lon}`,
        aqi: 'no',
      },
      timeout: 8000,
    });
    
    setInCache(cacheKey, response.data);
    return response.data;
  } catch (err) {
    console.warn(`[WeatherService] API failed (${err.message}). Returning offline mock.`);
    return {
      location: { name: 'Offline Mode', region: 'Local', country: 'Local' },
      current: { temp_c: 20, condition: { text: 'Unknown (Offline)' }, precip_mm: 0, humidity: 50, wind_kph: 0 }
    };
  }
}

/**
 * Fetch weather by city/location name
 */
export async function fetchWeatherByLocation(location) {
  const response = await axios.get(`${BASE_URL}/current.json`, {
    params: {
      key: WEATHER_API_KEY,
      q: location,
      aqi: 'no',
    },
    timeout: 8000,
  });
  return response.data;
}

/**
 * Fetch 3-day forecast by coords
 */
export async function fetchForecastByCoords(lat, lon) {
  const response = await axios.get(`${BASE_URL}/forecast.json`, {
    params: {
      key: WEATHER_API_KEY,
      q: `${lat},${lon}`,
      days: 7,
      aqi: 'no',
      alerts: 'yes',
    },
    timeout: 8000,
  });
  return response.data;
}

/**
 * Search/autocomplete locations
 */
export async function searchLocations(query) {
  const response = await axios.get(`${BASE_URL}/search.json`, {
    params: {
      key: WEATHER_API_KEY,
      q: query,
    },
    timeout: 5000,
  });
  return response.data;
}

/**
 * Extract normalized rainfall metric from WeatherAPI response
 * Returns rainfall intensity in mm/hr (normalized 0–1)
 */
export function extractRainfallFactor(weatherData, simulateExtreme = false) {
  if (simulateExtreme) {
    console.log('[WeatherService] 🌧️ Simulating EXTREME rainfall factor');
    return 0.95; // Extreme rain simulation
  }

  const current = weatherData.current;
  const precipMm = current.precip_mm || 0;
  const humidity  = current.humidity || 0;

  // WeatherAPI precip_mm is last hour total
  // Normalize: 0–50mm/hr scale (50mm/hr = extreme)
  const precipNorm = Math.min(precipMm / 50, 1);

  // Humidity factor (adds to risk when combined with rain)
  const humidityFactor = humidity > 85 ? 0.15 : humidity > 70 ? 0.08 : 0;

  return Math.min(precipNorm + humidityFactor, 1);
}

/**
 * Extract normalized rainfall metric for a forecast day
 */
export function extractForecastRainfallFactor(dayData) {
  const precipMm = dayData.day?.totalprecip_mm || 0;
  const humidity  = dayData.day?.avghumidity || 0;
  
  const precipNorm = Math.min(precipMm / 50, 1);
  const humidityFactor = humidity > 85 ? 0.15 : humidity > 70 ? 0.08 : 0;
  
  return Math.min(precipNorm + humidityFactor, 1);
}
