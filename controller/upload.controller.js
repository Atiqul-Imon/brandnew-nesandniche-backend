import cloudinary from '../config/cloudinary.js';
import logger from '../utils/logger.js';

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Convert buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'blog-images',
      resource_type: 'auto',
      transformation: [
        { width: 1200, height: 800, crop: 'fill', quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });

    logger.info('Image uploaded successfully', {
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

  } catch (error) {
    logger.error('Image upload failed', {
      error: error.message,
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