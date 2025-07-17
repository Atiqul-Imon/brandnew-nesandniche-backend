import asyncHandler from 'express-async-handler';
import Category from '../model/category.model.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../utils/errorHandler.js';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang = 'en', active = true } = req.query;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    const query = {};
    if (active === 'true') {
      query.isActive = true;
    }

    const categories = await Category.find(query)
      .populate('createdBy', 'name')
      .sort({ sortOrder: 1, [`name.${lang}`]: 1 })
      .select(`name.${lang} slug.${lang} description.${lang} color icon isActive sortOrder createdBy`);

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'categories', duration, true);

    res.status(200).json({
      success: true,
      data: { categories }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'categories', duration, false);
    logger.error('Categories retrieval failed', { error: error.message });
    throw error;
  }
});

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
export const getCategory = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { lang = 'en' } = req.query;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    const category = await Category.findById(id)
      .populate('createdBy', 'name')
      .select(`name.${lang} slug.${lang} description.${lang} color icon isActive sortOrder createdBy`);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'categories', duration, true);

    res.status(200).json({
      success: true,
      data: { category }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'categories', duration, false);
    logger.error('Category retrieval failed', { error: error.message, categoryId: id });
    throw error;
  }
});

// @desc    Create category
// @route   POST /api/categories
// @access  Private (Admin/Editor)
export const createCategory = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  // Debug log for req.user
  console.log('DEBUG: req.user in createCategory:', req.user);

  try {
    // Remove empty language fields
    const data = { ...req.body };
    if (data.name) {
      if (!data.name.en || data.name.en.trim() === "") delete data.name.en;
      if (!data.name.bn || data.name.bn.trim() === "") delete data.name.bn;
    }
    if (data.slug) {
      if (!data.slug.en || data.slug.en.trim() === "") delete data.slug.en;
      if (!data.slug.bn || data.slug.bn.trim() === "") delete data.slug.bn;
    }
    if (data.description) {
      if (!data.description.en || data.description.en.trim() === "") delete data.description.en;
      if (!data.description.bn || data.description.bn.trim() === "") delete data.description.bn;
    }
    data.createdBy = req.user.userId;

    const category = await Category.create(data);

    const populatedCategory = await Category.findById(category._id)
      .populate('createdBy', 'name');

    const duration = Date.now() - startTime;
    logger.logDatabase('create', 'categories', duration, true);
    logger.info('Category created', { categoryId: category._id, userId: req.user.userId });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category: populatedCategory }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('create', 'categories', duration, false);
    logger.error('Category creation failed', { error: error.message, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin/Editor)
export const updateCategory = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    const category = await Category.findById(id);
    
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Remove empty language fields
    const data = { ...req.body };
    if (data.name) {
      if (!data.name.en || data.name.en.trim() === "") delete data.name.en;
      if (!data.name.bn || data.name.bn.trim() === "") delete data.name.bn;
    }
    if (data.slug) {
      if (!data.slug.en || data.slug.en.trim() === "") delete data.slug.en;
      if (!data.slug.bn || data.slug.bn.trim() === "") delete data.slug.bn;
    }
    if (data.description) {
      if (!data.description.en || data.description.en.trim() === "") delete data.description.en;
      if (!data.description.bn || data.description.bn.trim() === "") delete data.description.bn;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      data,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name');

    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'categories', duration, true);
    logger.info('Category updated', { categoryId: id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category: updatedCategory }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'categories', duration, false);
    logger.error('Category update failed', { error: error.message, categoryId: id, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
export const deleteCategory = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    const category = await Category.findById(id);
    
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if category has associated blogs
    const Blog = (await import('../model/blog.model.js')).default;
    const blogCount = await Blog.countDocuments({ 'category.en': category.name.en });

    if (blogCount > 0) {
      throw new ValidationError(`Cannot delete category. It has ${blogCount} associated blog(s).`);
    }

    await Category.findByIdAndDelete(id);
    
    const duration = Date.now() - startTime;
    logger.logDatabase('delete', 'categories', duration, true);
    logger.info('Category deleted', { categoryId: id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('delete', 'categories', duration, false);
    logger.error('Category deletion failed', { error: error.message, categoryId: id, userId: req.user?.userId });
    throw error;
  }
}); 

// @desc    Get all categories with blog counts
// @route   GET /api/categories/all/:lang
// @access  Public
export const getAllCategoriesWithCount = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang } = req.params;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    // Get all active categories
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, [`name.${lang}`]: 1 })
      .select(`name.${lang} slug.${lang} description.${lang} color icon isActive sortOrder`);

    // Get blog counts for each category
    const Blog = (await import('../model/blog.model.js')).default;
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const postCount = await Blog.countDocuments({
          status: 'published',
          publishedAt: { $lte: new Date() },
          [`category.${lang}`]: category.name[lang]
        });

        return {
          name: category.name[lang],
          slug: category.slug[lang],
          postCount,
          color: category.color,
          icon: category.icon
        };
      })
    );

    // Sort by post count (descending) then by name
    categoriesWithCounts.sort((a, b) => {
      if (b.postCount !== a.postCount) {
        return b.postCount - a.postCount;
      }
      return a.name.localeCompare(b.name);
    });

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'categories', duration, true);

    res.status(200).json({
      success: true,
      data: { categories: categoriesWithCounts }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'categories', duration, false);
    logger.error('All categories with count retrieval failed', { error: error.message, language: lang });
    throw error;
  }
}); 

