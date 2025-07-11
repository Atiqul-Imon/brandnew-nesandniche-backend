import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getUserProfileByUsername,
  toggleFollow,
  changePassword,
  forgotPassword,
  resetPassword
} from '../controller/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { 
  requireAdmin, 
  requireModerator, 
  canManageUsers, 
  canManageRoles 
} from '../middleware/permissions.middleware.js';
import { 
  loginLimiter, 
  registerLimiter, 
  authLimiter 
} from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/register', registerLimiter, registerUser);
router.post('/login', loginLimiter, loginUser);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/profile/:username', authLimiter, getUserProfileByUsername);

// Protected routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/change-password', protect, changePassword);
router.post('/:id/follow', protect, toggleFollow);

// Admin/Moderator only routes
router.get('/', protect, canManageUsers, getAllUsers);
router.put('/:id/status', protect, canManageUsers, updateUserStatus);
router.delete('/:id', protect, requireAdmin, deleteUser);

// Admin only routes
router.put('/:id/role', protect, canManageRoles, updateUserRole);

export default router; 