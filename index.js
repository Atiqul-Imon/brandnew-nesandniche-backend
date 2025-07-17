// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import connectDB from './config/db.js';
import userRoutes from './routes/user.route.js';
import blogRoutes from './routes/blog.route.js';
import uploadRoutes from './routes/upload.route.js';
import categoryRoutes from './routes/category.route.js';
import commentRoutes from './routes/comment.route.js';
import newsletterRoutes from './routes/newsletter.route.js';
import { errorHandler, notFound } from './utils/errorHandler.js';
import logger from './utils/logger.js';
import { 
  generalLimiter, 
  speedLimiter 
} from './middleware/rateLimit.middleware.js';

// Debug: Check if environment variables are loaded
// console.log('🔍 Environment Variables Debug:');
// console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
// console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY);
// console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '***SET***' : 'undefined');
// console.log('NODE_ENV:', process.env.NODE_ENV);
// console.log('PORT:', process.env.PORT);
// console.log('---');

// Initialize Express
const app = express();

// Memory optimization settings
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Connect to MongoDB Atlas
connectDB();

// Middleware
app.use(cors({
  origin: [
    'https://www.newsandniche.com',
    'https://newsandniche.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));

// Optimize JSON parsing with smaller limits
app.use(express.json({ 
  limit: '5mb', // Reduced from 10mb
  strict: true 
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '5mb', // Reduced from 10mb
  parameterLimit: 1000 // Limit number of parameters
}));

// Request logging
app.use(logger.logRequest);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Apply rate limiting middleware
app.use(generalLimiter);
app.use(speedLimiter);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/newsletter', newsletterRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV });
});

// Memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };
  
  // Log memory usage every 5 minutes
  if (memUsageMB.heapUsed > 100) { // Alert if heap usage > 100MB
    logger.warn('High memory usage detected', memUsageMB);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error('👉 Try one of the following:');
    console.error('- Change the PORT in backend/.env to a free port (e.g. 5050)');
    console.error('- Kill the process using this port:');
    console.error(`    lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
