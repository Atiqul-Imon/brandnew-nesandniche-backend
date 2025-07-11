import express from 'express';
import { 
  getBlogComments, 
  createComment, 
  updateComment, 
  deleteComment,
  toggleLike,
  toggleDislike
} from '../controller/comment.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissions.middleware.js';
import { commentLimiter } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Public routes
router.get('/blog/:blogId', getBlogComments);

// Protected routes
router.post('/', protect, commentLimiter, createComment);
router.put('/:id', protect, commentLimiter, updateComment);
router.delete('/:id', protect, commentLimiter, deleteComment);
router.post('/:id/like', protect, commentLimiter, toggleLike);
router.post('/:id/dislike', protect, commentLimiter, toggleDislike);

export default router; 