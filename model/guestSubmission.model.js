import mongoose from 'mongoose';

const guestSubmissionSchema = new mongoose.Schema({
  // Owner (submitter)
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  // Author Information
  author: {
    name: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
      maxlength: [100, 'Author name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Author email is required'],
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    bio: {
      type: String,
      required: [true, 'Author bio is required'],
      maxlength: [500, 'Author bio cannot exceed 500 characters']
    },
    website: {
      type: String,
      required: false,
      trim: true,
      match: [/^https?:\/\/.+/, 'Website must be a valid URL']
    },
    company: {
      type: String,
      required: false,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    social: {
      twitter: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      github: { type: String, trim: true },
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true }
    },
    isVerified: {
      type: Boolean,
      default: false
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
  
  // Submission Details
  submission: {
    type: {
      type: String,
      enum: ['free', 'priority', 'featured'],
      default: 'free'
    },
    specialNotes: {
      type: String,
      required: false,
      maxlength: [500, 'Special notes cannot exceed 500 characters']
    },
    targetKeywords: [String],
    targetAudience: {
      type: String,
      required: false,
      maxlength: [200, 'Target audience cannot exceed 200 characters']
    }
  },
  
  // Status & Workflow
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'needs_revision', 'published'],
    default: 'pending'
  },
  
  // Timeline
  submissionDate: {
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
  revisionNotes: {
    type: String,
    required: false,
    maxlength: [1000, 'Revision notes cannot exceed 1000 characters']
  },
  
  // SEO & Quality Control
  seoReview: {
    isReviewed: { type: Boolean, default: false },
    qualityScore: { type: Number, min: 1, max: 10, default: 8 },
    seoIssues: [String],
    competitorLinks: { type: Boolean, default: false },
    nofollowLinks: { type: Boolean, default: false },
    reviewNotes: { type: String, required: false },
    plagiarismCheck: { type: Boolean, default: false },
    plagiarismScore: { type: Number, min: 0, max: 100, default: 0 }
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
guestSubmissionSchema.index({ status: 1, submissionDate: -1 });
guestSubmissionSchema.index({ 'author.email': 1 });
guestSubmissionSchema.index({ 'submission.type': 1 });
guestSubmissionSchema.index({ assignedTo: 1 });

// Pre-save middleware to set dates
guestSubmissionSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'approved' && !this.approvalDate) {
    this.approvalDate = new Date();
  }
  
  if (this.isModified('status') && this.status === 'published' && !this.publishDate) {
    this.publishDate = new Date();
  }
  
  next();
});

// Method to check if submission is old
guestSubmissionSchema.methods.isOld = function() {
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  return this.submissionDate < thirtyDaysAgo;
};

// Method to get days since submission
guestSubmissionSchema.methods.daysSinceSubmission = function() {
  const now = new Date();
  const diffTime = now - this.submissionDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Static method to get pending submissions
guestSubmissionSchema.statics.getPendingSubmissions = function() {
  return this.find({ status: 'pending' })
    .sort({ submissionDate: 1 })
    .populate('assignedTo', 'name email');
};

// Static method to get submissions by status
guestSubmissionSchema.statics.getByStatus = function(status) {
  return this.find({ status })
    .sort({ submissionDate: -1 })
    .populate('assignedTo', 'name email');
};

// Static method to get submissions by type
guestSubmissionSchema.statics.getByType = function(type) {
  return this.find({ 'submission.type': type })
    .sort({ submissionDate: -1 })
    .populate('assignedTo', 'name email');
};

const GuestSubmission = mongoose.model('GuestSubmission', guestSubmissionSchema);

export default GuestSubmission;
