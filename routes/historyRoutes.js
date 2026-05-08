import express from 'express';
import { saveAssessment, getHistory, getHistoryStats, deleteAssessment } from '../controllers/historyController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require auth
router.use(requireAuth);

router.get('/stats',  getHistoryStats);     // GET  /api/history/stats
router.get('/',       getHistory);          // GET  /api/history?limit=50
router.post('/',      saveAssessment);      // POST /api/history
router.delete('/:id', deleteAssessment);    // DELETE /api/history/:id

export default router;
