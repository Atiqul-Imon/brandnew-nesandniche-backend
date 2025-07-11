import express from 'express';
import { uploadImage, deleteImage } from '../controller/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Upload image (single file)
router.post('/image', protect, uploadLimiter, upload.single('image'), uploadImage);

// Delete image
router.delete('/image/:publicId', protect, uploadLimiter, deleteImage);

export default router; 