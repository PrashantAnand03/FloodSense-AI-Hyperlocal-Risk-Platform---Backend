import express from 'express';
import { getSavedLocations, saveLocation, deleteLocation } from '../controllers/locationsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require auth
router.use(requireAuth);

router.get('/',       getSavedLocations);   // GET  /api/locations
router.post('/',      saveLocation);        // POST /api/locations
router.delete('/:id', deleteLocation);      // DELETE /api/locations/:id

export default router;
