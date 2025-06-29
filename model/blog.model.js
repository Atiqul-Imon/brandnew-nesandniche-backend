import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: {
    en: {
      type: String,
      required: false,
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
  content: {
    en: {
      type: String,
      required: false,
      minlength: [50, 'English content must be at least 50 characters long']
    },
    bn: {
      type: String,
      required: false,
      minlength: [50, 'Bangla content must be at least 50 characters long']
    }
  },
  excerpt: {
    en: {
      type: String,
      required: false,
      maxlength: [300, 'English excerpt cannot exceed 300 characters']
    },
    bn: {
      type: String,
      required: false,
      maxlength: [300, 'Bangla excerpt cannot exceed 300 characters']
    }
  },
  slug: {
    en: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'English slug can only contain lowercase letters, numbers, and hyphens']
    },
    bn: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^[\u0980-\u09FFa-z0-9-]+$/, 'Bangla slug can only contain Bangla letters, English letters, numbers, and hyphens']
    }
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
  },
  category: {
    en: {
      type: String,
      required: false,
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
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date,
    default: null
  },
  readTime: {
    en: {
      type: Number,
      min: [1, 'Read time must be at least 1 minute']
    },
    bn: {
      type: Number,
      min: [1, 'Read time must be at least 1 minute']
    }
  },
  viewCount: {
    type: Number,
    default: 0
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  seoTitle: {
    en: String,
    bn: String
  },
  seoDescription: {
    en: String,
    bn: String
  },
  seoKeywords: {
    en: [String],
    bn: [String]
  }
}, {
  timestamps: true
});

// Custom validation to ensure at least one language is provided
blogSchema.pre('validate', function(next) {
  const hasEnglish = this.title?.en && this.content?.en && this.excerpt?.en && this.slug?.en && this.category?.en;
  const hasBengali = this.title?.bn && this.content?.bn && this.excerpt?.bn && this.slug?.bn && this.category?.bn;
  
  if (!hasEnglish && !hasBengali) {
    return next(new Error('At least one language (English or Bengali) must be provided with all required fields'));
  }
  
  next();
});

// Indexes for better performance
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ author: 1 });
blogSchema.index({ 'category.en': 1 });
blogSchema.index({ 'category.bn': 1 });
blogSchema.index({ isFeatured: 1, publishedAt: -1 });

// Virtual for formatted published date
blogSchema.virtual('formattedPublishedAt').get(function() {
  if (!this.publishedAt) return null;
  return this.publishedAt.toLocaleDateString();
});

// Pre-save middleware to set publishedAt when status changes to published
blogSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Method to increment view count
blogSchema.methods.incrementViewCount = async function() {
  this.viewCount += 1;
  return await this.save();
};

// Static method to get published posts by language
blogSchema.statics.getPublishedByLanguage = function(language, limit = 10, skip = 0) {
  return this.find({
    status: 'published',
    publishedAt: { $lte: new Date() },
    [`title.${language}`]: { $exists: true, $ne: null, $ne: '' },
    [`content.${language}`]: { $exists: true, $ne: null, $ne: '' },
    [`excerpt.${language}`]: { $exists: true, $ne: null, $ne: '' },
    [`slug.${language}`]: { $exists: true, $ne: null, $ne: '' },
    [`category.${language}`]: { $exists: true, $ne: null, $ne: '' }
  })
  .select(`title.${language} content.${language} excerpt.${language} slug.${language} category.${language} featuredImage publishedAt readTime.${language} viewCount author`)
  .populate('author', 'name')
  .sort({ publishedAt: -1 })
  .limit(limit)
  .skip(skip);
};

// Static method to get featured posts by language
blogSchema.statics.getFeaturedByLanguage = function(language, limit = 5) {
  return this.find({
    status: 'published',
    isFeatured: true,
    publishedAt: { $lte: new Date() },
    [`title.${language}`]: { $exists: true, $ne: null, $ne: '' },
    [`content.${language}`]: { $exists: true, $ne: null, $ne: '' },
    [`excerpt.${language}`]: { $exists: true, $ne: null, $ne: '' },
    [`slug.${language}`]: { $exists: true, $ne: null, $ne: '' },
    [`category.${language}`]: { $exists: true, $ne: null, $ne: '' }
  })
  .select(`title.${language} content.${language} excerpt.${language} slug.${language} category.${language} featuredImage publishedAt readTime.${language} viewCount author`)
  .populate('author', 'name')
  .sort({ publishedAt: -1 })
  .limit(limit);
};

const Blog = mongoose.model('Blog', blogSchema);

export default Blog; 