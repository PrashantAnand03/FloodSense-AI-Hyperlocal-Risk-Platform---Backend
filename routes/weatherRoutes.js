import express from 'express';
import {
  getCurrentWeatherByCoords,
  getCurrentWeatherByLocation,
  getForecast,
  getLocationSearch,
} from '../controllers/weatherController.js';

const router = express.Router();

// GET /api/weather/search?q=london
router.get('/search', getLocationSearch);

// GET /api/weather/current?lat=51.5&lon=-0.1
// GET /api/weather/current?location=London
router.get('/current', (req, res) => {
  if (req.query.lat && req.query.lon) return getCurrentWeatherByCoords(req, res);
  if (req.query.location)             return getCurrentWeatherByLocation(req, res);
  return res.status(400).json({ error: 'Provide lat/lon or location' });
});

// GET /api/weather/forecast?lat=51.5&lon=-0.1
router.get('/forecast', getForecast);

export default router;
