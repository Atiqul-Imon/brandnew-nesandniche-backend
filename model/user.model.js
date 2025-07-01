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
    enum: ['user', 'editor', 'moderator', 'admin'],
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
  },
  // Community Features
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  website: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Website must be a valid URL']
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  socialLinks: {
    twitter: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    github: { type: String, trim: true },
    facebook: { type: String, trim: true },
    instagram: { type: String, trim: true }
  },
  // Engagement & Stats
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  totalViews: {
    type: Number,
    default: 0
  },
  totalLikes: {
    type: Number,
    default: 0
  },
  totalComments: {
    type: Number,
    default: 0
  },
  // Premium Features
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpiresAt: {
    type: Date,
    default: null
  },
  // Newsletter & Notifications
  emailNotifications: {
    newFollowers: { type: Boolean, default: true },
    newComments: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false }
  },
  // Verification & Trust
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    default: null
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
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

// Generate username if not provided
userSchema.pre('save', async function(next) {
  if (!this.isModified('name') || this.username) return next();
  
  try {
    let baseUsername = this.name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    
    let username = baseUsername;
    let counter = 1;
    
    while (await mongoose.model('User').findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }
    
    this.username = username;
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
    user: [
      'view_blogs',
      'create_comment',
      'edit_own_comment',
      'delete_own_comment',
      'like_comment',
      'follow_user',
      'view_user_profiles'
    ],
    editor: [
      'view_blogs',
      'create_blog',
      'edit_own_blog',
      'delete_own_blog',
      'publish_own_blog',
      'create_comment',
      'edit_own_comment',
      'delete_own_comment',
      'like_comment',
      'follow_user',
      'view_user_profiles',
      'view_analytics'
    ],
    moderator: [
      'view_blogs',
      'create_blog',
      'edit_own_blog',
      'delete_own_blog',
      'publish_own_blog',
      'edit_all_blogs',
      'delete_all_blogs',
      'approve_comments',
      'delete_comments',
      'manage_users',
      'create_comment',
      'edit_own_comment',
      'delete_own_comment',
      'like_comment',
      'follow_user',
      'view_user_profiles',
      'view_analytics'
    ],
    admin: [
      'view_blogs',
      'create_blog',
      'edit_own_blog',
      'edit_all_blogs',
      'delete_own_blog',
      'delete_all_blogs',
      'publish_blog',
      'approve_comments',
      'delete_comments',
      'manage_users',
      'manage_categories',
      'manage_roles',
      'view_analytics',
      'manage_system',
      'create_comment',
      'edit_own_comment',
      'delete_own_comment',
      'like_comment',
      'follow_user',
      'view_user_profiles'
    ]
  };

  return rolePermissions[this.role] || rolePermissions.user;
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

// Follow/Unfollow methods
userSchema.methods.follow = async function(userId) {
  if (this._id.toString() === userId.toString()) {
    throw new Error('Cannot follow yourself');
  }
  
  if (!this.following.includes(userId)) {
    this.following.push(userId);
    await this.save();
    
    // Add this user to the other user's followers
    await mongoose.model('User').findByIdAndUpdate(userId, {
      $addToSet: { followers: this._id }
    });
  }
};

userSchema.methods.unfollow = async function(userId) {
  this.following = this.following.filter(id => id.toString() !== userId.toString());
  await this.save();
  
  // Remove this user from the other user's followers
  await mongoose.model('User').findByIdAndUpdate(userId, {
    $pull: { followers: this._id }
  });
};

// Check if following another user
userSchema.methods.isFollowing = function(userId) {
  return this.following.some(id => id.toString() === userId.toString());
};

// Get follower count
userSchema.virtual('followerCount').get(function() {
  return this.followers.length;
});

// Get following count
userSchema.virtual('followingCount').get(function() {
  return this.following.length;
});

// Remove password from JSON response
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.verificationToken;
  delete user.emailVerificationToken;
  return user;
};

// Indexes for better performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });
userSchema.index({ isPremium: 1 });
userSchema.index({ isVerified: 1 });

const User = mongoose.model('User', userSchema);

export default User; 