import express from 'express';
import {
  subscribe,
  confirmSubscription,
  unsubscribe,
  resubscribe,
  getSubscriptionStatus,
  getNewsletterStats
} from '../controller/newsletter.controller.js';
import { rateLimit } from '../middleware/rateLimit.middleware.js';
import { protect } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/permissions.middleware.js';

const router = express.Router();

// Rate limiting for newsletter endpoints
const newsletterRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many newsletter requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const subscribeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 subscription attempts per hour
  message: 'Too many subscription attempts from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post('/subscribe', subscribeRateLimit, subscribe);
router.get('/confirm/:token', confirmSubscription);
router.get('/unsubscribe/:token', unsubscribe);
router.get('/resubscribe/:token', resubscribe);
router.get('/status', getSubscriptionStatus);

// Admin routes (protected)
router.get('/stats', 
  protect, 
  requireAdmin, 
  getNewsletterStats
);

export default router; 