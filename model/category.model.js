import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    en: {
      type: String,
      required: false,
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters']
    },
    bn: {
      type: String,
      required: false,
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters']
    }
  },
  slug: {
    en: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'English slug can only contain lowercase letters, numbers, and hyphens']
    },
    bn: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      match: [/^[\u0980-\u09FFa-z0-9-]+$/, 'Bangla slug can only contain Bangla letters, English letters, numbers, and hyphens']
    }
  },
  description: {
    en: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters']
    },
    bn: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters']
    }
  },
  color: {
    type: String,
    default: '#3B82F6',
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color']
  },
  icon: {
    type: String,
    default: '📝'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
categorySchema.index(
  { 'slug.en': 1 },
  { unique: true, partialFilterExpression: { 'slug.en': { $exists: true, $ne: '' } } }
);
categorySchema.index(
  { 'slug.bn': 1 },
  { unique: true, partialFilterExpression: { 'slug.bn': { $exists: true, $ne: '' } } }
);
categorySchema.index({ isActive: 1, sortOrder: 1 });

// Virtual for blog count
categorySchema.virtual('blogCount', {
  ref: 'Blog',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Ensure virtuals are serialized
categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

// Add pre-validate hook to require at least one language
categorySchema.pre('validate', function(next) {
  const hasEnglish = this.name?.en && this.slug?.en;
  const hasBangla = this.name?.bn && this.slug?.bn;
  if (!hasEnglish && !hasBangla) {
    return next(new Error('At least one language (English or Bangla) must be provided with name and slug'));
  }
  next();
});

const Category = mongoose.model('Category', categorySchema);

export default Category; 