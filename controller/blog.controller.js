import mongoose from 'mongoose';
import Blog from '../model/blog.model.js';
import User from '../model/user.model.js';
import { asyncHandler, NotFoundError, AuthorizationError, ValidationError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { generateSlug, generateUniqueSlug } from '../utils/slugGenerator.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Create a new blog post
// @route   POST /api/blogs
// @access  Private (Admin/Editor)
export const createBlog = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    let { title, content, excerpt, slug, category, tags, featuredImage, status, seoTitle, seoDescription, seoKeywords, author } = req.body;

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

    // Handle author information
    let authorData = {
      user: req.user.userId, // Default to current user
      name: req.user.name || 'Anonymous' // Default to current user's name
    };

    // If custom author data is provided, use it
    if (author && typeof author === 'object') {
      if (author.name && author.name.trim()) {
        authorData.name = author.name.trim();
      }
      if (author.email && author.email.trim()) {
        authorData.email = author.email.trim();
      }
      if (author.bio && author.bio.trim()) {
        authorData.bio = author.bio.trim();
      }
      if (author.avatar && author.avatar.trim()) {
        authorData.avatar = author.avatar.trim();
      }
      if (author.website && author.website.trim()) {
        authorData.website = author.website.trim();
      }
      if (author.social && typeof author.social === 'object') {
        authorData.social = {};
        if (author.social.twitter) authorData.social.twitter = author.social.twitter.trim();
        if (author.social.linkedin) authorData.social.linkedin = author.social.linkedin.trim();
        if (author.social.github) authorData.social.github = author.social.github.trim();
      }
      
      // If custom author name is provided and different from current user, remove user reference
      if (author.name && author.name.trim() !== req.user.name) {
        authorData.user = null; // This is a custom author, not a registered user
      }
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

    // Remove empty slug fields
    if (slug && (!slug.en || slug.en.trim() === '')) delete slug.en;
    if (slug && (!slug.bn || slug.bn.trim() === '')) delete slug.bn;

    // Calculate read time (rough estimate: 200 words per minute)
    const readTimeEn = content?.en ? Math.ceil(content.en.split(' ').length / 200) : null;
    const readTimeBn = content?.bn ? Math.ceil(content.bn.split(' ').length / 200) : null;

    // --- Robust publishedAt logic ---
    let publishedAt = req.body.publishedAt;
    if (status === 'published' && !publishedAt) {
      publishedAt = new Date();
    }

    const blogData = {
      title,
      content,
      excerpt,
      slug,
      category,
      tags: tagsArray,
      featuredImage,
      status: status || 'draft',
      author: authorData,
      readTime: {
        en: readTimeEn,
        bn: readTimeBn
      },
      seoTitle,
      seoDescription,
      seoKeywords,
      publishedAt
    };

    const blog = await Blog.create(blogData);
    
    const duration = Date.now() - startTime;
    logger.logDatabase('create', 'blogs', duration, true);
    logger.info('Blog post created', { blogId: blog._id, author: authorData.name });

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
      if (mongoose.Types.ObjectId.isValid(exclude)) {
        query._id = { $ne: exclude };
      } else {
        console.warn('Invalid ObjectId format for exclude parameter:', exclude);
      }
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

// @desc    Get single blog post by ID (Admin)
// @route   GET /api/blogs/admin/:id
// @access  Private (Admin/Editor/Owner)
export const getBlogById = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    const blog = await Blog.findById(id)
      .populate('author', 'name email');

    if (!blog) {
      throw new NotFoundError('Blog post not found');
    }

    // Check permissions - handle both old and new author structure
    let isOwner = false;
    if (blog.author && typeof blog.author === 'object' && blog.author.user) {
      isOwner = blog.author.user.toString() === req.user.userId;
    } else if (blog.author) {
      isOwner = blog.author.toString() === req.user.userId;
    }
    
    const isAdmin = req.user.role === 'admin';
    const isEditor = req.user.role === 'editor';

    if (!isOwner && !isAdmin && !isEditor) {
      throw new AuthorizationError('You do not have permission to view this blog post');
    }
    
    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'blogs', duration, true);
    logger.info('Blog post retrieved for admin', { blogId: blog._id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      data: { blog }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('read', 'blogs', duration, false);
    logger.error('Blog retrieval failed', { error: error.message, blogId: id, userId: req.user?.userId });
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
    .populate('author.user', 'name email');



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

    // Check permissions - handle both old and new author structure
    let isOwner = false;
    if (blog.author && typeof blog.author === 'object' && blog.author.user) {
      isOwner = blog.author.user.toString() === req.user.userId;
    } else if (blog.author) {
      isOwner = blog.author.toString() === req.user.userId;
    }
    
    const isAdmin = req.user.role === 'admin';
    const isEditor = req.user.role === 'editor';

    if (!isOwner && !isAdmin && !isEditor) {
      throw new AuthorizationError('You do not have permission to update this blog post');
    }

    // Handle author information update
    if (req.body.author && typeof req.body.author === 'object') {
      const authorData = { ...blog.author };
      
      if (req.body.author.name && req.body.author.name.trim()) {
        authorData.name = req.body.author.name.trim();
      }
      if (req.body.author.email && req.body.author.email.trim()) {
        authorData.email = req.body.author.email.trim();
      }
      if (req.body.author.bio && req.body.author.bio.trim()) {
        authorData.bio = req.body.author.bio.trim();
      }
      if (req.body.author.avatar && req.body.author.avatar.trim()) {
        authorData.avatar = req.body.author.avatar.trim();
      }
      if (req.body.author.website && req.body.author.website.trim()) {
        authorData.website = req.body.author.website.trim();
      }
      if (req.body.author.social && typeof req.body.author.social === 'object') {
        authorData.social = { ...authorData.social };
        if (req.body.author.social.twitter) authorData.social.twitter = req.body.author.social.twitter.trim();
        if (req.body.author.social.linkedin) authorData.social.linkedin = req.body.author.social.linkedin.trim();
        if (req.body.author.social.github) authorData.social.github = req.body.author.social.github.trim();
      }
      
      // If custom author name is provided and different from current user, remove user reference
      if (req.body.author.name && req.body.author.name.trim() !== req.user.name) {
        authorData.user = null; // This is a custom author, not a registered user
      } else if (!authorData.user) {
        authorData.user = req.user.userId; // Restore user reference if name matches current user
      }
      
      req.body.author = authorData;
    }

    // Handle slug updates - only validate if slug is actually changing
    if (req.body.slug) {
      const currentSlugs = blog.slug || { en: '', bn: '' };
      const newSlugs = req.body.slug;
      
      // Only check uniqueness if the slug is actually different
      if (newSlugs.en && newSlugs.en !== currentSlugs.en) {
        const existingEnSlug = await Blog.findOne({ 
          _id: { $ne: id }, 
          'slug.en': newSlugs.en 
        });
        if (existingEnSlug) {
          throw new ValidationError('English slug already exists');
        }
      }
      
      if (newSlugs.bn && newSlugs.bn !== currentSlugs.bn) {
        const existingBnSlug = await Blog.findOne({ 
          _id: { $ne: id }, 
          'slug.bn': newSlugs.bn 
        });
        if (existingBnSlug) {
          throw new ValidationError('Bangla slug already exists');
        }
      }
      
      // Keep the new slugs or existing ones if not provided
      req.body.slug = {
        en: newSlugs.en || currentSlugs.en,
        bn: newSlugs.bn || currentSlugs.bn
      };
    }

    // Calculate read time if content is updated
    if (req.body.content) {
      const readTimeEn = req.body.content.en && typeof req.body.content.en === 'string'
        ? Math.ceil(req.body.content.en.split(' ').length / 200)
        : null;
      const readTimeBn = req.body.content.bn && typeof req.body.content.bn === 'string'
        ? Math.ceil(req.body.content.bn.split(' ').length / 200)
        : null;
      req.body.readTime = { en: readTimeEn, bn: readTimeBn };
    }

    // --- Robust publishedAt logic for update ---
    if (
      req.body.status === 'published' &&
      blog.status !== 'published' &&
      !req.body.publishedAt
    ) {
      req.body.publishedAt = new Date();
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('author.user', 'name');

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

    // Check permissions - handle both old and new author structure
    let isOwner = false;
    if (blog.author && typeof blog.author === 'object' && blog.author.user) {
      isOwner = blog.author.user.toString() === req.user.userId;
    } else if (blog.author) {
      isOwner = blog.author.toString() === req.user.userId;
    }
    
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

// Create a new draft
export const createDraft = async (req, res) => {
  try {
    const draft = new Blog({
      ...req.body,
      draft: true,
      draftOwner: req.user._id,
      status: 'draft',
    });
    await draft.save();
    res.status(201).json({ success: true, data: { draftId: draft._id, draft } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update an existing draft
export const updateDraft = async (req, res) => {
  try {
    const draft = await Blog.findOne({ _id: req.params.id, draft: true, draftOwner: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    Object.assign(draft, req.body);
    await draft.save();
    res.json({ success: true, data: { draft } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get a draft by ID
export const getDraft = async (req, res) => {
  try {
    const draft = await Blog.findOne({ _id: req.params.id, draft: true, draftOwner: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, data: { draft } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// List all drafts for the user
export const listDrafts = async (req, res) => {
  try {
    const drafts = await Blog.find({ draft: true, draftOwner: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, data: { drafts } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Approve a blog post (Moderator/Admin only)
// @route   PUT /api/blogs/:id/approve
// @access  Private (Moderator/Admin)
export const approveBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const blog = await Blog.findById(id);
  if (!blog) {
    throw new NotFoundError('Blog not found');
  }

  // Check if blog is already approved
  if (blog.status === 'published') {
    return res.status(400).json({
      success: false,
      message: 'Blog is already published'
    });
  }

  // Update blog status to published
  blog.status = 'published';
  blog.publishedAt = new Date();
  blog.approvedBy = req.user.userId;
  blog.approvedAt = new Date();
  
  await blog.save();

  logger.info('Blog approved', { 
    blogId: blog._id, 
    approvedBy: req.user.userId,
    title: blog.title?.en || blog.title?.bn 
  });

  res.status(200).json({
    success: true,
    message: 'Blog approved and published successfully',
    data: { blog }
  });
});

// @desc    Reject a blog post (Moderator/Admin only)
// @route   PUT /api/blogs/:id/reject
// @access  Private (Moderator/Admin)
export const rejectBlog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const blog = await Blog.findById(id);
  if (!blog) {
    throw new NotFoundError('Blog not found');
  }

  // Check if blog is already rejected
  if (blog.status === 'rejected') {
    return res.status(400).json({
      success: false,
      message: 'Blog is already rejected'
    });
  }

  // Update blog status to rejected
  blog.status = 'rejected';
  blog.rejectedBy = req.user.userId;
  blog.rejectedAt = new Date();
  blog.rejectionReason = reason || 'No reason provided';
  
  await blog.save();

  logger.info('Blog rejected', { 
    blogId: blog._id, 
    rejectedBy: req.user.userId,
    reason: reason,
    title: blog.title?.en || blog.title?.bn 
  });

  res.status(200).json({
    success: true,
    message: 'Blog rejected successfully',
    data: { blog }
  });
});

// @desc    Toggle blog status (Moderator/Admin only)
// @route   PUT /api/blogs/:id/status
// @access  Private (Moderator/Admin)
export const toggleBlogStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const validStatuses = ['draft', 'published', 'archived', 'rejected'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError('Invalid status. Must be one of: draft, published, archived, rejected');
  }
  
  const blog = await Blog.findById(id);
  if (!blog) {
    throw new NotFoundError('Blog not found');
  }

  const oldStatus = blog.status;
  blog.status = status;
  
  // Set publishedAt if publishing
  if (status === 'published' && oldStatus !== 'published') {
    blog.publishedAt = new Date();
    blog.approvedBy = req.user.userId;
    blog.approvedAt = new Date();
  }
  
  // Clear approval/rejection data if changing from published/rejected
  if (status !== 'published' && oldStatus === 'published') {
    blog.approvedBy = undefined;
    blog.approvedAt = undefined;
  }
  
  if (status !== 'rejected' && oldStatus === 'rejected') {
    blog.rejectedBy = undefined;
    blog.rejectedAt = undefined;
    blog.rejectionReason = undefined;
  }
  
  await blog.save();

  logger.info('Blog status changed', { 
    blogId: blog._id, 
    changedBy: req.user.userId,
    oldStatus,
    newStatus: status,
    title: blog.title?.en || blog.title?.bn 
  });

  res.status(200).json({
    success: true,
    message: `Blog status changed from ${oldStatus} to ${status}`,
    data: { blog }
  });
});

// @desc    Get all blogs with filtering and pagination
// @route   GET /api/blogs
// @access  Public
export const getAllBlogs = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'published',
      language = req.query.lang || req.query.language || 'en',
      category,
      author,
      sort = 'publishedAt',
      order = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    let query = {};
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Language filter
    if (language) {
      query[`title.${language}`] = { $exists: true, $ne: null, $ne: '' };
      query[`content.${language}`] = { $exists: true, $ne: null, $ne: '' };
      query[`excerpt.${language}`] = { $exists: true, $ne: null, $ne: '' };
      query[`slug.${language}`] = { $exists: true, $ne: null, $ne: '' };
      query[`category.${language}`] = { $exists: true, $ne: null, $ne: '' };
    }
    
    // Author filter
    if (author) {
      query['author.user'] = author;
    }

    // Build sort object
    let sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;
    sortObj['createdAt'] = -1; // Secondary sort

    const blogs = await Blog.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author.user', 'name username profileImage');

    const total = await Blog.countDocuments(query);

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, false);
    logger.error('Blogs retrieval failed', { error: error.message });
    throw error;
  }
});

// @desc    Search blogs
// @route   GET /api/blogs/search
// @access  Public
export const searchBlogs = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      q, 
      page = 1, 
      limit = 10, 
      language = 'en',
      status = 'published'
    } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build search query
    const searchQuery = {
      status: status,
      $or: [
        { [`title.${language}`]: { $regex: q, $options: 'i' } },
        { [`content.${language}`]: { $regex: q, $options: 'i' } },
        { [`excerpt.${language}`]: { $regex: q, $options: 'i' } },
        { [`category.${language}`]: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };

    const blogs = await Blog.find(searchQuery)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author.user', 'name username profileImage');

    const total = await Blog.countDocuments(searchQuery);

    const duration = Date.now() - startTime;
    logger.logDatabase('search', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('search', 'blogs', duration, false);
    logger.error('Blog search failed', { error: error.message });
    throw error;
  }
});

// @desc    Get blogs by category
// @route   GET /api/blogs/category/:categorySlug
// @access  Public
export const getBlogsByCategory = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { categorySlug } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      language = 'en',
      status = 'published'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {
      status: status,
      [`category.${language}`]: categorySlug
    };

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author.user', 'name username profileImage');

    const total = await Blog.countDocuments(query);

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, false);
    logger.error('Category blogs retrieval failed', { error: error.message });
    throw error;
  }
});

// @desc    Get blogs by author
// @route   GET /api/blogs/author/:authorId
// @access  Public
export const getBlogsByAuthor = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { authorId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      status = 'published'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = {
      status: status,
      'author.user': authorId
    };

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author.user', 'name username profileImage');

    const total = await Blog.countDocuments(query);

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, false);
    logger.error('Author blogs retrieval failed', { error: error.message });
    throw error;
  }
});

// @desc    Get recent blogs
// @route   GET /api/blogs/recent
// @access  Public
export const getRecentBlogs = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { limit = 5, language = 'en' } = req.query;
    
    const query = {
      status: 'published',
      [`title.${language}`]: { $exists: true, $ne: null }
    };

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .populate('author.user', 'name username profileImage');

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: { blogs }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, false);
    logger.error('Recent blogs retrieval failed', { error: error.message });
    throw error;
  }
});

// @desc    Get popular blogs
// @route   GET /api/blogs/popular
// @access  Public
export const getPopularBlogs = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { limit = 5, language = 'en', period = '7d' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    const query = {
      status: 'published',
      publishedAt: { $gte: startDate },
      [`title.${language}`]: { $exists: true, $ne: null }
    };

    const blogs = await Blog.find(query)
      .sort({ viewCount: -1, publishedAt: -1 })
      .limit(parseInt(limit))
      .populate('author.user', 'name username profileImage');

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, true);

    res.status(200).json({
      success: true,
      data: { blogs }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'blogs', duration, false);
    logger.error('Popular blogs retrieval failed', { error: error.message });
    throw error;
  }
}); 