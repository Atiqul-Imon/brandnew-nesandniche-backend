import express from 'express';
import {
  submitGuestPost,
  getAllGuestSubmissions,
  getGuestSubmissionById,
  updateGuestSubmissionStatus,
  publishGuestPost,
  deleteGuestSubmission,
  getGuestPostStats,
  getMyGuestSubmissions
} from '../controller/guestPost.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { requireModerator, requireAdmin } from '../middleware/permissions.middleware.js';
import { adminActionLimiter, blogActionLimiter } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Submit requires authentication
router.post('/submit', protect, blogActionLimiter, submitGuestPost);

// Protected routes (Admin/Moderator)
router.use(protect, requireModerator);

router.get('/', getAllGuestSubmissions);
router.get('/my', protect, getMyGuestSubmissions);
router.get('/stats/overview', getGuestPostStats);
router.get('/:id', getGuestSubmissionById);
// Public edit endpoints guarded by signed token will be added later if needed
router.put('/:id/status', adminActionLimiter, updateGuestSubmissionStatus);
router.post('/:id/publish', adminActionLimiter, publishGuestPost);

// Admin only routes
router.delete('/:id', requireAdmin, adminActionLimiter, deleteGuestSubmission);

export default router;
