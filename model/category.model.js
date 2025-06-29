import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    en: {
      type: String,
      required: [true, 'English category name is required'],
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters']
    },
    bn: {
      type: String,
      required: [true, 'Bangla category name is required'],
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters']
    }
  },
  slug: {
    en: {
      type: String,
      required: [true, 'English category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'English slug can only contain lowercase letters, numbers, and hyphens']
    },
    bn: {
      type: String,
      required: [true, 'Bangla category slug is required'],
      unique: true,
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
categorySchema.index({ 'slug.en': 1 });
categorySchema.index({ 'slug.bn': 1 });
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

const Category = mongoose.model('Category', categorySchema);

export default Category; 