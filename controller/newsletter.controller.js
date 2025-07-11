import Newsletter from '../model/newsletter.model.js';
import logger from '../utils/logger.js';
import { sendEmail } from '../utils/emailService.js';

// Subscribe to newsletter
const subscribe = async (req, res) => {
  try {
    const { email, name, consent, locale = 'en', source = 'website_signup' } = req.body;
    
    // Validate required fields
    if (!email || !consent || !consent.newsletter) {
      return res.status(400).json({
        success: false,
        message: 'Email and newsletter consent are required'
      });
    }

    // Check if already subscribed
    const existingSubscriber = await Newsletter.findOne({ email: email.toLowerCase() });
    
    if (existingSubscriber) {
      if (existingSubscriber.status === 'confirmed' && !existingSubscriber.unsubscribedAt) {
        return res.status(400).json({
          success: false,
          message: 'You are already subscribed to our newsletter'
        });
      }
      
      if (existingSubscriber.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Please check your email to confirm your subscription'
        });
      }
      
      // Resubscribe if previously unsubscribed
      if (existingSubscriber.status === 'unsubscribed') {
        existingSubscriber.status = 'confirmed';
        existingSubscriber.unsubscribedAt = undefined;
        existingSubscriber.consent = consent;
        existingSubscriber.locale = locale;
        existingSubscriber.source = source;
        existingSubscriber.ipAddress = req.ip;
        existingSubscriber.userAgent = req.get('User-Agent');
        
        await existingSubscriber.save();
        
        logger.info(`Newsletter resubscription: ${email}`);
        
        return res.json({
          success: true,
          message: 'Successfully resubscribed to newsletter'
        });
      }
    }

    // Create new subscription
    const subscriber = new Newsletter({
      email: email.toLowerCase(),
      name: name || null,
      consent,
      locale,
      source,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await subscriber.save();

    // Send confirmation email
    try {
      await sendConfirmationEmail(subscriber);
      logger.info(`Newsletter subscription created: ${email}`);
    } catch (emailError) {
      logger.error(`Failed to send confirmation email: ${emailError.message}`);
      // Don't fail the subscription if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Please check your email to confirm your subscription'
    });

  } catch (error) {
    logger.error(`Newsletter subscription error: ${error.message}`);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This email is already subscribed'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to newsletter'
    });
  }
};

// Confirm subscription
const confirmSubscription = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation token is required'
      });
    }

    const subscriber = await Newsletter.findOne({ 
      confirmationToken: token,
      status: 'pending',
      confirmationExpires: { $gt: new Date() }
    });

    if (!subscriber) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired confirmation token'
      });
    }

    await subscriber.confirmSubscription();

    logger.info(`Newsletter subscription confirmed: ${subscriber.email}`);

    res.json({
      success: true,
      message: 'Your subscription has been confirmed successfully'
    });

  } catch (error) {
    logger.error(`Newsletter confirmation error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm subscription'
    });
  }
};

// Unsubscribe from newsletter
const unsubscribe = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Unsubscribe token is required'
      });
    }

    const subscriber = await Newsletter.findOne({ 
      unsubscribeToken: token,
      status: { $in: ['confirmed', 'pending'] }
    });

    if (!subscriber) {
      return res.status(400).json({
        success: false,
        message: 'Invalid unsubscribe token'
      });
    }

    await subscriber.unsubscribe();

    logger.info(`Newsletter unsubscription: ${subscriber.email}`);

    res.json({
      success: true,
      message: 'You have been successfully unsubscribed'
    });

  } catch (error) {
    logger.error(`Newsletter unsubscribe error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe'
    });
  }
};

// Resubscribe to newsletter
const resubscribe = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Resubscribe token is required'
      });
    }

    const subscriber = await Newsletter.findOne({ 
      unsubscribeToken: token,
      status: 'unsubscribed'
    });

    if (!subscriber) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resubscribe token'
      });
    }

    await subscriber.resubscribe();

    logger.info(`Newsletter resubscription via token: ${subscriber.email}`);

    res.json({
      success: true,
      message: 'You have been successfully resubscribed'
    });

  } catch (error) {
    logger.error(`Newsletter resubscribe error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to resubscribe'
    });
  }
};

// Get subscription status
const getSubscriptionStatus = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (!subscriber) {
      return res.json({
        success: true,
        subscribed: false
      });
    }

    res.json({
      success: true,
      subscribed: subscriber.isActive,
      status: subscriber.status,
      confirmed: subscriber.isConfirmed,
      unsubscribed: !!subscriber.unsubscribedAt
    });

  } catch (error) {
    logger.error(`Get subscription status error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription status'
    });
  }
};

// Get newsletter statistics (admin only)
const getNewsletterStats = async (req, res) => {
  try {
    const stats = await Newsletter.getStats();
    
    const totalSubscribers = await Newsletter.countDocuments();
    const activeSubscribers = await Newsletter.countDocuments({
      status: 'confirmed',
      unsubscribedAt: { $exists: false }
    });
    const pendingSubscribers = await Newsletter.countDocuments({ status: 'pending' });
    const unsubscribedCount = await Newsletter.countDocuments({ status: 'unsubscribed' });
    const bouncedCount = await Newsletter.countDocuments({ status: 'bounced' });

    res.json({
      success: true,
      stats: {
        total: totalSubscribers,
        active: activeSubscribers,
        pending: pendingSubscribers,
        unsubscribed: unsubscribedCount,
        bounced: bouncedCount,
        byStatus: stats
      }
    });

  } catch (error) {
    logger.error(`Get newsletter stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get newsletter statistics'
    });
  }
};

// Send confirmation email
const sendConfirmationEmail = async (subscriber) => {
  const confirmationUrl = `${process.env.FRONTEND_URL}/${subscriber.locale}/newsletter/confirm/${subscriber.confirmationToken}`;
  const unsubscribeUrl = `${process.env.FRONTEND_URL}/${subscriber.locale}/newsletter/unsubscribe/${subscriber.unsubscribeToken}`;
  
  const emailContent = {
    to: subscriber.email,
    subject: subscriber.locale === 'bn' 
      ? 'আপনার নিউজলেটার সাবস্ক্রিপশন নিশ্চিত করুন' 
      : 'Confirm Your Newsletter Subscription',
    template: 'newsletter-confirmation',
    data: {
      name: subscriber.name || 'Subscriber',
      confirmationUrl,
      unsubscribeUrl,
      locale: subscriber.locale
    }
  };

  await sendEmail(emailContent);
};

// Clean expired tokens (cron job)
const cleanExpiredTokens = async () => {
  try {
    const result = await Newsletter.cleanExpiredTokens();
    logger.info(`Cleaned ${result.modifiedCount} expired confirmation tokens`);
  } catch (error) {
    logger.error(`Clean expired tokens error: ${error.message}`);
  }
};

export {
  subscribe,
  confirmSubscription,
  unsubscribe,
  resubscribe,
  getSubscriptionStatus,
  getNewsletterStats,
  cleanExpiredTokens
}; 