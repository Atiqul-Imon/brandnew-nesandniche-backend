import Blog from '../model/blog.model.js';
import User from '../model/user.model.js';
import { asyncHandler, NotFoundError, AuthorizationError, ValidationError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { generateSlug, generateUniqueSlug } from '../utils/slugGenerator.js';

// @desc    Create a new blog post
// @route   POST /api/blogs
// @access  Private (Admin/Editor)
export const createBlog = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    let { title, content, excerpt, slug, category, tags, featuredImage, status, seoTitle, seoDescription, seoKeywords } = req.body;

    // Sanitize: Remove all fields for a language if all its fields are empty or falsy
    const isEmptyLang = (obj) => !obj || Object.values(obj).every(val => !val || (typeof val === 'string' && val.trim() === ''));
    if (isEmptyLang(title?.en) && isEmptyLang(content?.en) && isEmptyLang(excerpt?.en) && isEmptyLang(slug?.en) && isEmptyLang(category?.en)) {
      if (title) delete title.en;
      if (content) delete content.en;
      if (excerpt) delete excerpt.en;
      if (slug) delete slug.en;
      if (category) delete category.en;
      if (seoTitle) delete seoTitle.en;
      if (seoDescription) delete seoDescription.en;
      if (seoKeywords) delete seoKeywords.en;
    }
    if (isEmptyLang(title?.bn) && isEmptyLang(content?.bn) && isEmptyLang(excerpt?.bn) && isEmptyLang(slug?.bn) && isEmptyLang(category?.bn)) {
      if (title) delete title.bn;
      if (content) delete content.bn;
      if (excerpt) delete excerpt.bn;
      if (slug) delete slug.bn;
      if (category) delete category.bn;
      if (seoTitle) delete seoTitle.bn;
      if (seoDescription) delete seoDescription.bn;
      if (seoKeywords) delete seoKeywords.bn;
    }

    // Validate that at least one language is provided
    const hasEnglish = title?.en && content?.en && excerpt?.en && slug?.en && category?.en;
    const hasBengali = title?.bn && content?.bn && excerpt?.bn && slug?.bn && category?.bn;

    if (!hasEnglish && !hasBengali) {
      throw new ValidationError('At least one language (English or Bengali) must be provided with all required fields');
    }

    // If a language is partially provided, make sure all required fields for that language are complete
    if (title?.en || content?.en || excerpt?.en || slug?.en || category?.en) {
      if (!hasEnglish) {
        throw new ValidationError('If providing English content, all English fields (title, content, excerpt, slug, category) are required');
      }
      if (content?.en && content.en.length < 50) {
        throw new ValidationError('English content must be at least 50 characters long');
      }
    }

    // Only run Bengali validation if at least one Bengali field is truly non-empty (not just empty string/whitespace/null/undefined)
    const anyBengaliProvided = [title?.bn, content?.bn, excerpt?.bn, slug?.bn, category?.bn]
      .some(val => val && typeof val === 'string' && val.trim().length > 0);

    if (anyBengaliProvided) {
      if (!hasBengali) {
        throw new ValidationError('If providing Bengali content, all Bengali fields (title, content, excerpt, slug, category) are required');
      }
      if (content?.bn && typeof content.bn === 'string' && content.bn.trim().length > 0 && content.bn.length < 50) {
        throw new ValidationError('Bangla content must be at least 50 characters long');
      }
    }

    if (!featuredImage) {
      throw new ValidationError('Featured image is required');
    }

    // Ensure tags is always an array
    let tagsArray = tags;
    if (!Array.isArray(tagsArray)) {
      tagsArray = typeof tagsArray === 'string' ? [tagsArray] : [];
    }

    // Check if user has permission to create posts
    if (!['admin', 'editor'].includes(req.user.role)) {
      throw new AuthorizationError('You do not have permission to create blog posts');
    }

    // Auto-generate slugs from titles if not provided
    if (!slug) slug = {};
    
    // Generate English slug if title exists but slug doesn't
    if (title?.en && !slug.en) {
      const baseSlug = generateSlug(title.en, 'en');
      const checkExists = async (slugToCheck) => {
        const existing = await Blog.findOne({ 'slug.en': slugToCheck });
        return !!existing;
      };
      slug.en = await generateUniqueSlug(baseSlug, checkExists);
    }
    
    // Generate Bangla slug if title exists but slug doesn't
    if (title?.bn && !slug.bn) {
      const baseSlug = generateSlug(title.bn, 'bn');
      const checkExists = async (slugToCheck) => {
        const existing = await Blog.findOne({ 'slug.bn': slugToCheck });
        return !!existing;
      };
      slug.bn = await generateUniqueSlug(baseSlug, checkExists);
    }

    // Check if slugs already exist (only for provided languages)
    const slugQueries = [];
    if (slug?.en) slugQueries.push({ 'slug.en': slug.en });
    if (slug?.bn) slugQueries.push({ 'slug.bn': slug.bn });

    if (slugQueries.length > 0) {
      const existingSlugs = await Blog.find({
        $or: slugQueries
      });

      if (existingSlugs.length > 0) {
        throw new ValidationError('Slug already exists for one or both languages');
      }
    }

    // Calculate read time (rough estimate: 200 words per minute)
    const readTimeEn = content?.en ? Math.ceil(content.en.split(' ').length / 200) : null;
    const readTimeBn = content?.bn ? Math.ceil(content.bn.split(' ').length / 200) : null;

    const blogData = {
      title,
      content,
      excerpt,
      slug,
      category,
      tags: tagsArray,
      featuredImage,
      status: status || 'draft',
      author: req.user.userId,
      readTime: {
        en: readTimeEn,
        bn: readTimeBn
      },
      seoTitle,
      seoDescription,
      seoKeywords
    };

    const blog = await Blog.create(blogData);
    
    const duration = Date.now() - startTime;
    logger.logDatabase('create', 'blogs', duration, true);
    logger.info('Blog post created', { blogId: blog._id, author: req.user.userId });

    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: { blog }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('create', 'blogs', duration, false);
    logger.error('Blog creation failed', { error: error.message, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Get blogs by language with search and filtering
// @route   GET /api/blogs/:lang
// @access  Public
export const getBlogsByLanguage = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang } = req.params;
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    category = '', 
    status = 'published',
    sortBy = 'publishedAt',
    sortOrder = 'desc',
    featured = false,
    exclude = ''
  } = req.query;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    // Build query
    const query = {};
    
    // Status filter
    if (status === 'all') {
      // Don't filter by status
    } else {
      query.status = status;
      if (status === 'published') {
        query.publishedAt = { $lte: new Date() };
      }
    }

    // Featured filter
    if (featured === 'true' || featured === true) {
      query.isFeatured = true;
    }

    // Language-specific filters - only show blogs that have content in the requested language
    query[`title.${lang}`] = { $exists: true, $ne: null, $ne: '' };
    query[`content.${lang}`] = { $exists: true, $ne: null, $ne: '' };
    query[`excerpt.${lang}`] = { $exists: true, $ne: null, $ne: '' };
    query[`slug.${lang}`] = { $exists: true, $ne: null, $ne: '' };
    query[`category.${lang}`] = { $exists: true, $ne: null, $ne: '' };

    // Category filter
    if (category) {
      query[`category.${lang}`] = { $regex: category, $options: 'i' };
    }

    // Exclude specific blog
    if (exclude) {
      query._id = { $ne: exclude };
    }

    // Search filter
    if (search) {
      query.$or = [
        { [`title.${lang}`]: { $regex: search, $options: 'i' } },
        { [`content.${lang}`]: { $regex: search, $options: 'i' } },
        { [`excerpt.${lang}`]: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const blogs = await Blog.find(query)
      .populate('author', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select(`title.${lang} content.${lang} excerpt.${lang} slug.${lang} category.${lang} featuredImage publishedAt readTime.${lang} viewCount author status isFeatured`);

    // Get total count for pagination
    const total = await Blog.countDocuments(query);

    // Check if there are more pages
    const hasMore = skip + blogs.length < total;

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: {
        blogs,
        total,
        hasMore,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, false);
    logger.error('Blogs retrieval failed', { error: error.message, language: lang });
    throw error;
  }
});

// @desc    Get featured blog posts by language
// @route   GET /api/blogs/:lang/featured
// @access  Public
export const getFeaturedBlogs = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang } = req.params;
  const { limit = 5 } = req.query;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    const blogs = await Blog.getFeaturedByLanguage(lang, parseInt(limit));
    
    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: { blogs }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'blogs', duration, false);
    logger.error('Featured blogs retrieval failed', { error: error.message, language: lang });
    throw error;
  }
});

