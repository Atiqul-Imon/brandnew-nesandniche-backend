import cloudinary from '../config/cloudinary.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    logger.info('Upload request received', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId: req.user?.userId
    });

    // Check if Cloudinary is configured
    const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                                  process.env.CLOUDINARY_API_KEY && 
                                  process.env.CLOUDINARY_API_SECRET;

    logger.info('Cloudinary configuration check', {
      hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
      isConfigured: isCloudinaryConfigured
    });

    if (!isCloudinaryConfigured) {
      logger.error('Cloudinary not configured', {
        userId: req.user?.userId,
        missingVars: {
          cloudName: !process.env.CLOUDINARY_CLOUD_NAME,
          apiKey: !process.env.CLOUDINARY_API_KEY,
          apiSecret: !process.env.CLOUDINARY_API_SECRET
        }
      });

      return res.status(500).json({
        success: false,
        message: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
        error: 'CLOUDINARY_NOT_CONFIGURED'
      });
    }

    // Upload to Cloudinary
    try {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;

      logger.info('Attempting Cloudinary upload...');

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'blog-images',
        resource_type: 'auto',
        transformation: [
          { width: 1200, height: 800, crop: 'fill', quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      });

      logger.info('Image uploaded to Cloudinary successfully', {
        publicId: result.public_id,
        url: result.secure_url,
        userId: req.user?.userId
      });

      res.status(200).json({
        success: true,
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format
        }
      });
    } catch (cloudinaryError) {
      logger.error('Cloudinary upload failed', {
        error: cloudinaryError.message,
        userId: req.user?.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to upload image to Cloudinary',
        error: cloudinaryError.message
      });
    }

  } catch (error) {
    logger.error('Image upload failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    // Check if Cloudinary is configured
    const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                                  process.env.CLOUDINARY_API_KEY && 
                                  process.env.CLOUDINARY_API_SECRET;

    if (!isCloudinaryConfigured) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
        error: 'CLOUDINARY_NOT_CONFIGURED'
      });
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    logger.info('Image deleted successfully', {
      publicId,
      userId: req.user?.userId
    });

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: result
    });

  } catch (error) {
    logger.error('Image deletion failed', {
      error: error.message,
      publicId: req.params.publicId,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    });
  }
}; 