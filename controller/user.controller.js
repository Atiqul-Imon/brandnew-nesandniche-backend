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
    const { 
      name, 
      username, 
      email, 
      bio, 
      location, 
      website, 
      socialLinks, 
      profileImage,
      language 
    } = req.body;
    
    const updateData = {};

    // Basic fields
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (website !== undefined) updateData.website = website;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    
    // Social links
    if (socialLinks) {
      updateData.socialLinks = {
        twitter: socialLinks.twitter || '',
        linkedin: socialLinks.linkedin || '',
        github: socialLinks.github || ''
      };
    }

    // Language validation
    if (language) {
      if (!['en', 'bn'].includes(language)) {
        return res.status(400).json({
          success: false,
          message: 'Language must be either "en" or "bn"'
        });
      }
      updateData.language = language;
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== req.user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }
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

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.logAuth('password_change', user._id, true, { email: user.email });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    logger.logAuth('password_change', req.user?.userId, false, { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/users/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const emailContent = {
      to: user.email,
      subject: 'Password Reset Request - News and Niche',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>You requested a password reset for your News and Niche account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
          <p>Best regards,<br>The News and Niche Team</p>
        </div>
      `,
      text: `
        Password Reset Request
        
        Hello ${user.name},
        
        You requested a password reset for your News and Niche account.
        
        Click the link below to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this reset, please ignore this email.
        
        Best regards,
        The News and Niche Team
      `
    };

    try {
      const { sendEmail } = await import('../utils/emailService.js');
      await sendEmail(emailContent);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the request if email fails
    }

    logger.logAuth('forgot_password', user._id, true, { email });

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    logger.logAuth('forgot_password', 'unknown', false, { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reset password with token
// @route   POST /api/users/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reset token and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Find user with reset token
    const user = await User.findOne({
      _id: decoded.userId,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logger.logAuth('password_reset', user._id, true, { email: user.email });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    logger.logAuth('password_reset', 'unknown', false, { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 