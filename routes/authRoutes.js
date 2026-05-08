import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  getAllUsers,
  deleteUser,
} from '../controllers/authController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected routes (must be logged in)
router.get('/me', requireAuth, getMe);
router.patch('/profile', requireAuth, updateProfile);

// Admin only routes
router.get('/users', requireAuth, requireAdmin, getAllUsers);
router.delete('/users/:id', requireAuth, requireAdmin, deleteUser);

export default router;
