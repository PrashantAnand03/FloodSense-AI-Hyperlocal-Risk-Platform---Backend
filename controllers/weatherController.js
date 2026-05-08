import { fetchWeatherByCoords, fetchWeatherByLocation, fetchForecastByCoords, searchLocations } from '../services/weatherService.js';

/**
 * GET /api/weather/current?lat=&lon=
 */
export async function getCurrentWeatherByCoords(req, res) {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

    const data = await fetchWeatherByCoords(parseFloat(lat), parseFloat(lon));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[WeatherController] coords error:', err.message);
    res.status(500).json({ error: 'Failed to fetch weather data', details: err.message });
  }
}

/**
 * GET /api/weather/current?location=
 */
export async function getCurrentWeatherByLocation(req, res) {
  try {
    const { location } = req.query;
    if (!location) return res.status(400).json({ error: 'location query is required' });

    const data = await fetchWeatherByLocation(location);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[WeatherController] location error:', err.message);
    res.status(500).json({ error: 'Failed to fetch weather data', details: err.message });
  }
}

/**
 * GET /api/weather/forecast?lat=&lon=
 */
export async function getForecast(req, res) {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

    const data = await fetchForecastByCoords(parseFloat(lat), parseFloat(lon));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[WeatherController] forecast error:', err.message);
    res.status(500).json({ error: 'Failed to fetch forecast', details: err.message });
  }
}

/**
 * GET /api/weather/search?q=
 */
export async function getLocationSearch(req, res) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ success: true, data: [] });

    const data = await searchLocations(q);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[WeatherController] search error:', err.message);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
}
