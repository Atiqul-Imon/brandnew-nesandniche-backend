import express from 'express';
import { uploadImage, deleteImage } from '../controller/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import upload from '../middleware/upload.middleware.js';

const router = express.Router();

// Upload image (single file)
router.post('/image', protect, upload.single('image'), uploadImage);

// Delete image
router.delete('/image/:publicId', protect, deleteImage);

export default router; 