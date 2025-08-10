import express from 'express';
import {
  submitSponsoredPost,
  getAllSponsoredSubmissions,
  getSponsoredSubmissionById,
  updateSponsoredSubmissionStatus,
  publishSponsoredPost,
  deleteSponsoredSubmission,
  getSponsoredPostStats,
  getMySponsoredSubmissions
} from '../controller/sponsoredPost.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { requireModerator, requireAdmin } from '../middleware/permissions.middleware.js';
import { adminActionLimiter, blogActionLimiter } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Submit requires authentication
router.post('/submit', protect, blogActionLimiter, submitSponsoredPost);

// Protected routes (Admin/Moderator)
router.use(protect, requireModerator);

router.get('/', getAllSponsoredSubmissions);
router.get('/my', protect, getMySponsoredSubmissions);
router.get('/stats/overview', getSponsoredPostStats);
router.get('/:id', getSponsoredSubmissionById);
// Public edit endpoints guarded by signed token will be added later if needed
router.put('/:id/status', adminActionLimiter, updateSponsoredSubmissionStatus);
router.post('/:id/publish', adminActionLimiter, publishSponsoredPost);

// Admin only routes
router.delete('/:id', requireAdmin, adminActionLimiter, deleteSponsoredSubmission);

export default router;
