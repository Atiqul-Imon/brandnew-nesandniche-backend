const express = require('express');
const router = express.Router();
const newsletterController = require('../controller/newsletter.controller');
const { rateLimit } = require('../middleware/rateLimit.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

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
router.post('/subscribe', subscribeRateLimit, newsletterController.subscribe);
router.get('/confirm/:token', newsletterController.confirmSubscription);
router.get('/unsubscribe/:token', newsletterController.unsubscribe);
router.get('/resubscribe/:token', newsletterController.resubscribe);
router.get('/status', newsletterController.getSubscriptionStatus);

// Admin routes (protected)
router.get('/stats', 
  authenticate, 
  authorize(['admin']), 
  newsletterController.getNewsletterStats
);

module.exports = router; 