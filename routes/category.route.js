import express from 'express';
import { 
  getCategories, 
  getCategory, 
  createCategory, 
  updateCategory, 
  deleteCategory 
} from '../controller/category.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { requirePermission, requireRole } from '../middleware/permissions.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getCategories);
router.get('/:id', getCategory);

// Protected routes
router.post('/', protect, requirePermission('manage_categories'), createCategory);
router.put('/:id', protect, requirePermission('manage_categories'), updateCategory);
router.delete('/:id', protect, requireRole('admin'), deleteCategory);

export default router; 