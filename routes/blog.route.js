import express from 'express';
import { 
  createBlog, 
  getBlogsByLanguage, 
  getBlogBySlug, 
  updateBlog, 
  deleteBlog,
  getCategoriesWithCount
} from '../controller/blog.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateLanguage } from '../utils/errorHandler.js';

const router = express.Router();

// Public routes
router.get('/:lang', validateLanguage, getBlogsByLanguage);
router.get('/:lang/slug/:slug', validateLanguage, getBlogBySlug);
router.get('/:lang/categories', validateLanguage, getCategoriesWithCount);

// Protected routes
router.post('/', protect, createBlog);
router.put('/:id', protect, updateBlog);
router.delete('/:id', protect, deleteBlog);

export default router; 