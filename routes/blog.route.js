import express from 'express';
import { 
  createBlog, 
  getAllBlogs, 
  getBlogBySlug, 
  getBlogById,
  updateBlog, 
  deleteBlog,
  getBlogsByCategory,
  searchBlogs,
  getBlogsByAuthor,
  getFeaturedBlogs,
  getRecentBlogs,
  getPopularBlogs,
  toggleBlogStatus,
  approveBlog,
  rejectBlog,
  getBlogsByLanguage,
  getCategoriesWithCount
} from '../controller/blog.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { 
  requireEditor, 
  requireModerator, 
  requireAdmin, 
  canManageResource,
  requirePermission 
} from '../middleware/permissions.middleware.js';
import upload from '../middleware/upload.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllBlogs);
router.get('/search', searchBlogs);
router.get('/featured', getFeaturedBlogs);
router.get('/recent', getRecentBlogs);
router.get('/popular', getPopularBlogs);
router.get('/category/:categorySlug', getBlogsByCategory);
router.get('/author/:authorId', getBlogsByAuthor);
router.get('/:lang/categories', getCategoriesWithCount);
router.get('/:lang/slug/:slug', getBlogBySlug);
router.get('/:lang', getBlogsByLanguage);
router.get('/:slug', getBlogBySlug);

// Protected routes - require editor or higher
router.post('/', protect, requireEditor, upload.single('featuredImage'), createBlog);
router.get('/admin/:id', protect, requireEditor, getBlogById);
router.put('/:id', protect, canManageResource('blog'), upload.single('featuredImage'), updateBlog);
router.delete('/:id', protect, canManageResource('blog'), deleteBlog);

// Admin/Moderator only routes
router.put('/:id/status', protect, requireModerator, toggleBlogStatus);
router.put('/:id/approve', protect, requireModerator, approveBlog);
router.put('/:id/reject', protect, requireModerator, rejectBlog);

export default router; 