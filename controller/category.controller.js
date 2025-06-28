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

  try {
    const category = await Category.create({
      ...req.body,
      createdBy: req.user.userId
    });

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

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      req.body,
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