// @desc    Get categories with blog counts for homepage
// @route   GET /api/categories/:lang/with-counts
// @access  Public
export const getCategoriesWithCounts = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang } = req.params;
  const { limit = 8 } = req.query;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    // Get active categories
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, [`name.${lang}`]: 1 })
      .limit(parseInt(limit))
      .select(`name.${lang} slug.${lang} description.${lang} color icon isActive sortOrder`);

    // Import Blog model for counting
    const Blog = (await import('../model/blog.model.js')).default;

    // Get blog counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const blogCount = await Blog.countDocuments({
          status: 'published',
          publishedAt: { $lte: new Date() },
          [`category.${lang}`]: category.name[lang],
          [`title.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`content.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`excerpt.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`slug.${lang}`]: { $exists: true, $ne: null, $ne: '' }
        });

        return {
          ...category.toObject(),
          blogCount
        };
      })
    );

    // Filter out categories with 0 blogs and sort by blog count
    const activeCategories = categoriesWithCounts
      .filter(cat => cat.blogCount > 0)
      .sort((a, b) => b.blogCount - a.blogCount);

    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'categories', duration, true);

    res.status(200).json({
      success: true,
      data: { categories: activeCategories }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'categories', duration, false);
    logger.error('Categories with counts retrieval failed', { error: error.message, language: lang });
    throw error;
  }
});

// @desc    Get category highlights with sample posts
// @route   GET /api/categories/:lang/highlights
// @access  Public
export const getCategoryHighlights = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang } = req.params;
  const { limit = 4, postsPerCategory = 3 } = req.query;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    // Get top categories by blog count
    const Blog = (await import('../model/blog.model.js')).default;

    // Aggregate to get categories with blog counts
    const categoryStats = await Blog.aggregate([
      {
        $match: {
          status: 'published',
          publishedAt: { $lte: new Date() },
          [`title.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`content.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`excerpt.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`slug.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`category.${lang}`]: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: `$category.${lang}`,
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    // Get category details and sample posts
    const highlights = await Promise.all(
      categoryStats.map(async (stat) => {
        const category = await Category.findOne({
          isActive: true,
          [`name.${lang}`]: stat._id
        }).select(`name.${lang} slug.${lang} description.${lang} color icon`);

        if (!category) return null;

        // Get sample posts for this category
        const posts = await Blog.find({
          status: 'published',
          publishedAt: { $lte: new Date() },
          [`category.${lang}`]: stat._id,
          [`title.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`content.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`excerpt.${lang}`]: { $exists: true, $ne: null, $ne: '' },
          [`slug.${lang}`]: { $exists: true, $ne: null, $ne: '' }
        })
        .populate('author', 'name')
        .sort({ publishedAt: -1 })
        .limit(parseInt(postsPerCategory))
        .select(`title.${lang} content.${lang} excerpt.${lang} slug.${lang} category.${lang} featuredImage publishedAt readTime.${lang} viewCount author`);

        return {
          category: category.toObject(),
          posts,
          totalPosts: stat.count
        };
      })
    );

    // Filter out null results
    const validHighlights = highlights.filter(h => h !== null);

    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'categories', duration, true);

    res.status(200).json({
      success: true,
      data: { highlights: validHighlights }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'categories', duration, false);
    logger.error('Category highlights retrieval failed', { error: error.message, language: lang });
    throw error;
  }
}); 