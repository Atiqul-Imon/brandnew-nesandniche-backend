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
  toggleBlogFeatured,
  approveBlog,
  rejectBlog,
  getBlogsByLanguage,
  getCategoriesWithCount,
  getTrendingBlogs,
  getHomepageData
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
import Blog from '../model/blog.model.js'; // Added import for Blog model
import { 
  blogActionLimiter, 
  adminActionLimiter 
} from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllBlogs);
router.get('/search', searchBlogs);
router.get('/recent', getRecentBlogs);
router.get('/popular', getPopularBlogs);
router.get('/category/:categorySlug', getBlogsByCategory);

// New homepage and trending routes
router.get('/:lang/homepage', getHomepageData);
router.get('/:lang/trending', getTrendingBlogs);
router.get('/:lang/featured', getFeaturedBlogs);
router.get('/:lang/category/:category', getBlogsByCategory);

router.get('/author/:authorId', getBlogsByAuthor);
router.get('/:lang/categories', getCategoriesWithCount);
router.get('/:lang/slug/:slug', getBlogBySlug);
router.get('/:lang', getBlogsByLanguage);
router.get('/:slug', getBlogBySlug);

// Get related posts for a specific blog
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 3, lang = 'en' } = req.query;

    // Find the current blog
    const currentBlog = await Blog.findById(id);
    if (!currentBlog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    // Get related posts based on category and tags
    const relatedQuery = {
      _id: { $ne: id }, // Exclude current blog
      status: 'published',
      [`title.${lang}`]: { $exists: true, $ne: '' }
    };

    // Add category filter if available
    if (currentBlog.category && currentBlog.category[lang]) {
      relatedQuery[`category.${lang}`] = currentBlog.category[lang];
    }

    // Add tags filter if available
    if (currentBlog.tags && currentBlog.tags.length > 0) {
      relatedQuery.tags = { $in: currentBlog.tags };
    }

    // Find related posts
    let relatedPosts = await Blog.find(relatedQuery)
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .populate('author', 'name avatar bio');

    // If not enough posts found, get posts from same category
    if (relatedPosts.length < parseInt(limit) && currentBlog.category && currentBlog.category[lang]) {
      const additionalPosts = await Blog.find({
        _id: { $ne: id },
        status: 'published',
        [`category.${lang}`]: currentBlog.category[lang],
        [`title.${lang}`]: { $exists: true, $ne: '' }
      })
        .sort({ publishedAt: -1 })
        .limit(parseInt(limit) - relatedPosts.length)
        .populate('author', 'name avatar bio');

      relatedPosts = [...relatedPosts, ...additionalPosts];
    }

    // If still not enough, get recent posts from same language
    if (relatedPosts.length < parseInt(limit)) {
      const recentPosts = await Blog.find({
        _id: { $ne: id },
        status: 'published',
        [`title.${lang}`]: { $exists: true, $ne: '' }
      })
        .sort({ publishedAt: -1 })
        .limit(parseInt(limit) - relatedPosts.length)
        .populate('author', 'name avatar bio');

      relatedPosts = [...relatedPosts, ...recentPosts];
    }

    // Remove duplicates
    const uniquePosts = relatedPosts.filter((post, index, self) => 
      index === self.findIndex(p => p._id.toString() === post._id.toString())
    );

    res.json({
      success: true,
      data: {
        relatedPosts: uniquePosts.slice(0, parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching related posts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch related posts' });
  }
});

// Protected routes - require editor or higher
router.post('/', protect, requireEditor, blogActionLimiter, upload.single('featuredImage'), createBlog);
router.get('/admin/:id', protect, requireEditor, getBlogById);
router.put('/:id', protect, canManageResource('blog'), blogActionLimiter, upload.single('featuredImage'), updateBlog);
router.delete('/:id', protect, canManageResource('blog'), blogActionLimiter, deleteBlog);

// Admin/Moderator only routes
router.put('/:id/status', protect, requireModerator, adminActionLimiter, toggleBlogStatus);
router.put('/:id/featured', protect, requireModerator, adminActionLimiter, toggleBlogFeatured);
router.put('/:id/approve', protect, requireModerator, adminActionLimiter, approveBlog);
router.put('/:id/reject', protect, requireModerator, adminActionLimiter, rejectBlog);

export default router; 