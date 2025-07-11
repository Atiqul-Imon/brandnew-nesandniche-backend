import mongoose from 'mongoose';
import crypto from 'crypto';

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      },
      message: 'Please provide a valid email address'
    }
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  consent: {
    newsletter: {
      type: Boolean,
      required: [true, 'Newsletter consent is required'],
      default: false
    },
    marketing: {
      type: Boolean,
      default: false
    },
    analytics: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'unsubscribed', 'bounced'],
    default: 'pending'
  },
  confirmationToken: {
    type: String,
    unique: true,
    sparse: true
  },
  confirmationExpires: {
    type: Date
  },
  confirmedAt: {
    type: Date
  },
  unsubscribedAt: {
    type: Date
  },
  unsubscribeToken: {
    type: String,
    unique: true,
    sparse: true
  },
  locale: {
    type: String,
    enum: ['en', 'bn'],
    default: 'en'
  },
  source: {
    type: String,
    enum: ['website_signup', 'popup', 'footer', 'blog_post', 'admin'],
    default: 'website_signup'
  },
  ipAddress: {
    type: String,
    validate: {
      validator: function(ip) {
        if (!ip) return true; // Allow null/undefined
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
      },
      message: 'Please provide a valid IP address'
    }
  },
  userAgent: {
    type: String,
    maxlength: [500, 'User agent cannot be more than 500 characters']
  },
  lastEmailSent: {
    type: Date
  },
  emailCount: {
    type: Number,
    default: 0
  },
  bounceCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ confirmationToken: 1 });
newsletterSchema.index({ unsubscribeToken: 1 });
newsletterSchema.index({ createdAt: -1 });

// Virtual for checking if subscription is active
newsletterSchema.virtual('isActive').get(function() {
  return this.status === 'confirmed' && !this.unsubscribedAt;
});

// Virtual for checking if email is confirmed
newsletterSchema.virtual('isConfirmed').get(function() {
  return this.status === 'confirmed';
});

// Pre-save middleware to generate tokens
newsletterSchema.pre('save', function(next) {
  if (this.isNew && !this.confirmationToken) {
    this.confirmationToken = crypto.randomBytes(32).toString('hex');
    this.confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
  
  if (this.isNew && !this.unsubscribeToken) {
    this.unsubscribeToken = crypto.randomBytes(32).toString('hex');
  }
  
  next();
});

// Method to confirm subscription
newsletterSchema.methods.confirmSubscription = function() {
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  this.confirmationToken = undefined;
  this.confirmationExpires = undefined;
  return this.save();
};

// Method to unsubscribe
newsletterSchema.methods.unsubscribe = function() {
  this.status = 'unsubscribed';
  this.unsubscribedAt = new Date();
  return this.save();
};

// Method to resubscribe
newsletterSchema.methods.resubscribe = function() {
  this.status = 'confirmed';
  this.unsubscribedAt = undefined;
  return this.save();
};

// Method to mark as bounced
newsletterSchema.methods.markAsBounced = function() {
  this.bounceCount += 1;
  if (this.bounceCount >= 3) {
    this.status = 'bounced';
  }
  return this.save();
};

// Static method to find active subscribers
newsletterSchema.statics.findActiveSubscribers = function() {
  return this.find({
    status: 'confirmed',
    unsubscribedAt: { $exists: false }
  });
};

// Static method to find subscribers by consent type
newsletterSchema.statics.findByConsent = function(consentType) {
  const query = {};
  query[`consent.${consentType}`] = true;
  query.status = 'confirmed';
  query.unsubscribedAt = { $exists: false };
  
  return this.find(query);
};

// Static method to clean expired confirmation tokens
newsletterSchema.statics.cleanExpiredTokens = function() {
  return this.updateMany(
    {
      status: 'pending',
      confirmationExpires: { $lt: new Date() }
    },
    {
      $unset: {
        confirmationToken: 1,
        confirmationExpires: 1
      }
    }
  );
};

// Static method to get subscription statistics
newsletterSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Static method to find subscribers for email campaign
newsletterSchema.statics.findForCampaign = function(options = {}) {
  const query = {
    status: 'confirmed',
    unsubscribedAt: { $exists: false }
  };

  if (options.consentType) {
    query[`consent.${options.consentType}`] = true;
  }

  if (options.locale) {
    query.locale = options.locale;
  }

  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  return this.find(query).select('email name locale tags');
};

const Newsletter = mongoose.model('Newsletter', newsletterSchema);
export default Newsletter; 