// @desc    Get single blog post by slug and language
// @route   GET /api/blogs/:lang/:slug
// @access  Public
export const getBlogBySlug = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang, slug } = req.params;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    const blog = await Blog.findOne({
      [`slug.${lang}`]: slug,
      status: 'published',
      publishedAt: { $lte: new Date() },
      [`title.${lang}`]: { $exists: true, $ne: null, $ne: '' },
      [`content.${lang}`]: { $exists: true, $ne: null, $ne: '' },
      [`excerpt.${lang}`]: { $exists: true, $ne: null, $ne: '' },
      [`category.${lang}`]: { $exists: true, $ne: null, $ne: '' }
    })
    .select(`title.${lang} content.${lang} excerpt.${lang} slug.${lang} category.${lang} featuredImage publishedAt readTime.${lang} viewCount author tags.${lang} seoTitle.${lang} seoDescription.${lang} seoKeywords.${lang}`)
    .populate('author', 'name email');

    if (!blog) {
      throw new NotFoundError('Blog post not found');
    }

    // Increment view count
    await blog.incrementViewCount();
    
    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'blogs', duration, true);
    logger.info('Blog post viewed', { blogId: blog._id, slug, language: lang });

    res.status(200).json({
      success: true,
      data: { blog }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'blogs', duration, false);
    logger.error('Blog retrieval failed', { error: error.message, slug, language: lang });
    throw error;
  }
});

