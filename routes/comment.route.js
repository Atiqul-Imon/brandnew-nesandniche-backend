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

const router = express.Router();

// Public routes
router.get('/blog/:blogId', getBlogComments);

// Protected routes
router.post('/', protect, createComment);
router.put('/:id', protect, updateComment);
router.delete('/:id', protect, deleteComment);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/dislike', protect, toggleDislike);

export default router; 