import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../model/user.model.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    console.log('Register payload:', req.body);
    const { name, email, password, language = 'en' } = req.body;

    // Check if all required fields are provided
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    // Validate language preference
    if (language && !['en', 'bn'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Language must be either "en" or "bn"'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Determine role: first user is admin, others are user
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    // Only allow whitelisted fields
    const userData = { name, email, password, language, role };
    const user = await User.create(userData);
    // Remove password from user object before sending
    const userObj = user.toObject();
    delete userObj.password;

    // Generate token
    const token = generateToken(user._id);

    logger.logAuth('register', user._id, true, { email, language });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userObj,
        token
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    logger.logAuth('register', 'unknown', false, { error: error.message });
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    console.log('Login payload:', req.body);
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      logger.logAuth('login', 'unknown', false, { email, reason: 'user_not_found' });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.logAuth('login', user._id, false, { email, reason: 'invalid_password' });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Remove password from user object before sending
    const userObj = user.toObject();
    delete userObj.password;

    // Generate token
    const token = generateToken(user._id);

    logger.logAuth('login', user._id, true, { email, language: user.language });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userObj,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    logger.logAuth('login', 'unknown', false, { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const { name, language } = req.body;
    const updateData = {};

    if (name) {
      updateData.name = name;
    }

    if (language) {
      if (!['en', 'bn'].includes(language)) {
        return res.status(400).json({
          success: false,
          message: 'Language must be either "en" or "bn"'
        });
      }
      updateData.language = language;
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User profile updated', { userId: req.user.userId, updates: Object.keys(updateData) });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    // Check if current user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view all users'
      });
    }

    const { page = 1, limit = 20, role, search, sort = 'createdAt' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = {};
    
    if (role) {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'name':
        sortObj = { name: 1 };
        break;
      case 'email':
        sortObj = { email: 1 };
        break;
      case 'role':
        sortObj = { role: 1 };
        break;
      case 'lastLogin':
        sortObj = { lastLogin: -1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    const users = await User.find(query)
      .select('-password -verificationToken -emailVerificationToken')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    // Get role statistics
    const roleStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        roleStats: roleStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    logger.error('Get all users failed', { error: error.message, adminId: req.user?.userId });
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/users/:id/role
// @access  Private (Admin only)
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Check if current user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update user roles'
      });
    }

    // Validate role
    const validRoles = ['user', 'editor', 'moderator', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: user, editor, moderator, admin'
      });
    }

    // Prevent admin from demoting themselves
    if (id === req.user.userId && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot demote yourself from admin role'
      });
    }

    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User role updated', { 
      adminId: req.user.userId, 
      userId: id, 
      oldRole: user.role, 
      newRole: role 
    });

    res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      data: { user }
    });

  } catch (error) {
    console.error('Update user role error:', error);
    logger.error('User role update failed', { 
      error: error.message, 
      adminId: req.user?.userId,
      userId: req.params.id 
    });
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user status (admin only)
// @route   PUT /api/users/:id/status
// @access  Private/Admin
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting own account
    if (id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user profile by username
// @route   GET /api/users/profile/:username
// @access  Public
export const getUserProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username })
      .select('-password -verificationToken -emailVerificationToken')
      .populate('followers', 'name username profileImage')
      .populate('following', 'name username profileImage');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's blogs count
    const blogsCount = await mongoose.model('Blog').countDocuments({
      'author.user': user._id,
      status: 'published'
    });

    // Get user's comments count
    const commentsCount = await mongoose.model('Comment').countDocuments({
      author: user._id,
      isApproved: true
    });

    const profileData = {
      ...user.toJSON(),
      stats: {
        blogsCount,
        commentsCount,
        followerCount: user.followers.length,
        followingCount: user.following.length
      }
    };

    res.status(200).json({
      success: true,
      data: { user: profileData }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    logger.error('Get user profile failed', { error: error.message, username: req.params.username });
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Follow/Unfollow user
// @route   POST /api/users/:id/follow
// @access  Private
export const toggleFollow = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.userId;

    // Cannot follow yourself
    if (id === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isFollowing = currentUser.isFollowing(id);

    if (isFollowing) {
      await currentUser.unfollow(id);
      res.status(200).json({
        success: true,
        message: 'Unfollowed successfully',
        data: { following: false }
      });
    } else {
      await currentUser.follow(id);
      res.status(200).json({
        success: true,
        message: 'Followed successfully',
        data: { following: true }
      });
    }

  } catch (error) {
    console.error('Toggle follow error:', error);
    logger.error('Toggle follow failed', { error: error.message, userId: req.user?.userId });
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 