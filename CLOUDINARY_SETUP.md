# Cloudinary Setup Guide

This guide will help you set up Cloudinary for image uploads in your blog application.

## Why Cloudinary?

Cloudinary provides:
- **Cloud storage** - No files stored on your server
- **Image optimization** - Automatic resizing and format conversion
- **CDN delivery** - Fast image loading worldwide
- **Transformations** - On-the-fly image modifications
- **Free tier** - 25GB storage and 25GB bandwidth per month

## Step 1: Create a Cloudinary Account

1. Go to [Cloudinary.com](https://cloudinary.com)
2. Click "Sign Up" and create a free account
3. Verify your email address

## Step 2: Get Your Cloudinary Credentials

1. Log in to your Cloudinary dashboard
2. Go to the "Dashboard" section
3. Copy your credentials:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

## Step 3: Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your Cloudinary credentials:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

## Step 4: Test the Configuration

1. Start your backend server:
   ```bash
   npm start
   ```

2. Try uploading an image through the blog creation form
3. Check the server logs to confirm Cloudinary upload success

## Step 5: Verify Upload

After uploading an image:
1. Check the response URL - it should start with `https://res.cloudinary.com/`
2. Visit the URL to confirm the image is accessible
3. Check your Cloudinary dashboard to see the uploaded image

## Troubleshooting

### "Cloudinary is not configured" Error
- Make sure all three environment variables are set
- Restart your server after changing environment variables
- Check that the `.env` file is in the backend directory

### Upload Fails
- Verify your Cloudinary credentials are correct
- Check your Cloudinary account limits
- Ensure the image file is valid (JPEG, PNG, GIF, WebP)
- Check file size (max 5MB)

### Images Not Loading
- Verify the Cloudinary URL is correct
- Check if the image was uploaded successfully
- Ensure your Cloudinary account is active

## Security Notes

- Never commit your `.env` file to version control
- Keep your API secret secure
- Consider using environment-specific configurations for production

## Production Setup

For production:
1. Use environment variables from your hosting platform
2. Set up proper CORS configuration
3. Consider using signed uploads for additional security
4. Monitor your Cloudinary usage and limits

## Cloudinary Features Used

- **Folder organization**: Images are stored in `blog-images/` folder
- **Automatic optimization**: Images are resized to 1200x800 with auto quality
- **Format conversion**: Automatic format optimization (WebP, etc.)
- **Secure URLs**: All images use HTTPS

## Cost Considerations

- **Free tier**: 25GB storage, 25GB bandwidth/month
- **Additional usage**: Pay-as-you-go pricing
- **Monitor usage**: Check your Cloudinary dashboard regularly 