// @desc    Update blog post
// @route   PUT /api/blogs/:id
// @access  Private (Admin/Editor/Owner)
export const updateBlog = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    const blog = await Blog.findById(id);
    
    if (!blog) {
      throw new NotFoundError('Blog post not found');
    }

    // Check permissions
    const isOwner = blog.author.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    const isEditor = req.user.role === 'editor';

    if (!isOwner && !isAdmin && !isEditor) {
      throw new AuthorizationError('You do not have permission to update this blog post');
    }

    // Check slug uniqueness if slug is being updated
    if (req.body.slug) {
      const existingSlugs = await Blog.find({
        _id: { $ne: id },
        $or: [
          { 'slug.en': req.body.slug.en },
          { 'slug.bn': req.body.slug.bn }
        ]
      });

      if (existingSlugs.length > 0) {
        throw new ValidationError('Slug already exists for one or both languages');
      }
    }

    // Calculate read time if content is updated
    if (req.body.content) {
      const readTimeEn = Math.ceil(req.body.content.en.split(' ').length / 200);
      const readTimeBn = Math.ceil(req.body.content.bn.split(' ').length / 200);
      req.body.readTime = { en: readTimeEn, bn: readTimeBn };
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('author', 'name');

    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'blogs', duration, true);
    logger.info('Blog post updated', { blogId: id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      message: 'Blog post updated successfully',
      data: { blog: updatedBlog }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'blogs', duration, false);
    logger.error('Blog update failed', { error: error.message, blogId: id, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Delete blog post
// @route   DELETE /api/blogs/:id
// @access  Private (Admin/Owner)
export const deleteBlog = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    const blog = await Blog.findById(id);
    
    if (!blog) {
      throw new NotFoundError('Blog post not found');
    }

    // Check permissions
    const isOwner = blog.author.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('You do not have permission to delete this blog post');
    }

    await Blog.findByIdAndDelete(id);
    
    const duration = Date.now() - startTime;
    logger.logDatabase('delete', 'blogs', duration, true);
    logger.info('Blog post deleted', { blogId: id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      message: 'Blog post deleted successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('delete', 'blogs', duration, false);
    logger.error('Blog deletion failed', { error: error.message, blogId: id, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Get blog categories by language
// @route   GET /api/blogs/:lang/categories
// @access  Public
export const getCategories = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang } = req.params;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    const categories = await Blog.aggregate([
      {
        $match: {
          status: 'published',
          publishedAt: { $lte: new Date() }
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
      }
    ]);

    const duration = Date.now() - startTime;
    logger.logDatabase('aggregate', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: { categories }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('aggregate', 'blogs', duration, false);
    logger.error('Categories retrieval failed', { error: error.message, language: lang });
    throw error;
  }
});

// @desc    Get categories with post counts by language
// @route   GET /api/blogs/:lang/categories
// @access  Public
export const getCategoriesWithCount = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { lang } = req.params;

  try {
    if (!['en', 'bn'].includes(lang)) {
      throw new ValidationError('Invalid language parameter. Use "en" or "bn"');
    }

    // Aggregate to get categories with post counts
    const categories = await Blog.aggregate([
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
          postCount: { $sum: 1 },
          slug: { $first: `$category.${lang}` }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          slug: '$slug',
          postCount: 1
        }
      },
      {
        $sort: { postCount: -1, name: 1 }
      }
    ]);

    const duration = Date.now() - startTime;
    logger.logDatabase('aggregate', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: { categories }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('aggregate', 'blogs', duration, false);
    logger.error('Categories with count retrieval failed', { error: error.message, language: lang });
    throw error;
  }
}); 