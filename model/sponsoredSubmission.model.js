import mongoose from 'mongoose';

const sponsoredSubmissionSchema = new mongoose.Schema({
  // Owner (submitter)
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  // Client Information
  client: {
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      maxlength: [100, 'Client name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Client email is required'],
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    phone: {
      type: String,
      required: false,
      trim: true
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    website: {
      type: String,
      required: [true, 'Company website is required'],
      trim: true,
      match: [/^https?:\/\/.+/, 'Website must be a valid URL']
    },
    industry: {
      type: String,
      required: [true, 'Industry is required'],
      trim: true
    },
    logo: {
      type: String,
      required: false
    }
  },
  
  // Post Content
  post: {
    title: {
      en: {
        type: String,
        required: [true, 'English title is required'],
        trim: true,
        maxlength: [200, 'English title cannot exceed 200 characters']
      },
      bn: {
        type: String,
        required: false,
        trim: true,
        maxlength: [200, 'Bangla title cannot exceed 200 characters']
      }
    },
    excerpt: {
      en: {
        type: String,
        required: [true, 'English excerpt is required'],
        maxlength: [300, 'English excerpt cannot exceed 300 characters']
      },
      bn: {
        type: String,
        required: false,
        maxlength: [300, 'Bangla excerpt cannot exceed 300 characters']
      }
    },
    content: {
      en: {
        type: String,
        required: [true, 'English content is required'],
        validate: {
          validator: function(v) {
            return v && v.trim().length >= 800;
          },
          message: 'English content must be at least 800 characters long'
        }
      },
      bn: {
        type: String,
        required: false,
        validate: {
          validator: function(v) {
            if (!v || v.trim() === '') return true;
            return v.trim().length >= 800;
          },
          message: 'Bangla content must be at least 800 characters long'
        }
      }
    },
    category: {
      en: {
        type: String,
        required: [true, 'English category is required'],
        trim: true
      },
      bn: {
        type: String,
        required: false,
        trim: true
      }
    },
    tags: [{
      en: {
        type: String,
        trim: true
      },
      bn: {
        type: String,
        trim: true
      }
    }],
    featuredImage: {
      type: String,
      required: [true, 'Featured image is required']
    }
  },
  
  // Sponsorship Details
  sponsorship: {
    budget: {
      type: Number,
      required: [true, 'Budget is required'],
      min: [50, 'Minimum budget is $50']
    },
    duration: {
      type: String,
      enum: ['1_day', '3_days', '1_week', '2_weeks', '1_month'],
      default: '1_week'
    },
    placement: {
      type: String,
      enum: ['homepage', 'category_page', 'sidebar', 'newsletter'],
      default: 'category_page'
    },
    disclosureText: {
      en: {
        type: String,
        required: [true, 'English disclosure text is required'],
        default: 'This is a sponsored post. The content and opinions expressed are those of the sponsor.'
      },
      bn: {
        type: String,
        required: false,
        default: 'এটি একটি স্পনসর করা পোস্ট। প্রকাশিত বিষয়বস্তু এবং মতামত স্পনসরের।'
      }
    },
    specialRequirements: {
      type: String,
      required: false,
      maxlength: [500, 'Special requirements cannot exceed 500 characters']
    }
  },
  
  // Status & Workflow
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'published', 'expired'],
    default: 'pending'
  },
  
  // Timeline
  requestDate: {
    type: Date,
    default: Date.now
  },
  reviewDate: {
    type: Date,
    default: null
  },
  approvalDate: {
    type: Date,
    default: null
  },
  publishDate: {
    type: Date,
    default: null
  },
  expiryDate: {
    type: Date,
    default: null
  },
  
  // Admin Management
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  adminNotes: {
    type: String,
    required: false,
    maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
  },
  rejectionReason: {
    type: String,
    required: false,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  
  // SEO & Quality Control
  seoReview: {
    isReviewed: { type: Boolean, default: false },
    qualityScore: { type: Number, min: 1, max: 10, default: 8 },
    seoIssues: [String],
    competitorLinks: { type: Boolean, default: false },
    nofollowLinks: { type: Boolean, default: false },
    reviewNotes: { type: String, required: false }
  },
  
  // Published Blog Reference
  publishedBlogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
sponsoredSubmissionSchema.index({ status: 1, requestDate: -1 });
sponsoredSubmissionSchema.index({ 'client.email': 1 });
sponsoredSubmissionSchema.index({ 'client.company': 1 });
sponsoredSubmissionSchema.index({ assignedTo: 1 });
sponsoredSubmissionSchema.index({ 'sponsorship.budget': 1 });

// Pre-save middleware to set expiry date
sponsoredSubmissionSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'approved' && !this.approvalDate) {
    this.approvalDate = new Date();
  }
  
  if (this.isModified('status') && this.status === 'published' && !this.publishDate) {
    this.publishDate = new Date();
    
    // Set expiry date based on duration
    const durationMap = {
      '1_day': 1,
      '3_days': 3,
      '1_week': 7,
      '2_weeks': 14,
      '1_month': 30
    };
    
    const days = durationMap[this.sponsorship.duration] || 7;
    this.expiryDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
  }
  
  next();
});

// Method to check if sponsorship is expired
sponsoredSubmissionSchema.methods.isExpired = function() {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
};

// Method to get days until expiry
sponsoredSubmissionSchema.methods.daysUntilExpiry = function() {
  if (!this.expiryDate) return null;
  const now = new Date();
  const diffTime = this.expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Static method to get pending submissions
sponsoredSubmissionSchema.statics.getPendingSubmissions = function() {
  return this.find({ status: 'pending' })
    .sort({ requestDate: 1 })
    .populate('assignedTo', 'name email');
};

// Static method to get submissions by status
sponsoredSubmissionSchema.statics.getByStatus = function(status) {
  return this.find({ status })
    .sort({ requestDate: -1 })
    .populate('assignedTo', 'name email');
};

const SponsoredSubmission = mongoose.model('SponsoredSubmission', sponsoredSubmissionSchema);

export default SponsoredSubmission;
