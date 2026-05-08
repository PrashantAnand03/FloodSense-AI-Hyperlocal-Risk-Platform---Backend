import express from 'express';
import { calculateRisk, calculateMultiRisk, calculateForecastRisk } from '../controllers/riskController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { runGlobalMonitoring } from '../services/monitorService.js';

const router = express.Router();

// Public trigger for demo purposes (usually would be a CRON job)
router.get('/scan', async (req, res) => {
  runGlobalMonitoring(); // Run in background
  res.json({ message: 'Global monitoring scan started in background...' });
});

// All risk routes require authentication to track user alerts
router.use(requireAuth);

// POST /api/risk/calculate  { lat, lon, locationName? }
router.post('/calculate', calculateRisk);

// POST /api/risk/multi  { locations: [{lat, lon, name}] }
router.post('/multi', calculateMultiRisk);

// POST /api/risk/forecast
router.post('/forecast', calculateForecastRisk);

export default router;
