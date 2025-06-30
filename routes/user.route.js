import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser
} from '../controller/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Admin routes (all protected)
router.get('/', protect, getAllUsers);
router.put('/:id/role', protect, updateUserRole);
router.put('/:id/status', protect, updateUserStatus);
router.delete('/:id', protect, deleteUser);

export default router; 