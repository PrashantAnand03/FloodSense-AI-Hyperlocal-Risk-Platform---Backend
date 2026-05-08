import express from 'express';
import { getElevation } from '../controllers/elevationController.js';

const router = express.Router();

// GET /api/elevation?lat=51.5&lon=-0.1
router.get('/', getElevation);

export default router;
