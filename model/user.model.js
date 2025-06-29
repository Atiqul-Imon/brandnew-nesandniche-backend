import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  language: {
    type: String,
    enum: ['en', 'bn'],
    default: 'en',
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'editor', 'admin'],
    default: 'user'
  },
  permissions: [{
    type: String,
    enum: [
      'create_blog',
      'edit_own_blog',
      'edit_all_blogs',
      'delete_own_blog',
      'delete_all_blogs',
      'publish_blog',
      'manage_users',
      'manage_categories',
      'view_analytics'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  languagePreference: {
    type: String,
    enum: ['en', 'bn'],
    default: 'en'
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get user permissions based on role
userSchema.methods.getPermissions = function() {
  const rolePermissions = {
    user: ['create_blog', 'edit_own_blog', 'delete_own_blog'],
    editor: ['create_blog', 'edit_own_blog', 'edit_all_blogs', 'delete_own_blog', 'publish_blog'],
    admin: ['create_blog', 'edit_own_blog', 'edit_all_blogs', 'delete_own_blog', 'delete_all_blogs', 'publish_blog', 'manage_users', 'manage_categories', 'view_analytics']
  };

  return rolePermissions[this.role] || [];
};

// Check if user has specific permission
userSchema.methods.hasPermission = function(permission) {
  const permissions = this.getPermissions();
  return permissions.includes(permission);
};

// Check if user can edit a specific blog
userSchema.methods.canEditBlog = function(blog) {
  if (this.role === 'admin') return true;
  if (this.role === 'editor' && this.hasPermission('edit_all_blogs')) return true;
  const authorId = blog.author?.user || blog.author;
  if (authorId && authorId.toString() === this._id.toString()) return true;
  return false;
};

// Check if user can delete a specific blog
userSchema.methods.canDeleteBlog = function(blog) {
  if (this.role === 'admin') return true;
  const authorId = blog.author?.user || blog.author;
  if (authorId && authorId.toString() === this._id.toString()) return true;
  return false;
};

// Remove password from JSON response
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User; 